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
    """工具调用审计日志。内存 + 可选 SQLite 持久化。"""

    def __init__(self, db_path: str = ""):
        self._logs: list[dict] = []
        self._db_path = db_path

    async def ensure_table(self) -> None:
        if not self._db_path:
            return
        try:
            import aiosqlite
            async with aiosqlite.connect(self._db_path) as db:
                await db.execute("""CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp REAL, user_id TEXT DEFAULT '',
                    tool_name TEXT DEFAULT '', args_summary TEXT DEFAULT '{}',
                    result_status TEXT DEFAULT '', guard_action TEXT DEFAULT '',
                    duration REAL DEFAULT 0, session_id TEXT DEFAULT '')""")
                await db.commit()
        except Exception as e:
            logger.warning("审计表创建失败: %s", e)

    def record(self, user_id: str, tool_name: str, args: dict,
               result_status: str, guard_action: str, duration: float = 0, session_id: str = "") -> None:
        import json as _json
        entry = {"timestamp": time.time(), "user_id": user_id, "tool_name": tool_name,
                 "args_summary": self._sanitize(args), "result_status": result_status,
                 "guard_action": guard_action, "duration": round(duration, 3), "session_id": session_id}
        self._logs.append(entry)
        if len(self._logs) > 1000:
            self._logs = self._logs[-500:]
        logger.info("AUDIT: user=%s tool=%s guard=%s status=%s dur=%.2fs", user_id, tool_name, guard_action, result_status, duration)
        if self._db_path:
            try:
                import asyncio
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.create_task(self._write_db(entry))
            except RuntimeError:
                pass

    async def _write_db(self, entry: dict) -> None:
        try:
            import aiosqlite, json as _json
            async with aiosqlite.connect(self._db_path) as db:
                await db.execute(
                    "INSERT INTO audit_logs (timestamp,user_id,tool_name,args_summary,result_status,guard_action,duration,session_id) VALUES (?,?,?,?,?,?,?,?)",
                    (entry["timestamp"], entry["user_id"], entry["tool_name"],
                     _json.dumps(entry["args_summary"], ensure_ascii=False),
                     entry["result_status"], entry["guard_action"], entry["duration"], entry["session_id"]))
                await db.commit()
        except Exception as e:
            logger.warning("审计写库失败: %s", e)

    def get_recent(self, limit: int = 50) -> list[dict]:
        return list(reversed(self._logs[-limit:]))

    async def get_recent_from_db(self, limit: int = 50, user_id: str = "") -> list[dict]:
        if not self._db_path:
            return self.get_recent(limit)
        try:
            import aiosqlite, json as _json
            async with aiosqlite.connect(self._db_path) as db:
                db.row_factory = aiosqlite.Row
                q = "SELECT * FROM audit_logs"
                p: list = []
                if user_id:
                    q += " WHERE user_id = ?"; p.append(user_id)
                q += " ORDER BY timestamp DESC LIMIT ?"; p.append(limit)
                cur = await db.execute(q, p)
                return [{**dict(r), "args_summary": _json.loads(r["args_summary"] or "{}")} for r in await cur.fetchall()]
        except Exception:
            return self.get_recent(limit)

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


# ── H5: 系统护栏 + H1: 输入护栏 ──

class SystemGuard:
    """系统级资源控制：Token 预算、请求频率、输入检查。"""

    def __init__(self, max_tokens_per_session: int = 50000, max_requests_per_day: int = 200, max_input_length: int = 50000, token_tracker=None):
        self.max_tokens_per_session = max_tokens_per_session
        self.max_requests_per_day = max_requests_per_day
        self.max_input_length = max_input_length
        self._daily_counts: dict[str, list[float]] = {}
        self._token_tracker = token_tracker

    async def check_budget_async(self, user_id: str, session_tokens: int = 0) -> GuardResult:
        """优先用 TokenTracker 真实数据检查预算。"""
        if self._token_tracker:
            try:
                daily = await self._token_tracker.get_daily_usage(user_id=user_id)
                if daily.get("total_tokens", 0) >= 500_000:
                    return GuardResult(blocked=True, passed=False,
                        reason=f"今日 Token 用量已达上限（{daily['total_tokens']:,} / 500,000）。")
            except Exception:
                pass
        return self.check_budget(user_id, session_tokens)

    def check_budget(self, user_id: str, session_tokens: int = 0) -> GuardResult:
        if session_tokens > self.max_tokens_per_session:
            return GuardResult(blocked=True, passed=False,
                reason=f"本次对话已消耗 {session_tokens:,} tokens，超过上限 {self.max_tokens_per_session:,}。请开启新对话。")
        now = time.time()
        today_start = now - (now % 86400)
        self._daily_counts.setdefault(user_id, [])
        self._daily_counts[user_id] = [t for t in self._daily_counts[user_id] if t > today_start]
        if len(self._daily_counts[user_id]) >= self.max_requests_per_day:
            return GuardResult(blocked=True, passed=False,
                reason=f"今日对话次数已达上限（{self.max_requests_per_day} 次）。")
        self._daily_counts[user_id].append(now)
        return GuardResult(passed=True)

    def check_input(self, content: str) -> GuardResult:
        if not content or not content.strip():
            return GuardResult(blocked=True, passed=False, reason="消息不能为空")
        if len(content) > self.max_input_length:
            return GuardResult(blocked=True, passed=False,
                reason=f"消息过长（{len(content):,} 字符），请控制在 {self.max_input_length:,} 字符以内。")
        _inj = [r"忽略(以上|上面|之前|所有)(的)?(指令|规则|设定)", r"(ignore|forget|disregard).*(instructions|rules|prompt)",
                r"<\/?system>", r"(system|admin)\s*prompt"]
        for p in _inj:
            if re.search(p, content, re.I):
                logger.warning("检测到可能的 Prompt 注入: %s", content[:100])
                break
        return GuardResult(passed=True)
