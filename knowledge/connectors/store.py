"""
ConnectorStore：连接器配置持久化（SQLite + Fernet 加密）

安全设计：
  1. 含 token/password/key/secret 的字段存储前 Fernet 加密
  2. MultiFernet 支持密钥轮换
  3. 所有变更写入 connector_audit_log（append-only 合规审计）
  4. sync_failures 表实现死信队列（DLQ）
"""
from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path
from uuid import uuid4

import aiosqlite

logger = logging.getLogger(__name__)

_SENSITIVE_KEYS = {
    "token", "password", "api_key", "secret", "access_token",
    "private_key", "client_secret", "refresh_token",
}


def _build_fernet():
    key = os.environ.get("CONNECTOR_ENCRYPT_KEY", "").strip()
    if not key:
        logger.warning("CONNECTOR_ENCRYPT_KEY 未设置，敏感字段明文存储（仅开发环境）")
        return None
    try:
        from cryptography.fernet import Fernet, MultiFernet
        keys = [Fernet(key.encode())]
        for k in os.environ.get("CONNECTOR_OLD_KEY", "").split(","):
            k = k.strip()
            if k:
                keys.append(Fernet(k.encode()))
        return MultiFernet(keys) if len(keys) > 1 else keys[0]
    except Exception as e:
        logger.error("Fernet 初始化失败: %s", e)
        return None


