"""
AgentForge V2 — Mission 追踪器

记录每次任务的执行轨迹，用于调试和分析。
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

import aiosqlite

from memory.base import BaseStore

logger = logging.getLogger(__name__)


class MissionTracer(BaseStore):
    """Mission 执行追踪。"""

    async def _create_tables(self, db: aiosqlite.Connection) -> None:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS missions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL DEFAULT '',
                org_id TEXT NOT NULL DEFAULT '',
                position_id TEXT NOT NULL DEFAULT '',
                instruction TEXT NOT NULL,
                status TEXT DEFAULT 'running',
                content TEXT DEFAULT '',
                tokens_used INTEGER DEFAULT 0,
                cost_usd REAL DEFAULT 0.0,
                duration REAL DEFAULT 0.0,
                model_used TEXT DEFAULT '',
                steps TEXT DEFAULT '[]',
                error TEXT DEFAULT '',
                created_at REAL NOT NULL,
                completed_at REAL DEFAULT 0
            )
        """)
        await db.execute("CREATE INDEX IF NOT EXISTS idx_missions_user ON missions(user_id, org_id)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_missions_date ON missions(created_at)")

    async def start(
        self, mission_id: str, user_id: str, org_id: str,
        position_id: str, instruction: str,
    ) -> None:
        """记录任务开始。"""
        await self.ensure_tables()
        async with self._db() as db:
            await db.execute(
                "INSERT OR REPLACE INTO missions (id, user_id, org_id, position_id, "
                "instruction, status, created_at) VALUES (?, ?, ?, ?, ?, 'running', ?)",
                (mission_id, user_id, org_id, position_id, instruction, time.time()),
            )
            await db.commit()

    async def complete(
        self, mission_id: str, status: str, content: str,
        tokens_used: int = 0, duration: float = 0.0,
        model_used: str = "", steps: list[dict] | None = None,
        error: str = "",
    ) -> None:
        """记录任务完成。"""
        await self.ensure_tables()
        async with self._db() as db:
            await db.execute(
                "UPDATE missions SET status=?, content=?, tokens_used=?, duration=?, "
                "model_used=?, steps=?, error=?, completed_at=? WHERE id=?",
                (status, content[:2000], tokens_used, duration, model_used,
                 json.dumps(steps or [], ensure_ascii=False), error, time.time(), mission_id),
            )
            await db.commit()

    async def get_recent(
        self, user_id: str = "", org_id: str = "", limit: int = 20,
    ) -> list[dict]:
        """获取最近的任务。"""
        await self.ensure_tables()
        query = "SELECT * FROM missions WHERE 1=1"
        params: list[Any] = []
        if user_id:
            query += " AND user_id = ?"
            params.append(user_id)
        if org_id:
            query += " AND org_id = ?"
            params.append(org_id)
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)

        async with self._db() as db:
            cursor = await db.execute(query, params)
            rows = await cursor.fetchall()
            results = []
            for r in rows:
                d = dict(r)
                d["steps"] = json.loads(d.get("steps", "[]"))
                results.append(d)
            return results
