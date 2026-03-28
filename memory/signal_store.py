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
        await db.execute("CREATE TABLE IF NOT EXISTS feedbacks (id TEXT PRIMARY KEY, message_id TEXT NOT NULL, session_id TEXT DEFAULT '', user_id TEXT DEFAULT '', org_id TEXT DEFAULT '', position_id TEXT DEFAULT '', rating TEXT NOT NULL, created_at REAL NOT NULL)")
        await db.execute("CREATE TABLE IF NOT EXISTS pending_analysis (id TEXT PRIMARY KEY, org_id TEXT DEFAULT '', position_id TEXT NOT NULL, user_id TEXT NOT NULL, pending_count INTEGER DEFAULT 0, oldest_pending REAL, last_analyzed REAL, updated_at REAL NOT NULL)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_pending_count ON pending_analysis(pending_count)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_feedback_session ON feedbacks(session_id)")

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

    # ── Feedback + Pending Analysis ─────────────────────────

    async def add_feedback(self, message_id: str, session_id: str,
                            user_id: str, org_id: str, position_id: str, rating: str) -> str:
        await self.ensure_tables()
        fid = uuid4().hex[:12]
        async with self._db() as db:
            await db.execute("INSERT OR REPLACE INTO feedbacks VALUES (?,?,?,?,?,?,?,?)",
                             (fid, message_id, session_id, user_id, org_id, position_id, rating, time.time()))
            await db.commit()
        if rating == "down":
            await self.increment_pending(org_id, position_id, user_id)
        return fid

    async def increment_pending(self, org_id: str, position_id: str, user_id: str) -> int:
        await self.ensure_tables()
        now = time.time()
        key = f"{org_id}:{position_id}:{user_id}"
        async with self._db() as db:
            cursor = await db.execute("SELECT pending_count FROM pending_analysis WHERE id=?", (key,))
            row = await cursor.fetchone()
            if row:
                new_count = row["pending_count"] + 1
                await db.execute("UPDATE pending_analysis SET pending_count=?, updated_at=? WHERE id=?", (new_count, now, key))
            else:
                new_count = 1
                await db.execute("INSERT INTO pending_analysis VALUES (?,?,?,?,1,?,NULL,?)", (key, org_id, position_id, user_id, now, now))
            await db.commit()
        return new_count

    async def reset_pending(self, org_id: str, position_id: str, user_id: str) -> None:
        await self.ensure_tables()
        now = time.time()
        key = f"{org_id}:{position_id}:{user_id}"
        async with self._db() as db:
            await db.execute("UPDATE pending_analysis SET pending_count=0, last_analyzed=?, updated_at=? WHERE id=?", (now, now, key))
            await db.commit()

    async def get_pending_list(self, min_count: int = 10, stale_days: float = 3.0, limit: int = 50) -> list[dict]:
        await self.ensure_tables()
        stale_ts = time.time() - stale_days * 86400
        async with self._db() as db:
            cursor = await db.execute(
                "SELECT * FROM pending_analysis WHERE pending_count >= ? OR (pending_count > 0 AND oldest_pending IS NOT NULL AND oldest_pending < ?) ORDER BY pending_count DESC LIMIT ?",
                (min_count, stale_ts, limit))
            return [dict(r) for r in await cursor.fetchall()]

    async def get_feedbacks_by_session(self, session_id: str, rating: str = "") -> list[dict]:
        await self.ensure_tables()
        if rating:
            q, p = "SELECT * FROM feedbacks WHERE session_id=? AND rating=? ORDER BY created_at DESC", (session_id, rating)
        else:
            q, p = "SELECT * FROM feedbacks WHERE session_id=? ORDER BY created_at DESC", (session_id,)
        async with self._db() as db:
            cursor = await db.execute(q, p)
            return [dict(r) for r in await cursor.fetchall()]
