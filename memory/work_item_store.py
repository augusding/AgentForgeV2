"""
AgentForge V2 — 工作项存储

管理工位的：优先事项(priorities)、日程(schedules)、跟进(followups)、工作项(work_items)。
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any
from uuid import uuid4

from memory.base import BaseStore

logger = logging.getLogger(__name__)


class WorkItemStore(BaseStore):
    """工位工作项存储。"""

    async def _create_tables(self, db) -> None:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS priorities (
                id TEXT PRIMARY KEY, user_id TEXT NOT NULL, org_id TEXT DEFAULT '',
                position_id TEXT DEFAULT '', title TEXT NOT NULL, description TEXT DEFAULT '',
                priority TEXT DEFAULT 'P1', status TEXT DEFAULT 'active',
                due_date TEXT DEFAULT '', created_at REAL NOT NULL, updated_at REAL NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS schedules (
                id TEXT PRIMARY KEY, user_id TEXT NOT NULL, org_id TEXT DEFAULT '',
                position_id TEXT DEFAULT '', title TEXT NOT NULL, description TEXT DEFAULT '',
                scheduled_time TEXT NOT NULL, duration_minutes INTEGER DEFAULT 60,
                recurrence TEXT DEFAULT '', status TEXT DEFAULT 'pending',
                created_at REAL NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS followups (
                id TEXT PRIMARY KEY, user_id TEXT NOT NULL, org_id TEXT DEFAULT '',
                position_id TEXT DEFAULT '', title TEXT NOT NULL, description TEXT DEFAULT '',
                target TEXT DEFAULT '', due_date TEXT DEFAULT '',
                status TEXT DEFAULT 'pending', created_at REAL NOT NULL, updated_at REAL NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS work_items (
                id TEXT PRIMARY KEY, user_id TEXT NOT NULL, org_id TEXT DEFAULT '',
                position_id TEXT DEFAULT '', title TEXT NOT NULL, description TEXT DEFAULT '',
                item_type TEXT DEFAULT 'task', status TEXT DEFAULT 'todo',
                priority TEXT DEFAULT 'P1', assignee TEXT DEFAULT '',
                due_date TEXT DEFAULT '', tags TEXT DEFAULT '[]',
                created_at REAL NOT NULL, updated_at REAL NOT NULL
            )
        """)
        await db.execute("CREATE INDEX IF NOT EXISTS idx_pri_user ON priorities(user_id, org_id, position_id)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_sch_user ON schedules(user_id, org_id)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_fol_user ON followups(user_id, org_id)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_wi_user ON work_items(user_id, org_id)")
        await db.execute("""
            CREATE TABLE IF NOT EXISTS user_assignments (
                user_id TEXT NOT NULL, org_id TEXT DEFAULT '',
                position_id TEXT NOT NULL, assigned_at REAL NOT NULL,
                PRIMARY KEY (user_id, org_id)
            )
        """)

    # ── Assignment ────────────────────────────────────────

    async def set_assignment(self, user_id: str, org_id: str, position_id: str) -> None:
        await self.ensure_tables()
        async with self._db() as db:
            await db.execute(
                "INSERT OR REPLACE INTO user_assignments VALUES (?,?,?,?)",
                (user_id, org_id, position_id, __import__('time').time()))
            await db.commit()

    async def get_assignment(self, user_id: str, org_id: str = "") -> str:
        await self.ensure_tables()
        async with self._db() as db:
            cursor = await db.execute(
                "SELECT position_id FROM user_assignments WHERE user_id=? AND org_id=?",
                (user_id, org_id))
            row = await cursor.fetchone()
            return row[0] if row else ""

    # ── Priorities ────────────────────────────────────────

    async def add_priority(self, user_id: str, org_id: str, position_id: str,
                           title: str, description: str = "", priority: str = "P1",
                           due_date: str = "") -> str:
        await self.ensure_tables()
        pid = uuid4().hex[:12]
        now = time.time()
        async with self._db() as db:
            await db.execute(
                "INSERT INTO priorities VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (pid, user_id, org_id, position_id, title, description,
                 priority, "active", due_date, now, now))
            await db.commit()
        return pid

    async def get_priorities(self, user_id: str, org_id: str = "", position_id: str = "",
                             status: str = "active", limit: int = 10) -> list[dict]:
        await self.ensure_tables()
        query = "SELECT * FROM priorities WHERE user_id = ?"
        params: list[Any] = [user_id]
        if org_id: query += " AND org_id = ?"; params.append(org_id)
        if position_id: query += " AND position_id = ?"; params.append(position_id)
        if status: query += " AND status = ?"; params.append(status)
        query += " ORDER BY created_at DESC LIMIT ?"; params.append(limit)
        async with self._db() as db:
            cursor = await db.execute(query, params)
            return [dict(r) for r in await cursor.fetchall()]

    async def update_priority(self, priority_id: str, user_id: str = "", **kwargs) -> int:
        allowed = {"title", "description", "priority", "status", "due_date"}
        updates = {k: v for k, v in kwargs.items() if k in allowed}
        if not updates: return 0
        updates["updated_at"] = time.time()
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        where = "id = ?" + (" AND user_id = ?" if user_id else "")
        params = list(updates.values()) + [priority_id] + ([user_id] if user_id else [])
        async with self._db() as db:
            cur = await db.execute(f"UPDATE priorities SET {set_clause} WHERE {where}", params)
            await db.commit()
            return cur.rowcount

    async def delete_priority(self, priority_id: str, user_id: str = "") -> int:
        async with self._db() as db:
            if user_id:
                cur = await db.execute("DELETE FROM priorities WHERE id = ? AND user_id = ?", (priority_id, user_id))
            else:
                cur = await db.execute("DELETE FROM priorities WHERE id = ?", (priority_id,))
            await db.commit()
            return cur.rowcount

    # ── Schedules ─────────────────────────────────────────

    async def add_schedule(self, user_id: str, org_id: str, position_id: str,
                           title: str, scheduled_time: str, duration_minutes: int = 60,
                           description: str = "", recurrence: str = "") -> str:
        await self.ensure_tables()
        sid = uuid4().hex[:12]
        async with self._db() as db:
            await db.execute(
                "INSERT INTO schedules VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (sid, user_id, org_id, position_id, title, description,
                 scheduled_time, duration_minutes, recurrence, "pending", time.time()))
            await db.commit()
        return sid

    async def get_schedules(self, user_id: str, org_id: str = "",
                            date: str = "", limit: int = 20) -> list[dict]:
        await self.ensure_tables()
        query = "SELECT * FROM schedules WHERE user_id = ?"
        params: list[Any] = [user_id]
        if org_id: query += " AND org_id = ?"; params.append(org_id)
        if date: query += " AND scheduled_time LIKE ?"; params.append(f"{date}%")
        query += " ORDER BY scheduled_time ASC LIMIT ?"; params.append(limit)
        async with self._db() as db:
            cursor = await db.execute(query, params)
            return [dict(r) for r in await cursor.fetchall()]

    async def update_schedule(self, schedule_id: str, user_id: str = "", **kwargs) -> int:
        allowed = {"title", "description", "scheduled_time", "duration_minutes", "recurrence", "status"}
        updates = {k: v for k, v in kwargs.items() if k in allowed}
        if not updates: return 0
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        where = "id = ?" + (" AND user_id = ?" if user_id else "")
        params = list(updates.values()) + [schedule_id] + ([user_id] if user_id else [])
        async with self._db() as db:
            cur = await db.execute(f"UPDATE schedules SET {set_clause} WHERE {where}", params)
            await db.commit()
            return cur.rowcount

    async def delete_schedule(self, schedule_id: str, user_id: str = "") -> int:
        async with self._db() as db:
            if user_id:
                cur = await db.execute("DELETE FROM schedules WHERE id = ? AND user_id = ?", (schedule_id, user_id))
            else:
                cur = await db.execute("DELETE FROM schedules WHERE id = ?", (schedule_id,))
            await db.commit()
            return cur.rowcount

    # ── Followups ─────────────────────────────────────────

    async def add_followup(self, user_id: str, org_id: str, position_id: str,
                           title: str, target: str = "", due_date: str = "",
                           description: str = "") -> str:
        await self.ensure_tables()
        fid = uuid4().hex[:12]
        now = time.time()
        async with self._db() as db:
            await db.execute(
                "INSERT INTO followups VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (fid, user_id, org_id, position_id, title, description,
                 target, due_date, "pending", now, now))
            await db.commit()
        return fid

    async def get_followups(self, user_id: str, org_id: str = "",
                            status: str = "pending", limit: int = 10) -> list[dict]:
        await self.ensure_tables()
        query = "SELECT * FROM followups WHERE user_id = ?"
        params: list[Any] = [user_id]
        if org_id: query += " AND org_id = ?"; params.append(org_id)
        if status: query += " AND status = ?"; params.append(status)
        query += " ORDER BY created_at DESC LIMIT ?"; params.append(limit)
        async with self._db() as db:
            cursor = await db.execute(query, params)
            return [dict(r) for r in await cursor.fetchall()]

    async def update_followup(self, followup_id: str, user_id: str = "", **kwargs) -> int:
        allowed = {"title", "description", "target", "due_date", "status"}
        updates = {k: v for k, v in kwargs.items() if k in allowed}
        if not updates: return 0
        updates["updated_at"] = time.time()
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        where = "id = ?" + (" AND user_id = ?" if user_id else "")
        params = list(updates.values()) + [followup_id] + ([user_id] if user_id else [])
        async with self._db() as db:
            cur = await db.execute(f"UPDATE followups SET {set_clause} WHERE {where}", params)
            await db.commit()
            return cur.rowcount

    async def delete_followup(self, followup_id: str, user_id: str = "") -> int:
        async with self._db() as db:
            if user_id:
                cur = await db.execute("DELETE FROM followups WHERE id = ? AND user_id = ?", (followup_id, user_id))
            else:
                cur = await db.execute("DELETE FROM followups WHERE id = ?", (followup_id,))
            await db.commit()
            return cur.rowcount

    # ── Work Items ────────────────────────────────────────

    async def add_work_item(self, user_id: str, org_id: str, position_id: str,
                            title: str, item_type: str = "task", priority: str = "P1",
                            description: str = "", assignee: str = "", due_date: str = "",
                            tags: list[str] | None = None) -> str:
        await self.ensure_tables()
        wid = uuid4().hex[:12]
        now = time.time()
        async with self._db() as db:
            await db.execute(
                "INSERT INTO work_items VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (wid, user_id, org_id, position_id, title, description, item_type,
                 "todo", priority, assignee, due_date, json.dumps(tags or []), now, now))
            await db.commit()
        return wid

    async def get_work_items(self, user_id: str, org_id: str = "", position_id: str = "",
                             status: str = "", limit: int = 20) -> list[dict]:
        await self.ensure_tables()
        query = "SELECT * FROM work_items WHERE user_id = ?"
        params: list[Any] = [user_id]
        if org_id: query += " AND org_id = ?"; params.append(org_id)
        if position_id: query += " AND position_id = ?"; params.append(position_id)
        if status: query += " AND status = ?"; params.append(status)
        query += " ORDER BY updated_at DESC LIMIT ?"; params.append(limit)
        async with self._db() as db:
            cursor = await db.execute(query, params)
            rows = await cursor.fetchall()
            result = []
            for r in rows:
                d = dict(r)
                d["tags"] = json.loads(d.get("tags", "[]"))
                result.append(d)
            return result

    async def update_work_item(self, item_id: str, user_id: str = "", **kwargs) -> int:
        allowed = {"title", "description", "item_type", "status", "priority",
                   "assignee", "due_date", "tags"}
        updates = {}
        for k, v in kwargs.items():
            if k in allowed:
                updates[k] = json.dumps(v) if k == "tags" else v
        if not updates: return 0
        updates["updated_at"] = time.time()
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        where = "id = ?" + (" AND user_id = ?" if user_id else "")
        params = list(updates.values()) + [item_id] + ([user_id] if user_id else [])
        async with self._db() as db:
            cur = await db.execute(f"UPDATE work_items SET {set_clause} WHERE {where}", params)
            await db.commit()
            return cur.rowcount

    async def delete_work_item(self, item_id: str, user_id: str = "") -> int:
        async with self._db() as db:
            if user_id:
                cur = await db.execute("DELETE FROM work_items WHERE id = ? AND user_id = ?", (item_id, user_id))
            else:
                cur = await db.execute("DELETE FROM work_items WHERE id = ?", (item_id,))
            await db.commit()
            return cur.rowcount