class ConnectorStore:

    def __init__(self, data_dir: str = "data"):
        self._db = Path(data_dir) / "connectors.db"
        self._db.parent.mkdir(parents=True, exist_ok=True)
        self._fernet = _build_fernet()

    def _enc(self, v: str) -> str:
        return self._fernet.encrypt(v.encode()).decode() if (self._fernet and v) else v

    def _dec(self, v: str) -> str:
        if not self._fernet or not v:
            return v
        try:
            return self._fernet.decrypt(v.encode()).decode()
        except Exception:
            return v

    def _enc_cfg(self, cfg: dict) -> dict:
        return {k: self._enc(v) if isinstance(v, str) and
                any(s in k.lower() for s in _SENSITIVE_KEYS) else v
                for k, v in cfg.items()}

    def _dec_cfg(self, cfg: dict) -> dict:
        return {k: self._dec(v) if isinstance(v, str) and
                any(s in k.lower() for s in _SENSITIVE_KEYS) else v
                for k, v in cfg.items()}

    async def init(self) -> None:
        async with aiosqlite.connect(self._db) as db:
            await db.executescript("""
                CREATE TABLE IF NOT EXISTS connectors (
                    id TEXT PRIMARY KEY, org_id TEXT NOT NULL DEFAULT '',
                    name TEXT NOT NULL, connector_type TEXT NOT NULL,
                    config TEXT NOT NULL DEFAULT '{}', scope TEXT DEFAULT '',
                    enabled INTEGER NOT NULL DEFAULT 1,
                    sync_interval_minutes INTEGER NOT NULL DEFAULT 60,
                    last_sync_at REAL DEFAULT NULL, last_sync_status TEXT DEFAULT NULL,
                    last_sync_count INTEGER DEFAULT 0, last_cursor TEXT DEFAULT NULL,
                    created_at REAL NOT NULL, updated_at REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS connector_audit_log (
                    id TEXT PRIMARY KEY, connector_id TEXT NOT NULL,
                    org_id TEXT NOT NULL DEFAULT '', action TEXT NOT NULL,
                    actor TEXT NOT NULL DEFAULT 'system', detail TEXT DEFAULT '',
                    created_at REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS sync_failures (
                    id TEXT PRIMARY KEY, connector_id TEXT NOT NULL,
                    org_id TEXT NOT NULL DEFAULT '', doc_id TEXT NOT NULL DEFAULT '',
                    source_url TEXT NOT NULL DEFAULT '', error_msg TEXT NOT NULL,
                    retry_count INTEGER NOT NULL DEFAULT 0,
                    max_retries INTEGER NOT NULL DEFAULT 5,
                    next_retry_at REAL NOT NULL, resolved INTEGER NOT NULL DEFAULT 0,
                    created_at REAL NOT NULL, updated_at REAL NOT NULL
                );
            """)
            await db.commit()

    async def create(self, org_id: str, name: str, connector_type: str,
                     config: dict, sync_interval_minutes: int = 60,
                     actor: str = "user") -> dict:
        cid, now = uuid4().hex, time.time()
        async with aiosqlite.connect(self._db) as db:
            await db.execute(
                "INSERT INTO connectors (id,org_id,name,connector_type,config,"
                "sync_interval_minutes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
                (cid, org_id, name, connector_type,
                 json.dumps(self._enc_cfg(config), ensure_ascii=False),
                 sync_interval_minutes, now, now))
            await db.execute(
                "INSERT INTO connector_audit_log "
                "(id,connector_id,org_id,action,actor,detail,created_at) VALUES (?,?,?,'create',?,?,?)",
                (uuid4().hex, cid, org_id, actor,
                 json.dumps({"name": name, "type": connector_type}), now))
            await db.commit()
        return await self.get(cid)

    async def get(self, connector_id: str) -> dict | None:
        async with aiosqlite.connect(self._db) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("SELECT * FROM connectors WHERE id=?", (connector_id,)) as c:
                row = await c.fetchone()
        return self._row(row) if row else None

    async def list_by_org(self, org_id: str) -> list[dict]:
        async with aiosqlite.connect(self._db) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT * FROM connectors WHERE org_id=? ORDER BY created_at DESC", (org_id,)
            ) as c:
                rows = await c.fetchall()
        return [self._row(r) for r in rows]

    async def update(self, connector_id: str, actor: str = "user", **kwargs) -> dict | None:
        allowed = {"name", "config", "enabled", "sync_interval_minutes", "scope"}
        updates = {k: v for k, v in kwargs.items() if k in allowed}
        if not updates:
            return await self.get(connector_id)
        if "config" in updates:
            updates["config"] = json.dumps(self._enc_cfg(updates["config"]), ensure_ascii=False)
        updates["updated_at"] = time.time()
        clause = ", ".join(f"{k}=?" for k in updates)
        async with aiosqlite.connect(self._db) as db:
            await db.execute(f"UPDATE connectors SET {clause} WHERE id=?",
                             [*updates.values(), connector_id])
            await db.execute(
                "INSERT INTO connector_audit_log "
                "(id,connector_id,org_id,action,actor,detail,created_at) "
                "SELECT ?,id,org_id,'update',?,?,? FROM connectors WHERE id=?",
                (uuid4().hex, actor, json.dumps(list(updates)), time.time(), connector_id))
            await db.commit()
        return await self.get(connector_id)

    async def delete(self, connector_id: str, actor: str = "user") -> bool:
        async with aiosqlite.connect(self._db) as db:
            async with db.execute("SELECT org_id,name FROM connectors WHERE id=?",
                                  (connector_id,)) as c:
                row = await c.fetchone()
            if not row:
                return False
            cur = await db.execute("DELETE FROM connectors WHERE id=?", (connector_id,))
            await db.execute(
                "INSERT INTO connector_audit_log "
                "(id,connector_id,org_id,action,actor,detail,created_at) VALUES (?,?,?,'delete',?,?,?)",
                (uuid4().hex, connector_id, row[0], actor,
                 json.dumps({"name": row[1]}), time.time()))
            await db.commit()
            return cur.rowcount > 0

    async def update_sync_result(self, connector_id: str, status: str,
                                  count: int, cursor: str | None = None) -> None:
        now = time.time()
        fields: dict = {"last_sync_at": now, "last_sync_status": status,
                        "last_sync_count": count, "updated_at": now}
        if cursor is not None:
            fields["last_cursor"] = cursor
        clause = ", ".join(f"{k}=?" for k in fields)
        async with aiosqlite.connect(self._db) as db:
            await db.execute(f"UPDATE connectors SET {clause} WHERE id=?",
                             [*fields.values(), connector_id])
            await db.commit()

    async def dlq_add(self, connector_id: str, org_id: str,
                       doc_id: str, source_url: str, error_msg: str) -> None:
        now = time.time()
        async with aiosqlite.connect(self._db) as db:
            await db.execute(
                "INSERT OR REPLACE INTO sync_failures "
                "(id,connector_id,org_id,doc_id,source_url,error_msg,"
                "retry_count,max_retries,next_retry_at,resolved,created_at,updated_at)"
                " VALUES (?,?,?,?,?,?,0,5,?,0,?,?)",
                (uuid4().hex, connector_id, org_id, doc_id,
                 source_url, error_msg, now + 300, now, now))
            await db.commit()

    async def dlq_get_due(self, org_id: str = "") -> list[dict]:
        now = time.time()
        q = ("SELECT * FROM sync_failures WHERE resolved=0 "
             "AND next_retry_at<=? AND retry_count<max_retries")
        params: list = [now]
        if org_id:
            q += " AND org_id=?"
            params.append(org_id)
        async with aiosqlite.connect(self._db) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(q, params) as c:
                rows = await c.fetchall()
        return [dict(r) for r in rows]

    async def dlq_done(self, failure_id: str, success: bool) -> None:
        now = time.time()
        async with aiosqlite.connect(self._db) as db:
            if success:
                await db.execute("UPDATE sync_failures SET resolved=1,updated_at=? WHERE id=?",
                                 (now, failure_id))
            else:
                await db.execute(
                    "UPDATE sync_failures SET retry_count=retry_count+1,"
                    "next_retry_at=?+(300*(retry_count+1)),updated_at=? WHERE id=?",
                    (now, now, failure_id))
            await db.commit()

    def _row(self, row) -> dict:
        d = dict(row)
        try:
            d["config"] = self._dec_cfg(json.loads(d.get("config", "{}")))
        except Exception:
            d["config"] = {}
        d["enabled"] = bool(d.get("enabled", 1))
        return d
