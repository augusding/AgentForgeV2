"""AgentForge V2 — Guardrails 安全护栏：工具调用前检查 + 执行约束 + 审计日志。"""

from __future__ import annotations

import asyncio
import logging
import re
import time
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class GuardResult:
    passed: bool = True
    blocked: bool = False
    needs_confirmation: bool = False
    reason: str = ""
    modified_args: dict | None = None


# ── 风险分级 ──

RISK_LEVELS: dict[str, list[str]] = {
    "safe": ["calculator", "datetime", "text_processor", "search_knowledge", "web_search"],
    "write": ["manage_priority", "manage_schedule", "manage_followup", "manage_work_item",
              "excel_processor", "word_processor", "pdf_processor", "ppt_processor"],
    "external": ["email_sender", "http_request"],
    "dangerous": ["code_executor", "shell_executor"],
}
_TOOL_RISK: dict[str, str] = {}
for _lv, _tools in RISK_LEVELS.items():
    for _t in _tools:
        _TOOL_RISK[_t] = _lv


def get_risk_level(tool_name: str) -> str:
    return _TOOL_RISK.get(tool_name, "external")


# ── H2: PreToolGuard ──

class PreToolGuard:
    """工具调用前安全检查。"""

    def __init__(self):
        self._call_counts: dict[str, list[float]] = {}

    def check(self, tool_name: str, args: dict, user_ctx: dict) -> GuardResult:
        risk = get_risk_level(tool_name)

        # 作用域强制：workstation 工具必须用当前用户
        if tool_name.startswith("manage_"):
            for k in ("user_id", "org_id", "position_id"):
                if k in user_ctx:
                    args[k] = user_ctx[k]

        # 删除操作
        if str(args.get("action", "")) == "delete":
            return GuardResult(passed=False, needs_confirmation=True,
                reason=f"AI 要删除数据（工具: {tool_name}）", modified_args=args)

        # 高危工具
        if risk == "dangerous":
            preview = str(args.get("code", args.get("command", "")))[:100]
            return GuardResult(passed=False, needs_confirmation=True,
                reason=f"AI 要执行{'代码' if 'code' in tool_name else '命令'}：{preview}", modified_args=args)

        # 邮件确认
        if tool_name == "email_sender":
            return GuardResult(passed=False, needs_confirmation=True,
                reason=f"AI 要发邮件给 {args.get('to', '')}，主题：{args.get('subject', '')}", modified_args=args)

        # 频率限制：1 分钟 10 次
        now = time.time()
        self._call_counts.setdefault(tool_name, [])
        self._call_counts[tool_name] = [t for t in self._call_counts[tool_name] if now - t < 60]
        if len(self._call_counts[tool_name]) >= 10:
            return GuardResult(blocked=True, passed=False, reason=f"工具 {tool_name} 调用过频（>10次/分钟）")
        self._call_counts[tool_name].append(now)

        # 参数验证
        err = self._validate(tool_name, args)
        if err:
            return GuardResult(blocked=True, passed=False, reason=err)

        return GuardResult(passed=True, modified_args=args)

    @staticmethod
    def _validate(tool_name: str, args: dict) -> str:
        if tool_name == "email_sender":
            to = args.get("to", "")
            if to and not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', to):
                return f"邮箱格式不正确: {to}"
        for key in ("path", "file_path", "connection"):
            val = str(args.get(key, ""))
            if val and (".." in val or val.startswith("/")):
                return f"不允许的路径: {val}"
        if tool_name == "http_request":
            url = args.get("url", "")
            if url and not url.startswith(("http://", "https://")):
                return f"URL 必须以 http(s):// 开头: {url}"
        return ""


# ── H3: ExecutionGuard ──

class ExecutionGuard:
    """工具执行约束：超时 + 输出截断。"""

    MAX_OUTPUT = 10240
    TIMEOUTS: dict[str, int] = {
        "code_executor": 10, "shell_executor": 10, "web_search": 15,
        "http_request": 30, "email_sender": 15, "excel_processor": 30,
    }

    async def execute(self, handler, args: dict, tool_name: str) -> str:
        timeout = self.TIMEOUTS.get(tool_name, 30)
        try:
            result = await asyncio.wait_for(handler(args), timeout=timeout)
        except asyncio.TimeoutError:
            return f"工具 {tool_name} 执行超时（{timeout}s 限制）"
        except Exception as e:
            return f"执行错误: {e}"
        s = str(result)
        if len(s) > self.MAX_OUTPUT:
            s = s[:self.MAX_OUTPUT] + f"\n...(截断，原始 {len(str(result))} 字符)"
        return s


# ── 审计日志 ──

class AuditLogger:
    """工具调用审计日志。"""

    def __init__(self):
        self._logs: list[dict] = []

    def record(self, user_id: str, tool_name: str, args: dict,
               result_status: str, guard_action: str, duration: float = 0, session_id: str = "") -> None:
        self._logs.append({
            "timestamp": time.time(), "user_id": user_id, "tool_name": tool_name,
            "args_summary": self._sanitize(args), "result_status": result_status,
            "guard_action": guard_action, "duration": round(duration, 3), "session_id": session_id,
        })
        if len(self._logs) > 1000:
            self._logs = self._logs[-500:]
        logger.info("AUDIT: user=%s tool=%s guard=%s status=%s dur=%.2fs", user_id, tool_name, guard_action, result_status, duration)

    def get_recent(self, limit: int = 50) -> list[dict]:
        return list(reversed(self._logs[-limit:]))

    @staticmethod
    def _sanitize(args: dict) -> dict:
        sens = {"api_key", "password", "token", "secret", "key"}
        out = {}
        for k, v in args.items():
            if any(s in k.lower() for s in sens):
                out[k] = "***"
            elif isinstance(v, str) and len(v) > 200:
                out[k] = v[:200] + "..."
            else:
                out[k] = v
        return out
