"""
AgentForge V2 — 会话存储

管理对话历史：创建会话、追加消息、检索历史、截断。
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any
from uuid import uuid4

from memory.base import BaseStore

logger = logging.getLogger(__name__)


class SessionStore(BaseStore):
    """对话会话 + 消息历史存储。"""

    async def _create_tables(self, db) -> None:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY, user_id TEXT NOT NULL DEFAULT '',
                org_id TEXT NOT NULL DEFAULT '', position_id TEXT NOT NULL DEFAULT '',
                title TEXT DEFAULT '', created_at REAL NOT NULL, updated_at REAL NOT NULL,
                metadata TEXT DEFAULT '{}'
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY, session_id TEXT NOT NULL, role TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '', tool_calls TEXT DEFAULT '[]',
                tool_results TEXT DEFAULT '[]', tokens_used INTEGER DEFAULT 0,
                model TEXT DEFAULT '', created_at REAL NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            )
        """)
        await db.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, org_id)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at)")

    async def create_session(self, user_id: str, org_id: str = "", position_id: str = "", title: str = "") -> str:
        await self.ensure_tables()
        session_id = uuid4().hex[:12]
        now = time.time()
        async with self._db() as db:
            await db.execute(
                "INSERT INTO sessions (id, user_id, org_id, position_id, title, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (session_id, user_id, org_id, position_id, title, now, now))
            await db.commit()
        return session_id

    async def get_session(self, session_id: str) -> dict | None:
        await self.ensure_tables()
        async with self._db() as db:
            cursor = await db.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def list_sessions(self, user_id: str, org_id: str = "", position_id: str = "", limit: int = 20) -> list[dict]:
        await self.ensure_tables()
        query = "SELECT * FROM sessions WHERE user_id = ?"
        params: list[Any] = [user_id]
        if org_id:
            query += " AND org_id = ?"; params.append(org_id)
        if position_id:
            query += " AND position_id = ?"; params.append(position_id)
        query += " ORDER BY updated_at DESC LIMIT ?"
        params.append(limit)
        async with self._db() as db:
            cursor = await db.execute(query, params)
            return [dict(r) for r in await cursor.fetchall()]

    async def update_session_title(self, session_id: str, title: str) -> None:
        async with self._db() as db:
            await db.execute("UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?", (title, time.time(), session_id))
            await db.commit()

    async def delete_session(self, session_id: str) -> None:
        async with self._db() as db:
            await db.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
            await db.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
            await db.commit()

    async def add_message(self, session_id: str, role: str, content: str,
                          tool_calls: list[dict] | None = None, tool_results: list[dict] | None = None,
                          tokens_used: int = 0, model: str = "") -> str:
        await self.ensure_tables()
        msg_id = uuid4().hex[:12]
        async with self._db() as db:
            await db.execute(
                "INSERT INTO messages (id, session_id, role, content, tool_calls, tool_results, "
                "tokens_used, model, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (msg_id, session_id, role, content,
                 json.dumps(tool_calls or [], ensure_ascii=False),
                 json.dumps(tool_results or [], ensure_ascii=False),
                 tokens_used, model, time.time()))
            await db.execute("UPDATE sessions SET updated_at = ? WHERE id = ?", (time.time(), session_id))
            await db.commit()
        return msg_id

    async def get_history(self, session_id: str, limit: int = 20, before: float | None = None) -> list[dict]:
        await self.ensure_tables()
        query = "SELECT * FROM messages WHERE session_id = ?"
        params: list[Any] = [session_id]
        if before:
            query += " AND created_at < ?"; params.append(before)
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        async with self._db() as db:
            cursor = await db.execute(query, params)
            rows = await cursor.fetchall()
        messages = [dict(r) for r in rows]
        messages.reverse()
        for msg in messages:
            msg["tool_calls"] = json.loads(msg.get("tool_calls", "[]"))
            msg["tool_results"] = json.loads(msg.get("tool_results", "[]"))
        return messages

    async def get_history_as_llm_messages(self, session_id: str, limit: int = 20) -> list[dict]:
        history = await self.get_history(session_id, limit=limit)
        return [{"role": m["role"], "content": m["content"]} for m in history if m["role"] in ("user", "assistant")]

    async def count_messages(self, session_id: str) -> int:
        await self.ensure_tables()
        async with self._db() as db:
            cursor = await db.execute("SELECT COUNT(*) FROM messages WHERE session_id = ?", (session_id,))
            row = await cursor.fetchone()
            return row[0] if row else 0
