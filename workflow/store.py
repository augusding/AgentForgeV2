"""
AgentForge V2 — 工作流存储

持久化工作流定义 + 执行记录到 SQLite。
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

import aiosqlite

from memory.base import BaseStore
from workflow.types import WorkflowDefinition, WorkflowNode

logger = logging.getLogger(__name__)


class WorkflowStore(BaseStore):
    """工作流定义 + 执行记录存储。"""

    async def _create_tables(self, db: aiosqlite.Connection) -> None:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS workflows (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                org_id TEXT DEFAULT '',
                position_id TEXT DEFAULT '',
                nodes TEXT DEFAULT '[]',
                edges TEXT DEFAULT '[]',
                trigger_config TEXT DEFAULT '{}',
                variables TEXT DEFAULT '{}',
                version INTEGER DEFAULT 1,
                enabled INTEGER DEFAULT 1,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS workflow_executions (
                id TEXT PRIMARY KEY,
                workflow_id TEXT NOT NULL,
                status TEXT DEFAULT 'running',
                trigger_type TEXT DEFAULT 'manual',
                trigger_data TEXT DEFAULT '{}',
                node_results TEXT DEFAULT '{}',
                variables TEXT DEFAULT '{}',
                error TEXT DEFAULT '',
                started_at REAL NOT NULL,
                completed_at REAL DEFAULT 0,
                FOREIGN KEY (workflow_id) REFERENCES workflows(id)
            )
        """)
        await db.execute("CREATE INDEX IF NOT EXISTS idx_wf_org ON workflows(org_id)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_wfexec_wf ON workflow_executions(workflow_id)")
        for col, dflt in [("timeout_seconds", "300")]:
            try: await db.execute(f"ALTER TABLE workflows ADD COLUMN {col} INTEGER DEFAULT {dflt}")
            except Exception: pass

    # ── 工作流定义 ────────────────────────────────────────

    async def save_workflow(self, wf: WorkflowDefinition) -> None:
        """保存/更新工作流定义。"""
        await self.ensure_tables()
        now = time.time()
        nodes_json = json.dumps([self._node_to_dict(n) for n in wf.nodes], ensure_ascii=False)
        edges_json = json.dumps(wf.edges, ensure_ascii=False)

        async with self._db() as db:
            await db.execute(
                "INSERT OR REPLACE INTO workflows "
                "(id, name, description, org_id, position_id, nodes, edges, trigger_config, "
                "variables, version, enabled, timeout_seconds, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (wf.id, wf.name, wf.description, wf.org_id, wf.position_id,
                 nodes_json, edges_json, json.dumps(wf.trigger, ensure_ascii=False),
                 json.dumps({**wf.variables, **({'_on_error_notify': wf.on_error_notify} if getattr(wf, 'on_error_notify', None) else {})}, ensure_ascii=False),
                 wf.version, 1 if wf.enabled else 0,
                 getattr(wf, 'timeout_seconds', 300), now, now),
            )
            await db.commit()

    async def get_workflow(self, workflow_id: str) -> WorkflowDefinition | None:
        """获取工作流定义。"""
        await self.ensure_tables()
        async with self._db() as db:
            cursor = await db.execute("SELECT * FROM workflows WHERE id = ?", (workflow_id,))
            row = await cursor.fetchone()
            if not row:
                return None
            return self._row_to_workflow(dict(row))

    async def list_workflows(self, org_id: str = "", position_id: str = "") -> list[dict]:
        """列出工作流。"""
        await self.ensure_tables()
        query = "SELECT id, name, description, position_id, enabled, version, updated_at FROM workflows WHERE 1=1"
        params: list[Any] = []
        if org_id:
            query += " AND org_id = ?"
            params.append(org_id)
        if position_id:
            query += " AND position_id = ?"
            params.append(position_id)
        query += " ORDER BY updated_at DESC"

        async with self._db() as db:
            cursor = await db.execute(query, params)
            return [dict(r) for r in await cursor.fetchall()]

    async def delete_workflow(self, workflow_id: str) -> None:
        await self.ensure_tables()
        async with self._db() as db:
            await db.execute("DELETE FROM workflow_executions WHERE workflow_id = ?", (workflow_id,))
            await db.execute("DELETE FROM workflows WHERE id = ?", (workflow_id,))
            await db.commit()

    # ── 执行记录 ──────────────────────────────────────────

    async def save_execution(self, exec_id: str, workflow_id: str, status: str,
                             node_results: dict, variables: dict,
                             trigger_type: str = "manual", trigger_data: dict | None = None,
                             error: str = "", started_at: float = 0, completed_at: float = 0) -> None:
        await self.ensure_tables()
        async with self._db() as db:
            await db.execute(
                "INSERT OR REPLACE INTO workflow_executions "
                "(id, workflow_id, status, trigger_type, trigger_data, node_results, "
                "variables, error, started_at, completed_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (exec_id, workflow_id, status, trigger_type,
                 json.dumps(trigger_data or {}, ensure_ascii=False),
                 json.dumps(node_results, ensure_ascii=False, default=str),
                 json.dumps(variables, ensure_ascii=False, default=str),
                 error, started_at, completed_at),
            )
            await db.commit()

    async def get_executions(self, workflow_id: str, limit: int = 20) -> list[dict]:
        await self.ensure_tables()
        async with self._db() as db:
            cursor = await db.execute(
                "SELECT * FROM workflow_executions WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ?",
                (workflow_id, limit),
            )
            rows = await cursor.fetchall()
            results = []
            for r in rows:
                d = dict(r)
                d["node_results"] = json.loads(d.get("node_results", "{}"))
                d["variables"] = json.loads(d.get("variables", "{}"))
                d["trigger_data"] = json.loads(d.get("trigger_data", "{}"))
                results.append(d)
            return results

    async def get_execution(self, exec_id: str) -> dict | None:
        await self.ensure_tables()
        async with self._db() as db:
            cursor = await db.execute("SELECT * FROM workflow_executions WHERE id = ?", (exec_id,))
            row = await cursor.fetchone()
        if not row: return None
        d = dict(row)
        d["node_results"] = json.loads(d.get("node_results", "{}"))
        d["variables"] = json.loads(d.get("variables", "{}"))
        d["trigger_data"] = json.loads(d.get("trigger_data", "{}"))
        return d

    async def update_execution_status(self, exec_id: str, status: str,
                                       node_results: dict | None = None, variables: dict | None = None,
                                       error: str = "", completed_at: float = 0) -> None:
        await self.ensure_tables()
        async with self._db() as db:
            fields, params = ["status = ?"], [status]
            if node_results is not None: fields.append("node_results = ?"); params.append(json.dumps(node_results, ensure_ascii=False, default=str))
            if variables is not None: fields.append("variables = ?"); params.append(json.dumps(variables, ensure_ascii=False, default=str))
            if error: fields.append("error = ?"); params.append(error)
            if completed_at: fields.append("completed_at = ?"); params.append(completed_at)
            params.append(exec_id)
            await db.execute(f"UPDATE workflow_executions SET {', '.join(fields)} WHERE id = ?", params)
            await db.commit()

    async def list_pending_approvals(self, org_id: str = "") -> list[dict]:
        await self.ensure_tables()
        async with self._db() as db:
            cursor = await db.execute("SELECT * FROM workflow_executions WHERE status = 'paused' ORDER BY started_at DESC")
            rows = [dict(r) for r in await cursor.fetchall()]
        for d in rows:
            d["node_results"] = json.loads(d.get("node_results", "{}"))
            d["variables"] = json.loads(d.get("variables", "{}"))
        return rows

    async def list_by_status(self, status: str, limit: int = 100) -> list[dict]:
        await self.ensure_tables()
        async with self._db() as db:
            cursor = await db.execute("SELECT * FROM workflow_executions WHERE status=? ORDER BY started_at DESC LIMIT ?", (status, limit))
            rows = [dict(r) for r in await cursor.fetchall()]
        for d in rows:
            d["node_results"] = json.loads(d.get("node_results", "{}"))
            d["variables"] = json.loads(d.get("variables", "{}"))
        return rows

    # ── 工具方法 ──────────────────────────────────────────

    @staticmethod
    def _node_to_dict(node: WorkflowNode) -> dict:
        return {
            "id": node.id, "type": node.type, "label": node.label,
            "config": node.config, "inputs": node.inputs, "outputs": node.outputs,
            "next_nodes": node.next_nodes, "position": node.position,
            "disabled": node.disabled, "retry_count": node.retry_count, "retry_delay": node.retry_delay,
            "on_error": getattr(node, 'on_error', 'stop'),
        }

    @staticmethod
    def _row_to_workflow(row: dict) -> WorkflowDefinition:
        nodes_raw = json.loads(row.get("nodes", "[]"))
        nodes = [WorkflowNode(**n) for n in nodes_raw]
        return WorkflowDefinition(
            id=row["id"], name=row["name"],
            description=row.get("description", ""),
            org_id=row.get("org_id", ""),
            position_id=row.get("position_id", ""),
            nodes=nodes,
            edges=json.loads(row.get("edges", "[]")),
            trigger=json.loads(row.get("trigger_config", "{}")),
            variables=json.loads(row.get("variables", "{}")),
            version=row.get("version", 1),
            enabled=bool(row.get("enabled", 1)),
            timeout_seconds=row.get("timeout_seconds", 300) or 300,
        )
