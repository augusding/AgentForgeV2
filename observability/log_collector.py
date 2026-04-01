"""
AgentForge V2 — 结构化日志收集器

环形缓冲区 + SQLite 持久化，按类别/级别过滤。
"""

from __future__ import annotations

import json
import logging
import time
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import aiosqlite

logger = logging.getLogger(__name__)

LEVELS = {"DEBUG", "INFO", "WARN", "ERROR"}
CATEGORIES = {"pipeline", "tool", "guard", "file", "llm", "system"}


@dataclass
class LogEntry:
    timestamp: float
    level: str                       # DEBUG / INFO / WARN / ERROR
    category: str                    # pipeline / tool / guard / file / llm / system
    event: str
    message: str
    data: dict = field(default_factory=dict)
    user_id: str = ""
    session_id: str = ""
    request_id: str = ""
    duration: float | None = None


class LogCollector:
    """结构化日志收集器：环形缓冲区 + 可选 SQLite 持久化。"""

    def __init__(self, max_entries: int = 2000, db_path: str = ""):
        self._buf: deque[LogEntry] = deque(maxlen=max_entries)
        self._db_path = db_path
        if db_path:
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    # ── 写入 ────────────────────────────────────────────────

    def log(
        self,
        level: str,
        category: str,
        event: str,
        message: str,
        data: dict | None = None,
        user_id: str = "",
        session_id: str = "",
        request_id: str = "",
        duration: float | None = None,
    ) -> None:
        entry = LogEntry(
            timestamp=time.time(),
            level=level.upper(),
            category=category,
            event=event,
            message=message,
            data=data or {},
            user_id=user_id,
            session_id=session_id,
            request_id=request_id,
            duration=duration,
        )
        self._buf.append(entry)
        if self._db_path:
            import asyncio
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.ensure_future(self._write_db(entry))
            except RuntimeError:
                pass

    def info(self, category: str, event: str, message: str, **kw) -> None:
        self.log("INFO", category, event, message, **kw)

    def warn(self, category: str, event: str, message: str, **kw) -> None:
        self.log("WARN", category, event, message, **kw)

    def error(self, category: str, event: str, message: str, **kw) -> None:
        self.log("ERROR", category, event, message, **kw)

    def debug(self, category: str, event: str, message: str, **kw) -> None:
        self.log("DEBUG", category, event, message, **kw)

    # ── 查询 ────────────────────────────────────────────────

    def get_recent(
        self,
        limit: int = 100,
        category: str = "",
        level: str = "",
    ) -> list[dict]:
        """从内存环形缓冲区获取最近日志。"""
        entries = list(self._buf)
        if category:
            entries = [e for e in entries if e.category == category]
        if level:
            entries = [e for e in entries if e.level == level.upper()]
        entries = entries[-limit:]
        entries.reverse()
        return [_to_dict(e) for e in entries]

    async def get_from_db(
        self,
        limit: int = 100,
        category: str = "",
        level: str = "",
    ) -> list[dict]:
        """从 SQLite 获取日志。"""
        if not self._db_path:
            return self.get_recent(limit, category, level)
        query = "SELECT * FROM system_logs"
        params: list[Any] = []
        filters: list[str] = []
        if category:
            filters.append("category = ?")
            params.append(category)
        if level:
            filters.append("level = ?")
            params.append(level.upper())
        if filters:
            query += " WHERE " + " AND ".join(filters)
        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)
        try:
            async with aiosqlite.connect(self._db_path) as db:
                db.row_factory = aiosqlite.Row
                cursor = await db.execute(query, params)
                rows = await cursor.fetchall()
                return [
                    {
                        "timestamp": r["timestamp"],
                        "level": r["level"],
                        "category": r["category"],
                        "event": r["event"],
                        "message": r["message"],
                        "data": json.loads(r["data"] or "{}"),
                        "user_id": r["user_id"] or "",
                        "session_id": r["session_id"] or "",
                        "duration": r["duration"],
                    }
                    for r in rows
                ]
        except Exception as e:
            logger.warning("日志DB查询失败: %s", e)
            return self.get_recent(limit, category, level)

    async def ensure_table(self) -> None:
        """创建 system_logs 表（如不存在）。"""
        if not self._db_path:
            return
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS system_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp REAL NOT NULL,
                    level TEXT NOT NULL,
                    category TEXT NOT NULL,
                    event TEXT NOT NULL,
                    message TEXT NOT NULL,
                    data TEXT DEFAULT '{}',
                    user_id TEXT DEFAULT '',
                    session_id TEXT DEFAULT '',
                    duration REAL
                )
            """)
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_syslog_ts ON system_logs(timestamp DESC)"
            )
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_syslog_cat ON system_logs(category, timestamp DESC)"
            )
            try: await db.execute("ALTER TABLE system_logs ADD COLUMN request_id TEXT DEFAULT ''")
            except Exception: pass
            await db.commit()

    # ── 内部 ────────────────────────────────────────────────

    async def _write_db(self, entry: LogEntry) -> None:
        try:
            async with aiosqlite.connect(self._db_path) as db:
                await db.execute(
                    "INSERT INTO system_logs "
                    "(timestamp, level, category, event, message, data, user_id, session_id, request_id, duration) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        entry.timestamp, entry.level, entry.category,
                        entry.event, entry.message,
                        json.dumps(entry.data, ensure_ascii=False, default=str),
                        entry.user_id, entry.session_id, entry.request_id, entry.duration,
                    ),
                )
                await db.commit()
        except Exception as e:
            logger.debug("日志持久化失败: %s", e)


def _to_dict(e: LogEntry) -> dict:
    return {
        "timestamp": e.timestamp,
        "level": e.level,
        "category": e.category,
        "event": e.event,
        "message": e.message,
        "data": e.data,
        "user_id": e.user_id,
        "session_id": e.session_id,
        "duration": e.duration,
    }
