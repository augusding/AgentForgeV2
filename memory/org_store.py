"""AgentForge V2 — 组织存储：管理组织(org)和成员(membership)。"""

from __future__ import annotations

import logging
import time
from typing import Any
from uuid import uuid4

from memory.base import BaseStore

logger = logging.getLogger(__name__)


class OrgStore(BaseStore):
    """组织 + 成员存储。"""

    async def _create_tables(self, db) -> None:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS orgs (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, industry TEXT DEFAULT '',
                profile_name TEXT DEFAULT '', owner_id TEXT NOT NULL,
                status TEXT DEFAULT 'active', settings TEXT DEFAULT '{}',
                created_at REAL NOT NULL, updated_at REAL NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS org_members (
                id TEXT PRIMARY KEY, org_id TEXT NOT NULL, user_id TEXT NOT NULL,
                role TEXT DEFAULT 'member', position_id TEXT DEFAULT '',
                joined_at REAL NOT NULL, UNIQUE(org_id, user_id)
            )
        """)
        await db.execute("CREATE INDEX IF NOT EXISTS idx_org_members ON org_members(org_id)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_member_user ON org_members(user_id)")

    # ── 组织 CRUD ─────────────────────────────────────────

    async def create_org(self, name: str, owner_id: str, industry: str = "",
                         profile_name: str = "") -> str:
        await self.ensure_tables()
        org_id = uuid4().hex[:12]
        now = time.time()
        async with self._db() as db:
            await db.execute("INSERT INTO orgs VALUES (?,?,?,?,?,?,?,?,?)",
                             (org_id, name, industry, profile_name, owner_id, "active", "{}", now, now))
            await db.execute("INSERT INTO org_members VALUES (?,?,?,?,?,?)",
                             (uuid4().hex[:12], org_id, owner_id, "owner", "", now))
            await db.commit()
        return org_id

    async def get_org(self, org_id: str) -> dict | None:
        await self.ensure_tables()
        async with self._db() as db:
            cursor = await db.execute("SELECT * FROM orgs WHERE id = ?", (org_id,))
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def list_orgs(self, status: str = "active") -> list[dict]:
        await self.ensure_tables()
        async with self._db() as db:
            cursor = await db.execute(
                "SELECT * FROM orgs WHERE status = ? ORDER BY created_at DESC", (status,))
            return [dict(r) for r in await cursor.fetchall()]

    async def update_org(self, org_id: str, **kwargs) -> None:
        allowed = {"name", "industry", "profile_name", "status", "settings"}
        updates = {k: v for k, v in kwargs.items() if k in allowed}
        if not updates: return
        updates["updated_at"] = time.time()
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        async with self._db() as db:
            await db.execute(f"UPDATE orgs SET {set_clause} WHERE id = ?",
                             list(updates.values()) + [org_id])
            await db.commit()

    # ── 成员管理 ──────────────────────────────────────────

    async def add_member(self, org_id: str, user_id: str, role: str = "member",
                         position_id: str = "") -> str:
        await self.ensure_tables()
        mid = uuid4().hex[:12]
        async with self._db() as db:
            await db.execute("INSERT OR REPLACE INTO org_members VALUES (?,?,?,?,?,?)",
                             (mid, org_id, user_id, role, position_id, time.time()))
            await db.commit()
        return mid

    async def get_members(self, org_id: str) -> list[dict]:
        await self.ensure_tables()
        async with self._db() as db:
            cursor = await db.execute(
                "SELECT * FROM org_members WHERE org_id = ? ORDER BY joined_at", (org_id,))
            return [dict(r) for r in await cursor.fetchall()]

    async def get_user_org(self, user_id: str) -> dict | None:
        """获取用户所属的组织（第一个）。"""
        await self.ensure_tables()
        async with self._db() as db:
            cursor = await db.execute(
                "SELECT m.*, o.name as org_name, o.profile_name FROM org_members m "
                "JOIN orgs o ON m.org_id = o.id WHERE m.user_id = ? LIMIT 1", (user_id,))
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def update_member_role(self, org_id: str, user_id: str, role: str) -> None:
        async with self._db() as db:
            await db.execute("UPDATE org_members SET role = ? WHERE org_id = ? AND user_id = ?",
                             (role, org_id, user_id))
            await db.commit()

    async def remove_member(self, org_id: str, user_id: str) -> None:
        async with self._db() as db:
            await db.execute("DELETE FROM org_members WHERE org_id = ? AND user_id = ?",
                             (org_id, user_id))
            await db.commit()

    async def get_member_count(self, org_id: str) -> int:
        await self.ensure_tables()
        async with self._db() as db:
            cursor = await db.execute(
                "SELECT COUNT(*) FROM org_members WHERE org_id = ?", (org_id,))
            row = await cursor.fetchone()
            return row[0] if row else 0
