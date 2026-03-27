"""
AgentForge V2 — Agent 运行时

核心执行引擎：接收 Mission，构建上下文，调用 LLM，
处理工具调用（ReAct 循环），返回 MissionResult。

职责单一：只做 LLM ↔ Tool 的交互循环。
不涉及路由、配置加载、记忆存储（由 ForgeEngine 编排）。
"""

from __future__ import annotations

import logging
import re
import time
import uuid
from typing import Any, AsyncIterator

from core.models import (
    ContextResult, LLMResponse, Mission, MissionResult, StepResult,
)

logger = logging.getLogger(__name__)

MAX_TOOL_LOOPS = 10
MAX_CONTINUATION_NUDGES = 2
_SHORT_REPLY_THRESHOLD = 120

_CONTINUATION_NUDGE = (
    "请检查你是否已经完成了用户要求的全部任务。"
    "如果还有未执行的步骤，请继续使用工具完成。"
    "如果已全部完成，请输出最终结果。"
)

_PREMATURE_PATTERNS = [
    re.compile(r'^(好的|接下来|现在|下一步|然后|我来|让我)', re.M),
    re.compile(r'(以下是|如下|步骤如下|流程如下)[:：]?\s*$', re.M),
]

_ERROR_PREFIXES = ("执行错误:", "执行超时", "工具执行出错:", "未找到工具", "错误:", "Error:", "Traceback")
MAX_CONSECUTIVE_FAILURES = 2

_RETHINK_NUDGE = (
    "你连续 {n} 次工具调用都失败了。失败详情:\n{errors}\n\n"
    "请停下来分析根本原因，换一个完全不同的方案来解决。"
)


def _looks_premature(content: str) -> bool:
    """判断 LLM 回复是否像提前中断。"""
    text = (content or "").strip()
    if len(text) < _SHORT_REPLY_THRESHOLD:
        return True
    if len(text) < 300:
        for p in _PREMATURE_PATTERNS:
            if p.search(text):
                return True
    if text and text[-1] in (':', '：', '…', '、'):
        return True
    return False


class _ErrorTracker:
    """追踪连续工具调用失败。"""

    def __init__(self):
        self._consecutive = 0
        self._errors: list[str] = []

    def record(self, tool_results: list[dict]) -> bool:
        all_failed = all(
            any(r.get("result", "").startswith(p) for p in _ERROR_PREFIXES)
            for r in tool_results
        ) if tool_results else False

        if all_failed:
            self._consecutive += 1
            for r in tool_results:
                self._errors.append(f"  {r.get('name', '?')}: {r.get('result', '')[:200]}")
            return self._consecutive >= MAX_CONSECUTIVE_FAILURES
        else:
            self._consecutive = 0
            self._errors.clear()
            return False

    def get_message(self) -> str:
        return _RETHINK_NUDGE.format(n=self._consecutive, errors="\n".join(self._errors[-6:]))


