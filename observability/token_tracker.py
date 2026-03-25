"""
AgentForge V2 — Token 消耗追踪

按 user/org/position 维度记录 token 消耗，支持日限额查询。
"""

from __future__ import annotations

import logging
import time

import aiosqlite

from memory.base import BaseStore

logger = logging.getLogger(__name__)


class TokenTracker(BaseStore):
    """Token 消耗追踪器。"""

    async def _create_tables(self, db: aiosqlite.Connection) -> None:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS token_usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL DEFAULT '',
                org_id TEXT NOT NULL DEFAULT '',
                position_id TEXT NOT NULL DEFAULT '',
                model TEXT NOT NULL,
                provider TEXT NOT NULL DEFAULT '',
                input_tokens INTEGER DEFAULT 0,
                output_tokens INTEGER DEFAULT 0,
                total_tokens INTEGER DEFAULT 0,
                cost_usd REAL DEFAULT 0.0,
                mission_id TEXT DEFAULT '',
                created_at REAL NOT NULL
            )
        """)
        await db.execute("CREATE INDEX IF NOT EXISTS idx_token_usage_date ON token_usage(created_at)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_token_usage_org ON token_usage(org_id, created_at)")

    async def record(
        self, user_id: str, org_id: str, position_id: str,
        model: str, provider: str,
        input_tokens: int, output_tokens: int,
        cost_usd: float = 0.0, mission_id: str = "",
    ) -> None:
        """记录一次 token 消耗。"""
        await self.ensure_tables()
        async with self._db() as db:
            await db.execute(
                "INSERT INTO token_usage (user_id, org_id, position_id, model, provider, "
                "input_tokens, output_tokens, total_tokens, cost_usd, mission_id, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (user_id, org_id, position_id, model, provider,
                 input_tokens, output_tokens, input_tokens + output_tokens,
                 cost_usd, mission_id, time.time()),
            )
            await db.commit()

    async def get_daily_usage(self, org_id: str = "", user_id: str = "") -> dict:
        """获取今日 token 用量。"""
        await self.ensure_tables()
        today_start = time.time() - (time.time() % 86400)
        query = "SELECT SUM(total_tokens) as total, SUM(cost_usd) as cost FROM token_usage WHERE created_at >= ?"
        params = [today_start]
        if org_id:
            query += " AND org_id = ?"
            params.append(org_id)
        if user_id:
            query += " AND user_id = ?"
            params.append(user_id)

        async with self._db() as db:
            cursor = await db.execute(query, params)
            row = await cursor.fetchone()
            return {
                "total_tokens": row["total"] or 0 if row else 0,
                "cost_usd": row["cost"] or 0.0 if row else 0.0,
            }

    async def get_usage_by_model(self, org_id: str = "", days: int = 7) -> list[dict]:
        """按模型统计用量。"""
        await self.ensure_tables()
        since = time.time() - days * 86400
        query = (
            "SELECT model, provider, SUM(total_tokens) as total, SUM(cost_usd) as cost, COUNT(*) as calls "
            "FROM token_usage WHERE created_at >= ?"
        )
        params = [since]
        if org_id:
            query += " AND org_id = ?"
            params.append(org_id)
        query += " GROUP BY model, provider ORDER BY total DESC"

        async with self._db() as db:
            cursor = await db.execute(query, params)
            return [dict(r) for r in await cursor.fetchall()]
