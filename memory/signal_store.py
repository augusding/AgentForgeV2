"""
AgentForge V2 — 信号存储

管理信号采集、模式凝练、洞察生成的持久化。
"""

from __future__ import annotations

import logging
import time
from typing import Any
from uuid import uuid4

from memory.base import BaseStore

logger = logging.getLogger(__name__)


class SignalStore(BaseStore):

    async def _create_tables(self, db) -> None:
        await db.execute("CREATE TABLE IF NOT EXISTS signals (id TEXT PRIMARY KEY, user_id TEXT DEFAULT '', org_id TEXT DEFAULT '', position_id TEXT DEFAULT '', signal_type TEXT NOT NULL, content TEXT NOT NULL, source TEXT DEFAULT '', created_at REAL NOT NULL)")
        await db.execute("CREATE TABLE IF NOT EXISTS patterns (id TEXT PRIMARY KEY, user_id TEXT DEFAULT '', org_id TEXT DEFAULT '', position_id TEXT DEFAULT '', pattern_type TEXT NOT NULL, description TEXT NOT NULL, confidence REAL DEFAULT 0.0, occurrence_count INTEGER DEFAULT 1, created_at REAL NOT NULL, updated_at REAL NOT NULL)")
        await db.execute("CREATE TABLE IF NOT EXISTS insights (id TEXT PRIMARY KEY, user_id TEXT DEFAULT '', org_id TEXT DEFAULT '', position_id TEXT DEFAULT '', insight_type TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, priority TEXT DEFAULT 'normal', is_read INTEGER DEFAULT 0, created_at REAL NOT NULL)")

    async def add_signal(self, user_id: str, org_id: str, position_id: str, signal_type: str, content: str, source: str = "") -> str:
        await self.ensure_tables()
        sid = uuid4().hex[:12]
        async with self._db() as db:
            await db.execute("INSERT INTO signals VALUES (?,?,?,?,?,?,?,?)", (sid, user_id, org_id, position_id, signal_type, content, source, time.time()))
            await db.commit()
        return sid

    async def get_recent_signals(self, user_id: str, org_id: str, position_id: str = "", limit: int = 20, signal_type: str = "") -> list[dict]:
        await self.ensure_tables()
        query = "SELECT * FROM signals WHERE user_id = ? AND org_id = ?"
        params: list[Any] = [user_id, org_id]
        if position_id: query += " AND position_id = ?"; params.append(position_id)
        if signal_type: query += " AND signal_type = ?"; params.append(signal_type)
        query += " ORDER BY created_at DESC LIMIT ?"; params.append(limit)
        async with self._db() as db:
            cursor = await db.execute(query, params)
            return [dict(r) for r in await cursor.fetchall()]

    async def upsert_pattern(self, user_id: str, org_id: str, position_id: str, pattern_type: str, description: str, confidence: float = 0.5) -> str:
        await self.ensure_tables()
        now = time.time()
        async with self._db() as db:
            cursor = await db.execute("SELECT id, occurrence_count FROM patterns WHERE user_id=? AND org_id=? AND position_id=? AND pattern_type=? AND description=?", (user_id, org_id, position_id, pattern_type, description))
            existing = await cursor.fetchone()
            if existing:
                pid = existing["id"]
                await db.execute("UPDATE patterns SET occurrence_count=occurrence_count+1, confidence=MIN(1.0,confidence+0.05), updated_at=? WHERE id=?", (now, pid))
            else:
                pid = uuid4().hex[:12]
                await db.execute("INSERT INTO patterns VALUES (?,?,?,?,?,?,?,1,?,?)", (pid, user_id, org_id, position_id, pattern_type, description, confidence, now, now))
            await db.commit()
        return pid

    async def get_patterns(self, user_id: str, org_id: str, position_id: str = "", limit: int = 10) -> list[dict]:
        await self.ensure_tables()
        query = "SELECT * FROM patterns WHERE user_id=? AND org_id=?"
        params: list[Any] = [user_id, org_id]
        if position_id: query += " AND position_id=?"; params.append(position_id)
        query += " ORDER BY confidence DESC LIMIT ?"; params.append(limit)
        async with self._db() as db:
            cursor = await db.execute(query, params)
            return [dict(r) for r in await cursor.fetchall()]

    async def add_insight(self, user_id: str, org_id: str, position_id: str, insight_type: str, title: str, content: str, priority: str = "normal") -> str:
        await self.ensure_tables()
        iid = uuid4().hex[:12]
        async with self._db() as db:
            await db.execute("INSERT INTO insights VALUES (?,?,?,?,?,?,?,?,0,?)", (iid, user_id, org_id, position_id, insight_type, title, content, priority, time.time()))
            await db.commit()
        return iid

    async def get_insights(self, user_id: str, org_id: str, position_id: str = "", limit: int = 10, unread_only: bool = False) -> list[dict]:
        await self.ensure_tables()
        query = "SELECT * FROM insights WHERE user_id=? AND org_id=?"
        params: list[Any] = [user_id, org_id]
        if position_id: query += " AND position_id=?"; params.append(position_id)
        if unread_only: query += " AND is_read=0"
        query += " ORDER BY created_at DESC LIMIT ?"; params.append(limit)
        async with self._db() as db:
            cursor = await db.execute(query, params)
            return [dict(r) for r in await cursor.fetchall()]

    async def mark_insight_read(self, insight_id: str) -> None:
        async with self._db() as db:
            await db.execute("UPDATE insights SET is_read=1 WHERE id=?", (insight_id,))
            await db.commit()
