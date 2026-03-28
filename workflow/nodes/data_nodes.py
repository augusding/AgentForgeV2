"""数据处理节点：transform, approval, kvStore"""

import json
import logging
import os as _os
import time as _time_mod

import aiosqlite as _aiosqlite

from workflow.registry import NodeRegistry, NodeTypeInfo
from workflow.expression import ExprContext
from workflow.types import WorkflowNode, NodeResult

logger = logging.getLogger(__name__)


async def _transform_executor(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    last = ctx.get("_last_output", {})
    items = last.get("items", [last] if last else [])
    if not isinstance(items, list): items = [items]

    mappings_raw = node.config.get("mappings", "{}")
    mappings = json.loads(mappings_raw) if isinstance(mappings_raw, str) else (mappings_raw or {})
    if isinstance(mappings, str): mappings = {}
    filter_expr = node.config.get("filter", "")
    results = []

    for item in items:
        data = item if isinstance(item, dict) else {"value": item}
        if filter_expr:
            ec = ExprContext(input_data=data, variables=variables)
            if not ec.resolve(f"{{{{ {filter_expr} }}}}"): continue
        if mappings:
            ec = ExprContext(input_data=data, variables=variables)
            results.append({k: ec.resolve(v) if isinstance(v, str) and "{{" in v else v for k, v in mappings.items()})
        else:
            results.append(data)

    return NodeResult(node_id=node.id, status="completed", output={"items": results, "count": len(results), "original_count": len(items)})


async def _approval_executor(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    approver = node.config.get("approver", "")
    message = node.config.get("message", "请审批此工作流步骤")
    title = node.config.get("title", "工作流审批请求")
    if node.config.get("autoApprove", False):
        return NodeResult(node_id=node.id, status="completed", output={
            "approved": True, "approver": approver or "auto", "message": message, "_output_index": 0})
    exec_id = variables.get("_execution_id", "")
    gateway, uid = ctx.get("gateway"), ctx.get("user_id", "")
    if gateway and uid:
        try:
            import asyncio as _a
            _a.create_task(gateway.push_to_user(uid, {"type": "approval_required",
                "execution_id": exec_id, "node_id": node.id, "title": title, "message": message}))
        except Exception: pass
    return NodeResult(node_id=node.id, status="waiting_approval",
        output={"approved": None, "approver": approver, "execution_id": exec_id, "node_id": node.id})


_KV_DB = _os.path.join(_os.environ.get("AGENTFORGE_ROOT", "."), "data", "workflow_kv.db")


async def _kv_ensure(db):
    await db.execute("CREATE TABLE IF NOT EXISTS kv_store (org_id TEXT NOT NULL DEFAULT '', key TEXT NOT NULL, value TEXT NOT NULL DEFAULT '{}', updated_at REAL NOT NULL, PRIMARY KEY (org_id, key))")
    await db.commit()


async def _kv_executor(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    action = node.config.get("action", "get")
    key = node.config.get("key", "")
    scope = node.config.get("scope", "org")
    if scope == "global": org_id = "__global__"
    elif scope == "private": org_id = f"__private__{variables.get('_workflow_id', '')}"
    else: org_id = ctx.get("org_id") or variables.get("org_id", "")
    if not key:
        return NodeResult(node_id=node.id, status="failed", error="key 不能为空")
    _os.makedirs(_os.path.dirname(_KV_DB), exist_ok=True)
    try:
        async with _aiosqlite.connect(_KV_DB) as db:
            db.row_factory = _aiosqlite.Row
            await _kv_ensure(db)
            if action == "get":
                cur = await db.execute("SELECT value FROM kv_store WHERE org_id=? AND key=?", (org_id, key))
                row = await cur.fetchone()
                if row:
                    try: val = json.loads(row["value"])
                    except Exception: val = row["value"]
                    return NodeResult(node_id=node.id, status="completed", output={"key": key, "value": val, "exists": True})
                return NodeResult(node_id=node.id, status="completed", output={"key": key, "value": None, "exists": False})
            if action == "set":
                val = node.config.get("value")
                if val is None: val = ctx.get("_last_output", {})
                vs = json.dumps(val, ensure_ascii=False) if not isinstance(val, str) else val
                await db.execute("INSERT OR REPLACE INTO kv_store VALUES (?,?,?,?)", (org_id, key, vs, _time_mod.time()))
                await db.commit()
                try: ov = json.loads(vs)
                except Exception: ov = vs
                return NodeResult(node_id=node.id, status="completed", output={"key": key, "value": ov})
            if action == "delete":
                cur = await db.execute("DELETE FROM kv_store WHERE org_id=? AND key=?", (org_id, key))
                await db.commit()
                return NodeResult(node_id=node.id, status="completed", output={"key": key, "deleted": cur.rowcount > 0})
            if action == "list":
                cur = await db.execute("SELECT key FROM kv_store WHERE org_id=? AND key LIKE ?", (org_id, key + "%"))
                keys = [r["key"] for r in await cur.fetchall()]
                return NodeResult(node_id=node.id, status="completed", output={"keys": keys, "count": len(keys)})
        return NodeResult(node_id=node.id, status="failed", error=f"未知操作: {action}")
    except Exception as e:
        return NodeResult(node_id=node.id, status="failed", error=f"KV 操作失败: {e}")


def register_data_nodes(registry: NodeRegistry) -> None:
    registry.register(NodeTypeInfo(name="transform", display_name="数据转换", group="data", icon="shuffle",
        description="字段映射、过滤、重命名", parameters=[
            {"name": "mappings", "type": "json", "displayName": "字段映射", "default": "{}"},
            {"name": "filter", "type": "string", "displayName": "过滤条件", "default": ""},
        ], executor=_transform_executor))
    registry.register(NodeTypeInfo(name="approval", display_name="审批", group="action", icon="user-check",
        description="等待人工审批，通过后继续执行", outputs=2, output_names=["approved", "rejected"], parameters=[
            {"name": "title", "type": "string", "displayName": "审批标题", "default": "工作流审批请求"},
            {"name": "approver", "type": "string", "displayName": "审批人", "default": ""},
            {"name": "message", "type": "string", "displayName": "审批说明", "default": "请审批此工作流步骤"},
            {"name": "autoApprove", "type": "boolean", "displayName": "自动通过（调试）", "default": False},
        ], executor=_approval_executor))
    registry.register(NodeTypeInfo(name="kvStore", display_name="数据存储", group="data", icon="hard-drive",
        description="工作流间共享键值存储（按组织/全局/私有隔离）", parameters=[
            {"name": "action", "type": "options", "displayName": "操作", "default": "get",
             "options": [{"name": "读取", "value": "get"}, {"name": "写入", "value": "set"},
                        {"name": "删除", "value": "delete"}, {"name": "列出", "value": "list"}]},
            {"name": "key", "type": "string", "displayName": "键名", "default": ""},
            {"name": "value", "type": "json", "displayName": "值", "default": ""},
            {"name": "scope", "type": "options", "displayName": "共享范围", "default": "org",
             "options": [{"name": "组织内共享", "value": "org"}, {"name": "全局共享", "value": "global"},
                        {"name": "工作流私有", "value": "private"}]},
        ], executor=_kv_executor))
