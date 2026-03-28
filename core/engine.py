"""AgentForge V2 — ForgeEngine: 核心编排引擎，只做编排不操作子系统内部状态。"""

from __future__ import annotations

import asyncio
import logging
import time
from pathlib import Path
from uuid import uuid4
from typing import AsyncIterator

from core.config.loader import ConfigLoader
from core.models import (
    ForgeConfig, Mission, MissionResult, PositionConfig,
    ProfileBundle, UnifiedMessage, ContextResult,
)

logger = logging.getLogger(__name__)


class ForgeEngine:
    """核心编排引擎。"""

    def __init__(self, root_dir: str | Path | None = None):
        self.root_dir = Path(root_dir) if root_dir else Path(__file__).resolve().parent.parent
        self._loader = ConfigLoader(self.root_dir)
        self.config: ForgeConfig | None = None
        self._bundles: dict[str, ProfileBundle] = {}

        # 共享组件 (init() 时创建)
        self._llm = None
        self._session_store = None
        self._signal_store = None
        self._tool_registry = None
        self._context_builder = None
        self._knowledge_base = None
        self._connector_store = None
        self._sync_manager = None
        self._token_tracker = None
        self._mission_tracer = None
        self._work_item_store = None
        self._scheduler = None
        self._trigger_manager = None
        self._wf_store = None
        self._wf_engine = None
        self._gateway = None
        self._proactive = None
        self._pre_tool_guard = None
        self._exec_guard = None
        self._audit_logger = None
        self._system_guard = None
        self._log_collector = None
        self._initialized = False

    async def init(self) -> None:
        """异步初始化所有组件。"""
        if self._initialized:
            return

        self.config = self._loader.load_forge_config()
        logger.info("ForgeEngine 初始化: %s v%s", self.config.name, self.config.version)

        # LLM 客户端
        from core.llm import LLMClient
        self._llm = LLMClient(self.config)

        # 存储 + 可观测性 + 工作项
        from memory.session_store import SessionStore
        from memory.signal_store import SignalStore
        from observability.token_tracker import TokenTracker
        from observability.tracer import MissionTracer
        from memory.work_item_store import WorkItemStore
        db_path = str(self.root_dir / "data" / "memories.db")
        self._session_store = SessionStore(db_path)
        self._signal_store = SignalStore(db_path)
        self._token_tracker = TokenTracker(db_path)
        self._mission_tracer = MissionTracer(db_path)
        self._work_item_store = WorkItemStore(db_path)
        for store in (self._session_store, self._signal_store,
                      self._token_tracker, self._mission_tracer, self._work_item_store):
            await store.ensure_tables()

        # 工具
        from tools.registry import ToolRegistry
        from tools.builtin.core_tools import register_all
        self._tool_registry = ToolRegistry()
        register_all(self._tool_registry)
        logger.info("工具注册完成: %d 个", self._tool_registry.count)

        # 上下文构建器
        from core.pipeline.context_builder import ContextBuilder
        self._context_builder = ContextBuilder()

        # 知识库
        from knowledge.rag import KnowledgeBase
        kb_cfg = self.config.knowledge
        self._knowledge_base = KnowledgeBase(
            data_dir=str(self.root_dir / "data"),
            chunk_size=kb_cfg.get("chunk_size", 500),
            chunk_overlap=kb_cfg.get("chunk_overlap", 100),
        )
        if kb_cfg.get("enabled", True):
            await self._knowledge_base.init()
            logger.info("知识库初始化完成: %s", self._knowledge_base.get_stats())

        # 企业连接器体系
        from knowledge.connectors.store import ConnectorStore
        from knowledge.sync_manager import SyncManager
        self._connector_store = ConnectorStore(data_dir=str(self.root_dir / "data"))
        await self._connector_store.init()
        if self._knowledge_base:
            self._sync_manager = SyncManager(self._connector_store, self._knowledge_base)
            logger.info("ConnectorStore + SyncManager 初始化完成")

        # 动态工具注册
        if self._knowledge_base:
            from tools.builtin.search_knowledge import create_search_knowledge_tool, create_knowledge_list_tool
            self._tool_registry.register(create_search_knowledge_tool(self._knowledge_base))
            self._tool_registry.register(create_knowledge_list_tool(self._knowledge_base))
        if self._work_item_store:
            from tools.builtin.workstation_tools import create_workstation_tools
            for t in create_workstation_tools(self._work_item_store):
                self._tool_registry.register(t)

        # 加载 Profiles
        for name in self._loader.list_profiles():
            self._bundles[name] = self._loader.load_profile(name)

        # 触发器 + 调度器
        from scheduler.scheduler import Scheduler
        from workflow.trigger import TriggerManager
        from workflow.store import WorkflowStore
        from workflow.engine import WorkflowEngine as WFEngine
        from workflow.registry import NodeRegistry as WFNodeRegistry
        from workflow.nodes import register_all_nodes
        self._scheduler = Scheduler(check_interval=60)
        self._wf_store = WorkflowStore(str(self.root_dir / "data" / "workflows.db"))
        await self._wf_store.ensure_tables()
        wf_registry = WFNodeRegistry()
        register_all_nodes(wf_registry, self._llm)
        self._wf_engine = WFEngine(registry=wf_registry, store=self._wf_store)
        self._trigger_manager = TriggerManager(self._wf_store, self._wf_engine, self._scheduler, self._llm)
        await self._trigger_manager.load_triggers()

        # 工作流工具注册
        from tools.builtin.workflow_tools import create_workflow_tools
        for t in create_workflow_tools(self._wf_store, self._trigger_manager):
            self._tool_registry.register(t)

        # 安全护栏
        from core.guardrails import PreToolGuard, ExecutionGuard, AuditLogger, SystemGuard
        self._pre_tool_guard = PreToolGuard()
        self._exec_guard = ExecutionGuard()
        self._audit_logger = AuditLogger(db_path=str(self.root_dir / "data" / "memories.db"))
        await self._audit_logger.ensure_table()
        gr_cfg = self.config.guardrails if hasattr(self.config, 'guardrails') and self.config.guardrails else {}
        self._system_guard = SystemGuard(
            max_tokens_per_session=gr_cfg.get("max_tokens_per_session", 50000),
            max_requests_per_day=gr_cfg.get("max_requests_per_day", 200),
            max_input_length=gr_cfg.get("max_input_length", 50000),
        )

        # 结构化日志收集器
        from observability.log_collector import LogCollector
        self._log_collector = LogCollector(
            max_entries=2000,
            db_path=str(self.root_dir / "data" / "memories.db"),
        )
        await self._log_collector.ensure_table()
        self._log_collector.info("system", "engine_init", "ForgeEngine 初始化完成")

        self._initialized = True
        logger.info("ForgeEngine 初始化完成")

    # ── 消息处理 ──────────────────────────────────────────

    async def handle_message(self, msg: UnifiedMessage) -> dict:
        """完整管线：解析岗位 → 会话管理 → 构建上下文 → 执行 → 存储。"""
        if self._system_guard:
            for chk in (self._system_guard.check_input(msg.content), self._system_guard.check_budget(msg.user_id)):
                if not chk.passed:
                    return {"content": chk.reason, "status": "blocked"}
        position = self._resolve_position(msg)
        if not position:
            return {"content": "未找到岗位配置，请先选择岗位。", "status": "error"}

        session_id = msg.session_id or await self._session_store.create_session(
            user_id=msg.user_id, org_id=msg.org_id, position_id=msg.position_id,
        )

        await self._session_store.add_message(session_id, "user", msg.content)

        history = await self._session_store.get_history_as_llm_messages(session_id, limit=20)
        if history and history[-1].get("role") == "user":
            history = history[:-1]

        mission = Mission(
            id=uuid4().hex[:12],
            instruction=msg.content,
            position_id=msg.position_id,
            user_id=msg.user_id,
            org_id=msg.org_id,
            session_id=session_id,
            context={"tool_names": [],
                     "user_id": msg.user_id, "org_id": msg.org_id,
                     "position_id": msg.position_id,
                     "tool_hint": msg.metadata.get("tool_hint", "")},
            attachments=msg.attachments,
        )

        if self._mission_tracer:
            await self._mission_tracer.start(
                mission_id=mission.id, user_id=msg.user_id, org_id=msg.org_id,
                position_id=msg.position_id, instruction=msg.content,
            )

        rag_results = self._search_rag(msg.content, position, org_id=msg.org_id)
        daily_summary = await self._get_daily_summary(msg.user_id, msg.org_id, msg.position_id)
        context = self._context_builder.build(
            position=position, mission=mission, history=history,
            rag_results=rag_results, daily_context=daily_summary,
        )

        from core.agent import AgentRuntime
        runtime = AgentRuntime(self._llm, self._tool_registry, guardrails={
            "pre_tool": self._pre_tool_guard, "execution": self._exec_guard,
            "audit": self._audit_logger, "log": self._log_collector})
        result = await runtime.execute(mission, context)

        await self._record_observability(msg, result)
        await self._collect_signals(msg.content, msg.user_id, msg.org_id, msg.position_id)
        tc_list = [{"name": s.tool_calls[0]["name"]} for s in result.steps if s.tool_calls] if result.steps else []
        asyncio.ensure_future(self._post_process(msg.content, result.content, tc_list, msg.user_id, msg.org_id, msg.position_id))
        await self._session_store.add_message(
            session_id, "assistant", result.content,
            tokens_used=result.tokens_used, model=result.model_used,
        )

        return {
            "content": result.content,
            "status": result.status,
            "session_id": session_id,
            "mission_id": result.mission_id,
            "tokens_used": result.tokens_used,
            "duration": result.duration,
            "model": result.model_used,
        }

    async def handle_message_stream(self, msg: UnifiedMessage) -> AsyncIterator[dict]:
        """流式处理消息。"""
        lc = self._log_collector
        _t0 = time.time()
        if lc:
            lc.info("pipeline", "request_start", f"收到消息: {msg.content[:80]}",
                    data={"position_id": msg.position_id, "has_attachments": bool(msg.attachments)},
                    user_id=msg.user_id, session_id=msg.session_id or "")
        if self._system_guard:
            for chk in (self._system_guard.check_input(msg.content), self._system_guard.check_budget(msg.user_id)):
                if not chk.passed:
                    if lc:
                        lc.warn("guard", "request_blocked", chk.reason, user_id=msg.user_id)
                    yield {"type": "text", "text": chk.reason}
                    yield {"type": "done"}
                    return
        position = self._resolve_position(msg)
        if not position:
            yield {"type": "text", "text": "未找到岗位配置。"}
            yield {"type": "done"}
            return
        if lc:
            lc.info("pipeline", "position_resolved", f"岗位: {position.display_name}",
                    user_id=msg.user_id)

        session_id = msg.session_id or await self._session_store.create_session(
            user_id=msg.user_id, org_id=msg.org_id, position_id=msg.position_id,
        )
        await self._session_store.add_message(session_id, "user", msg.content)
        if lc:
            lc.info("pipeline", "session_ready", f"会话: {session_id}",
                    user_id=msg.user_id, session_id=session_id)

        history = await self._session_store.get_history_as_llm_messages(session_id, limit=20)
        if history and history[-1].get("role") == "user":
            history = history[:-1]

        mission = Mission(
            id=uuid4().hex[:12], instruction=msg.content,
            position_id=msg.position_id, user_id=msg.user_id,
            org_id=msg.org_id, session_id=session_id,
            context={"tool_names": [],
                     "user_id": msg.user_id, "org_id": msg.org_id,
                     "position_id": msg.position_id,
                     "tool_hint": msg.metadata.get("tool_hint", "")},
            attachments=msg.attachments,
        )
        rag_results = self._search_rag(msg.content, position, org_id=msg.org_id)
        if lc:
            lc.info("pipeline", "rag_done", f"RAG 检索: {len(rag_results)} 条",
                    data={"count": len(rag_results)}, user_id=msg.user_id, session_id=session_id)
        daily_summary = await self._get_daily_summary(msg.user_id, msg.org_id, msg.position_id)
        if msg.metadata.get("web_search"):
            daily_summary += "\n[联网搜索已开启] 优先使用 web_search 工具搜索最新信息来回答。"
        if msg.metadata.get("tool_hint"):
            daily_summary += f"\n[系统提示] 用户通过快捷命令指定使用 {msg.metadata['tool_hint']} 工具，请直接调用。"
        if self._trigger_manager:
            wf_match = self._trigger_manager.match_chat_trigger(msg.content)
            if wf_match:
                daily_summary += f"\n[系统提示] 用户消息可能与工作流「{wf_match['name']}」相关（关键词: {wf_match['matched_keyword']}）。如果用户想执行它，请调用 run_workflow。"
        context = self._context_builder.build(
            position=position, mission=mission, history=history,
            rag_results=rag_results, daily_context=daily_summary,
        )
        if lc:
            lc.info("pipeline", "context_built", "上下文构建完成",
                    data={"messages": len(context.messages)},
                    user_id=msg.user_id, session_id=session_id)

        from core.agent import AgentRuntime
        runtime = AgentRuntime(self._llm, self._tool_registry, guardrails={
            "pre_tool": self._pre_tool_guard, "execution": self._exec_guard,
            "audit": self._audit_logger, "log": self._log_collector})

        if lc:
            lc.info("pipeline", "stream_start", "开始流式生成",
                    user_id=msg.user_id, session_id=session_id)
        full_content = ""
        collected_tools: list[dict] = []
        collected_tool_calls: list[dict] = []
        async for chunk in runtime.execute_stream(mission, context):
            ct = chunk.get("type", "")
            if ct == "text":
                full_content += chunk.get("text", "")
            elif ct == "tool_start":
                collected_tools.append({"name": chunk.get("name", "")})
                collected_tool_calls.append({"type": "tool_start", "name": chunk.get("name", ""), "input": chunk.get("arguments", {})})
            elif ct == "tool_result":
                collected_tool_calls.append({"type": "tool_result", "name": chunk.get("name", ""), "result": chunk.get("result", "")[:3000]})
            if ct == "done":
                chunk["session_id"] = session_id
            yield chunk

        # ── 后处理：自动文件生成（LLM 没调文件工具时系统兜底）──
        _file_tools = {"word_processor", "excel_processor", "ppt_processor", "document_converter"}
        already_created = any(t["name"] in _file_tools for t in collected_tools)
        if not already_created and full_content:
            from core.pipeline.post_file_handler import detect_file_intent, auto_create_file
            file_fmt = detect_file_intent(msg.content)
            if file_fmt:
                logger.info("后处理：检测到文件意图 [%s]，自动创建", file_fmt)
                try:
                    tr = await auto_create_file(full_content, file_fmt, msg.content, self._tool_registry)
                    if tr:
                        yield {"type": "thinking", "content": "📄 正在生成文件..."}
                        yield {"type": "tool_start", "name": tr["name"], "arguments": {}}
                        yield {"type": "tool_result", "name": tr["name"], "result": tr["result"]}
                        collected_tools.append({"name": tr["name"]})
                        collected_tool_calls.append({"type": "tool_start", "name": tr["name"], "input": {}})
                        collected_tool_calls.append({"type": "tool_result", "name": tr["name"], "result": str(tr["result"])[:3000]})
                except Exception as e:
                    logger.warning("自动文件创建失败: %s", e)

        if lc:
            lc.info("pipeline", "stream_done", f"流式完成, 长度={len(full_content)}",
                    data={"tools": [t["name"] for t in collected_tools]},
                    user_id=msg.user_id, session_id=session_id,
                    duration=time.time() - _t0)
        if full_content or collected_tool_calls:
            await self._session_store.add_message(
                session_id, "assistant", full_content,
                tool_calls=collected_tool_calls if collected_tool_calls else None,
            )
        asyncio.ensure_future(self._collect_signals(msg.content, msg.user_id, msg.org_id, msg.position_id))
        asyncio.ensure_future(self._post_process(msg.content, full_content, collected_tools, msg.user_id, msg.org_id, msg.position_id))
        if self._signal_store and msg.position_id and msg.user_id:
            asyncio.ensure_future(self._signal_store.increment_pending(msg.org_id, msg.position_id, msg.user_id))
    # ── 内部辅助 ─────────────────────────────────────────

    def _search_rag(self, query: str, position: PositionConfig, org_id: str = "") -> list[dict]:
        if self._knowledge_base:
            return self._knowledge_base.search(query=query, top_k=self.config.knowledge.get("retrieval_top_k", 3), org_id=org_id)
        return []

    async def _record_observability(self, msg: UnifiedMessage, result: MissionResult) -> None:
        if self._token_tracker and result.tokens_used > 0:
            await self._token_tracker.record(user_id=msg.user_id, org_id=msg.org_id, position_id=msg.position_id,
                model=result.model_used, provider="", input_tokens=0, output_tokens=0, cost_usd=0.0, mission_id=result.mission_id)
        if self._mission_tracer:
            await self._mission_tracer.complete(mission_id=result.mission_id, status=result.status,
                content=result.content[:2000], tokens_used=result.tokens_used, duration=result.duration, model_used=result.model_used)

    async def _get_daily_summary(self, user_id: str, org_id: str, position_id: str) -> str:
        from core.daily_context import build_daily_summary
        return await build_daily_summary(self._work_item_store, self._wf_store, self._session_store, user_id, org_id, position_id)

    async def _collect_signals(self, content: str, user_id: str, org_id: str, position_id: str) -> None:
        from core.daily_context import collect_signals
        await collect_signals(self._signal_store, content, user_id, org_id, position_id)

    async def _post_process(self, user_input: str, ai_response: str, tool_calls: list[dict],
                            user_id: str, org_id: str, position_id: str) -> None:
        from core.daily_context import post_process_signals
        await post_process_signals(self._signal_store, user_input, tool_calls, user_id, org_id, position_id)

    # ── 查询接口 ──────────────────────────────────────────

    def _resolve_position(self, msg: UnifiedMessage) -> PositionConfig | None:
        if not msg.position_id:
            return None
        for bundle in self._bundles.values():
            if msg.position_id in bundle.positions:
                return bundle.positions[msg.position_id]
        return None

    async def reload_profiles(self) -> list[str]:
        """重新加载所有 Profiles。"""
        self._bundles.clear()
        for name in self._loader.list_profiles():
            self._bundles[name] = self._loader.load_profile(name)
        logger.info("Profiles 重新加载: %s", list(self._bundles.keys()))
        return list(self._bundles.keys())

    def get_position(self, profile_name: str, position_id: str) -> PositionConfig | None:
        bundle = self._bundles.get(profile_name)
        return bundle.positions.get(position_id) if bundle else None

    def get_positions_list(self, profile_name: str = "") -> list[dict]:
        targets = [self._bundles[profile_name]] if profile_name in self._bundles else self._bundles.values()
        return [{"position_id": pos.position_id, "display_name": pos.display_name,
                 "icon": pos.icon, "color": pos.color, "department": pos.department,
                 "description": pos.description}
                for b in targets for pos in b.positions.values()]

    @property
    def log_collector(self): return self._log_collector
    @property
    def session_store(self): return self._session_store
    @property
    def signal_store(self): return self._signal_store
    @property
    def knowledge_base(self): return self._knowledge_base
    @property
    def token_tracker(self): return self._token_tracker
    @property
    def mission_tracer(self): return self._mission_tracer
    @property
    def work_item_store(self): return self._work_item_store
    @property
    def trigger_manager(self): return self._trigger_manager
    @property
    def wf_store(self): return self._wf_store
    @property
    def wf_engine(self): return self._wf_engine
    @property
    def connector_store(self): return self._connector_store
    @property
    def sync_manager(self): return self._sync_manager

    # ── 生命周期 ──────────────────────────────────────────

    async def serve(self, host: str = "0.0.0.0", api_port: int = 8080) -> None:
        """启动 HTTP API 服务。"""
        await self.init()
        from api.app import create_app
        import aiohttp.web
        app = create_app(self)
        self._app = app
        runner = aiohttp.web.AppRunner(app)
        await runner.setup()
        site = aiohttp.web.TCPSite(runner, host, api_port)
        await site.start()
        if self._scheduler:
            await self._scheduler.start()
        # 主动推送引擎
        self._gateway = app.get("gateway")
        if self._gateway and self._scheduler:
            from core.proactive_engine import ProactiveEngine
            self._proactive = ProactiveEngine(self._work_item_store, self._wf_store, self._session_store, self._gateway)
            self._scheduler.add_job("proactive_check", "AI 主动推送检查", "*/5 * * * *", self._proactive.check_all_users)
            logger.info("主动推送引擎已启动（每 5 分钟检查）")

        if self._knowledge_base:
            async def _purge_deleted_docs():
                result = self._knowledge_base.purge_deleted_documents(retain_days=30)
                logger.info("定时清理软删除文档: %s", result)
            self._scheduler.add_job("purge_deleted_docs", "软删除物理清理", "0 3 * * *", _purge_deleted_docs)
            logger.info("软删除清理任务已注册（每日 03:00，保留 30 天）")

        logger.info("API 服务已启动: http://%s:%d", host, api_port)
        try:
            await asyncio.Event().wait()
        except (KeyboardInterrupt, asyncio.CancelledError):
            pass
        finally:
            await runner.cleanup()

    async def shutdown(self) -> None:
        if self._scheduler:
            await self._scheduler.stop()
        logger.info("ForgeEngine 关闭")
        self._initialized = False
