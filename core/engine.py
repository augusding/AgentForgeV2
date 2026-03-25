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
        self._token_tracker = None
        self._mission_tracer = None
        self._work_item_store = None
        self._scheduler = None
        self._trigger_manager = None
        self._wf_store = None
        self._wf_engine = None
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

        # 动态工具注册
        if self._knowledge_base:
            from tools.builtin.search_knowledge import create_search_knowledge_tool
            self._tool_registry.register(create_search_knowledge_tool(self._knowledge_base))
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
        self._scheduler = Scheduler(check_interval=60)
        self._wf_store = WorkflowStore(str(self.root_dir / "data" / "workflows.db"))
        await self._wf_store.ensure_tables()
        self._wf_engine = WFEngine()
        self._trigger_manager = TriggerManager(self._wf_store, self._wf_engine, self._scheduler, self._llm)
        await self._trigger_manager.load_triggers()

        self._initialized = True
        logger.info("ForgeEngine 初始化完成")

    # ── 消息处理 ──────────────────────────────────────────

    async def handle_message(self, msg: UnifiedMessage) -> dict:
        """完整管线：解析岗位 → 会话管理 → 构建上下文 → 执行 → 存储。"""
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
            context={"tool_names": position.tools,
                     "user_id": msg.user_id, "org_id": msg.org_id,
                     "position_id": msg.position_id},
            attachments=msg.attachments,
        )

        if self._mission_tracer:
            await self._mission_tracer.start(
                mission_id=mission.id, user_id=msg.user_id, org_id=msg.org_id,
                position_id=msg.position_id, instruction=msg.content,
            )

        rag_results = self._search_rag(msg.content, position)
        daily_summary = await self._get_daily_summary(msg.user_id, msg.org_id, msg.position_id)
        context = self._context_builder.build(
            position=position, mission=mission, history=history,
            rag_results=rag_results, daily_context=daily_summary,
        )

        from core.agent import AgentRuntime
        runtime = AgentRuntime(self._llm, self._tool_registry)
        result = await runtime.execute(mission, context)

        await self._record_observability(msg, result)
        await self._collect_signals(msg.content, msg.user_id, msg.org_id, msg.position_id)
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
        position = self._resolve_position(msg)
        if not position:
            yield {"type": "text", "text": "未找到岗位配置。"}
            yield {"type": "done"}
            return

        session_id = msg.session_id or await self._session_store.create_session(
            user_id=msg.user_id, org_id=msg.org_id, position_id=msg.position_id,
        )
        await self._session_store.add_message(session_id, "user", msg.content)

        history = await self._session_store.get_history_as_llm_messages(session_id, limit=20)
        if history and history[-1].get("role") == "user":
            history = history[:-1]

        mission = Mission(
            id=uuid4().hex[:12], instruction=msg.content,
            position_id=msg.position_id, user_id=msg.user_id,
            org_id=msg.org_id, session_id=session_id,
            context={"tool_names": position.tools,
                     "user_id": msg.user_id, "org_id": msg.org_id,
                     "position_id": msg.position_id},
            attachments=msg.attachments,
        )
        rag_results = self._search_rag(msg.content, position)
        daily_summary = await self._get_daily_summary(msg.user_id, msg.org_id, msg.position_id)
        context = self._context_builder.build(
            position=position, mission=mission, history=history,
            rag_results=rag_results, daily_context=daily_summary,
        )

        from core.agent import AgentRuntime
        runtime = AgentRuntime(self._llm, self._tool_registry)

        full_content = ""
        async for chunk in runtime.execute_stream(mission, context):
            if chunk.get("type") == "text":
                full_content += chunk.get("text", "")
            yield chunk

        if full_content:
            await self._session_store.add_message(session_id, "assistant", full_content)

    # ── 内部辅助 ─────────────────────────────────────────

    def _search_rag(self, query: str, position: PositionConfig) -> list[dict]:
        """RAG 检索（同步，KnowledgeBase.search 本身是同步的）。"""
        if self._knowledge_base and position.knowledge_scope:
            return self._knowledge_base.search(
                query=query,
                top_k=self.config.knowledge.get("retrieval_top_k", 3),
            )
        return []

    async def _record_observability(self, msg: UnifiedMessage, result: MissionResult) -> None:
        """记录 token 消耗和 mission 轨迹。"""
        if self._token_tracker and result.tokens_used > 0:
            await self._token_tracker.record(
                user_id=msg.user_id, org_id=msg.org_id,
                position_id=msg.position_id,
                model=result.model_used, provider="",
                input_tokens=0, output_tokens=0,
                cost_usd=0.0, mission_id=result.mission_id,
            )
        if self._mission_tracer:
            await self._mission_tracer.complete(
                mission_id=result.mission_id, status=result.status,
                content=result.content[:2000], tokens_used=result.tokens_used,
                duration=result.duration, model_used=result.model_used,
            )

    async def _get_daily_summary(self, user_id: str, org_id: str, position_id: str) -> str:
        """获取每日上下文摘要。"""
        if not self._work_item_store:
            return ""
        priorities = await self._work_item_store.get_priorities(user_id, org_id, position_id)
        schedules = await self._work_item_store.get_schedules(user_id, org_id)
        followups = await self._work_item_store.get_followups(user_id, org_id)
        parts = []
        if priorities:
            parts.append("今日优先事项: " + "; ".join(p["title"] for p in priorities[:5]))
        if schedules:
            parts.append("今日日程: " + "; ".join(
                f"{s['title']}({s.get('scheduled_time', '')})" for s in schedules[:5]))
        if followups:
            parts.append("待跟进: " + "; ".join(f["title"] for f in followups[:5]))
        return "\n".join(parts)

    async def _collect_signals(self, content: str, user_id: str, org_id: str, position_id: str) -> None:
        """从用户消息中用规则提取信号。"""
        if not self._signal_store or not content:
            return
        import re
        # 偏好信号
        _pref_kw = ("以后", "每次", "总是", "不要", "记住", "偏好", "默认", "别再", "改成", "换成")
        if any(kw in content for kw in _pref_kw) and len(content) < 500:
            await self._signal_store.add_signal(
                user_id, org_id, position_id,
                signal_type="preference", content=content[:200], source="chat")
        # 话题信号
        if len(content) > 10:
            topics = re.findall(r'[\u4e00-\u9fff]{2,6}', content)
            if topics:
                await self._signal_store.add_signal(
                    user_id, org_id, position_id,
                    signal_type="topic", content=max(topics, key=len), source="chat")

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