class AgentRuntime:
    """
    Agent 运行时 — ReAct 循环执行器。

    用法:
        runtime = AgentRuntime(llm_client, tool_registry)
        result = await runtime.execute(mission, context)
    """

    def __init__(self, llm_client, tool_registry=None, guardrails: dict | None = None):
        self._llm = llm_client
        self._tools = tool_registry
        self._user_context: dict = {}
        g = guardrails or {}
        self._pre_guard = g.get("pre_tool")
        self._exec_guard = g.get("execution")
        self._audit = g.get("audit")
        self._log_collector = g.get("log")

    async def execute(self, mission: Mission, context: ContextResult) -> MissionResult:
        """执行任务：LLM 调用 → 工具循环 → 续问 → 返回结果。"""
        self._user_context = mission.context
        start = time.time()
        steps: list[StepResult] = []
        total_tokens = 0
        model_used = ""

        try:
            tools = self._get_tools(mission)
            messages = list(context.messages)

            # 首次 LLM 调用
            response = await self._llm.chat(
                system=context.system_prompt,
                messages=messages,
                tools=tools,
                temperature=0.7,
                max_tokens=mission.constraints.get("max_tokens", 4096),
                model_override=mission.force_model,
            )
            model_used = response.model
            total_tokens += response.total_tokens
            content = response.content
            steps.append(self._make_step(response))

            # 工具调用循环
            content, extra_tokens = await self._tool_loop(
                context.system_prompt, messages, content, response, tools, steps, mission,
            )
            total_tokens += extra_tokens

            # 续问机制
            if steps[-1].tool_calls == [] and len(steps) > 1 and _looks_premature(content):
                content, nudge_tokens = await self._nudge_continuation(
                    context.system_prompt, messages, content, tools, steps,
                )
                total_tokens += nudge_tokens

            duration = time.time() - start
            logger.info("任务完成: mission=%s tokens=%d duration=%.1fs", mission.id, total_tokens, duration)

            return MissionResult(
                mission_id=mission.id, status="completed", content=content,
                steps=steps, tokens_used=total_tokens,
                duration=duration, model_used=model_used,
            )

        except Exception as e:
            logger.error("任务失败: mission=%s error=%s", mission.id, e, exc_info=True)
            return MissionResult(
                mission_id=mission.id, status="failed", content=f"执行失败: {e}",
                steps=steps, tokens_used=total_tokens,
                duration=time.time() - start, model_used=model_used,
            )

    async def execute_stream(self, mission: Mission, context: ContextResult) -> AsyncIterator[dict]:
        """流式执行：逐 token 返回 + 工具调用循环。

        每轮：LLM stream → 收集文本+工具调用 → 执行工具 → 注入结果 → 再 stream。
        """
        self._user_context = mission.context
        tools = self._get_tools(mission)
        messages = list(context.messages)
        full_content = ""
        model_used = ""
        tracker = _ErrorTracker()

        lc = self._log_collector
        if lc:
            lc.info("llm", "stream_execute_start", f"开始流式执行: mission={mission.id}",
                    data={"tools": [t["name"] for t in (tools or [])]},
                    user_id=mission.user_id, session_id=mission.session_id or "")

        for loop in range(MAX_TOOL_LOOPS + 1):
            round_content = ""
            round_tool_calls: list[dict] = []
            stop_reason = ""

            async for chunk in self._llm.stream(
                system=context.system_prompt, messages=messages,
                tools=tools, temperature=0.7,
                max_tokens=mission.constraints.get("max_tokens", 4096),
            ):
                ct = chunk.get("type", "")
                if ct == "text":
                    round_content += chunk["text"]
                    yield chunk
                elif ct == "tool_call":
                    round_tool_calls.append(chunk)
                elif ct == "message_done":
                    stop_reason = chunk.get("stop_reason", "")
                    if chunk.get("model"):
                        model_used = chunk["model"]

            full_content = round_content

            if not round_tool_calls or stop_reason not in ("tool_use", "tool_calls"):
                break

            logger.info("流式工具循环 #%d: %s", loop + 1, [tc["name"] for tc in round_tool_calls])

            # ★ 立即通知前端：即将执行工具（消除空白等待期）
            first = round_tool_calls[0]["name"] if round_tool_calls else ""
            _TL = {"document_converter": "🔄 正在转换文档...", "web_search": "🌐 正在搜索...",
                    "word_processor": "📄 正在生成文档...", "excel_processor": "📗 正在处理 Excel...",
                    "search_knowledge": "📚 正在搜索知识库...", "manage_priority": "✅ 正在处理待办...",
                    "manage_schedule": "📅 正在处理日程...", "code_executor": "💻 正在执行代码...",
                    "calculator": "🔢 正在计算...", "chart_generator": "📈 正在生成图表..."}
            yield {"type": "thinking", "content": _TL.get(first, f"🔧 正在执行 {first}...")}

            # 逐个执行：start → execute → result（用户实时看到进度）
            tool_results = []
            for tc in round_tool_calls:
                yield {"type": "tool_start", "name": tc["name"], "arguments": tc.get("arguments", {})}
                tr = await self._execute_single_tool(tc)
                tool_results.append(tr)
                yield {"type": "tool_result", "name": tr["name"], "result": tr["result"]}
            needs_rethink = tracker.record(tool_results)

            # 注入工具结果到 messages 供下一轮 LLM
            messages.append({"role": "assistant", "content": round_content or ""})
            for tr in tool_results:
                messages.append({"role": "user", "content": f"[工具 {tr['name']} 结果]\n{tr['result']}"})
            if needs_rethink:
                messages.append({"role": "user", "content": tracker.get_message()})

        yield {"type": "done", "mission_id": mission.id, "tokens_used": 0, "model": model_used}

    # ── 工具循环 ──────────────────────────────────────────

    async def _tool_loop(
        self, system: str, messages: list[dict], content: str,
        response, tools, steps: list[StepResult], mission: Mission,
    ) -> tuple[str, int]:
        """ReAct 工具循环，返回 (最终内容, 消耗tokens)。"""
        total_tokens = 0
        loop_count = 0
        tracker = _ErrorTracker()

        while response.tool_calls and loop_count < MAX_TOOL_LOOPS:
            loop_count += 1
            logger.info("工具循环 #%d: %s", loop_count, [tc["name"] for tc in response.tool_calls])

            tool_results = await self._execute_tools(response.tool_calls)
            needs_rethink = tracker.record(tool_results)

            messages.append({"role": "assistant", "content": content or ""})
            for tr in tool_results:
                messages.append({
                    "role": "user",
                    "content": f"[工具 {tr['name']} 结果]\n{tr['result']}",
                })

            if needs_rethink:
                messages.append({"role": "user", "content": tracker.get_message()})

            response = await self._llm.chat(
                system=system, messages=messages, tools=tools,
                temperature=0.7, max_tokens=mission.constraints.get("max_tokens", 4096),
            )
            total_tokens += response.total_tokens
            content = response.content
            steps.append(self._make_step(response))

        return content, total_tokens

    async def _nudge_continuation(
        self, system: str, messages: list[dict], content: str,
        tools, steps: list[StepResult],
    ) -> tuple[str, int]:
        """续问机制，返回 (最终内容, 消耗tokens)。"""
        total_tokens = 0
        for _ in range(MAX_CONTINUATION_NUDGES):
            messages.append({"role": "assistant", "content": content})
            messages.append({"role": "user", "content": _CONTINUATION_NUDGE})
            response = await self._llm.chat(
                system=system, messages=messages, tools=tools,
                temperature=0.7, max_tokens=4096,
            )
            total_tokens += response.total_tokens
            content = response.content or ""
            steps.append(self._make_step(response))
            if not _looks_premature(content):
                break
        return content, total_tokens

    async def _execute_single_tool(self, tc: dict) -> dict:
        """执行单个工具调用（带护栏）。"""
        name = tc.get("name", ""); args = tc.get("arguments", {}); start = time.time(); guard_action = "passed"
        if self._tools and self._user_context:
            td = self._tools.get(name)
            if td and td.category == "workstation":
                for k in ("user_id", "org_id", "position_id"): args.setdefault(k, self._user_context.get(k, ""))
        if self._pre_guard:
            check = self._pre_guard.check(name, args, self._user_context)
            if check.modified_args: args = check.modified_args
            if check.blocked:
                self._log_audit(name, args, "blocked", "blocked", time.time() - start)
                return {"tool_call_id": tc.get("id", ""), "name": name, "result": f"操作被安全护栏拦截: {check.reason}"}
            if check.needs_confirmation: guard_action = "auto_confirmed"
        handler = self._tools.get_handler(name) if self._tools else None
        if handler:
            result = await self._exec_guard.execute(handler, args, name) if self._exec_guard else await self._try_handler(handler, args)
        else:
            result = f"未找到工具: {name}"
        dur = time.time() - start
        status = "error" if str(result).startswith(("执行错误", "未找到工具", "操作被安全", "工具")) else "success"
        self._log_audit(name, args, status, guard_action, dur)
        return {"tool_call_id": tc.get("id", ""), "name": name, "result": result}

    @staticmethod
    async def _try_handler(handler, args):
        try: return await handler(args)
        except Exception as e: return f"执行错误: {e}"

    async def _execute_tools(self, tool_calls: list[dict]) -> list[dict]:
        """执行工具调用列表。"""
        return [await self._execute_single_tool(tc) for tc in tool_calls]

    def _log_audit(self, name, args, status, action, dur):
        if self._audit:
            self._audit.record(user_id=self._user_context.get("user_id", ""),
                tool_name=name, args=args, result_status=status, guard_action=action, duration=dur)

    def _get_tools(self, mission: Mission) -> list[dict] | None:
        """获取任务的工具列表。所有内置工具对所有岗位可用。"""
        if not self._tools:
            return None
        tools = self._tools.get_all_tools_for_llm()
        return tools if tools else None

    @staticmethod
    def _make_step(response: LLMResponse) -> StepResult:
        return StepResult(
            step_id=f"step-{uuid.uuid4().hex[:8]}",
            content=response.content,
            tokens_used=response.total_tokens,
            model=response.model,
            duration=response.duration,
            tool_calls=response.tool_calls,
        )
