"""AgentForge V2 — 用户个人画像存储（团队规范/工作上下文/沟通偏好）。"""
from __future__ import annotations

import logging
import time
from uuid import uuid4

from memory.base import BaseStore

logger = logging.getLogger(__name__)

CATEGORY_TEAM_RULE = "team_rule"
CATEGORY_PERSONAL_CTX = "personal_context"
CATEGORY_PREFERRED_STYLE = "preferred_style"
_MAX_PER_CATEGORY = 10


class UserProfileStore(BaseStore):

    async def _create_tables(self, db) -> None:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS user_profiles (
                id TEXT PRIMARY KEY, user_id TEXT NOT NULL, org_id TEXT DEFAULT '',
                position_id TEXT NOT NULL, category TEXT NOT NULL, content TEXT NOT NULL,
                source TEXT DEFAULT 'auto', confidence REAL DEFAULT 0.7,
                created_at REAL NOT NULL, updated_at REAL NOT NULL
            )""")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_up_user_pos ON user_profiles(user_id, position_id)")

    async def upsert(self, user_id: str, org_id: str, position_id: str,
                      category: str, content: str, source: str = "auto",
                      confidence: float = 0.7) -> str:
        await self.ensure_tables()
        now = time.time()
        content = content.strip()
        if not content: return ""
        async with self._db() as db:
            cursor = await db.execute(
                "SELECT id FROM user_profiles WHERE user_id=? AND org_id=? AND position_id=? AND category=? AND content=?",
                (user_id, org_id, position_id, category, content))
            existing = await cursor.fetchone()
            if existing:
                pid = existing["id"]
                await db.execute("UPDATE user_profiles SET updated_at=?, confidence=MIN(1.0,confidence+0.1) WHERE id=?", (now, pid))
            else:
                pid = uuid4().hex[:12]
                await db.execute("INSERT INTO user_profiles VALUES (?,?,?,?,?,?,?,?,?,?)",
                    (pid, user_id, org_id, position_id, category, content, source, confidence, now, now))
                # enforce limit
                c2 = await db.execute(
                    "SELECT id FROM user_profiles WHERE user_id=? AND org_id=? AND position_id=? AND category=? ORDER BY updated_at DESC",
                    (user_id, org_id, position_id, category))
                rows = await c2.fetchall()
                if len(rows) > _MAX_PER_CATEGORY:
                    for r in rows[_MAX_PER_CATEGORY:]:
                        await db.execute("DELETE FROM user_profiles WHERE id=?", (r["id"],))
            await db.commit()
        return pid

    async def get_profile(self, user_id: str, org_id: str, position_id: str) -> dict[str, list[str]]:
        await self.ensure_tables()
        async with self._db() as db:
            cursor = await db.execute(
                "SELECT category, content FROM user_profiles WHERE user_id=? AND org_id=? AND position_id=? ORDER BY confidence DESC, updated_at DESC",
                (user_id, org_id, position_id))
            rows = await cursor.fetchall()
        result: dict[str, list[str]] = {CATEGORY_TEAM_RULE: [], CATEGORY_PERSONAL_CTX: [], CATEGORY_PREFERRED_STYLE: []}
        for row in rows:
            cat = row["category"]
            if cat in result: result[cat].append(row["content"])
        return result

    async def build_injection_text(self, user_id: str, org_id: str, position_id: str) -> str:
        profile = await self.get_profile(user_id, org_id, position_id)
        parts: list[str] = []
        if profile[CATEGORY_TEAM_RULE]:
            parts.append("## 用户团队规范\n" + "\n".join(f"- {r}" for r in profile[CATEGORY_TEAM_RULE]))
        if profile[CATEGORY_PERSONAL_CTX]:
            parts.append("## 当前工作上下文\n" + "\n".join(f"- {c}" for c in profile[CATEGORY_PERSONAL_CTX]))
        if profile[CATEGORY_PREFERRED_STYLE]:
            parts.append("## 沟通偏好\n" + "\n".join(f"- {s}" for s in profile[CATEGORY_PREFERRED_STYLE]))
        return "\n\n".join(parts)

    async def delete_entry(self, entry_id: str, user_id: str) -> bool:
        async with self._db() as db:
            cur = await db.execute("DELETE FROM user_profiles WHERE id=? AND user_id=?", (entry_id, user_id))
            await db.commit()
        return cur.rowcount > 0
