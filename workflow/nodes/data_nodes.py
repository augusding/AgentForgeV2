"""数据处理节点：transform, approval, kvStore"""

import json
import logging
import time
from pathlib import Path

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
    message = node.config.get("message", "请审批")
    if node.config.get("autoApprove", True):
        return NodeResult(node_id=node.id, status="completed", output={
            "approved": True, "approver": approver or "auto", "message": message, "_output_index": 0})
    return NodeResult(node_id=node.id, status="waiting_approval", output={"approved": None, "approver": approver})


_kv: dict = {}
_KV_FILE = Path("data/workflow_kv.json")

def _load_kv():
    global _kv
    if _KV_FILE.exists():
        try: _kv = json.loads(_KV_FILE.read_text(encoding="utf-8"))
        except Exception: _kv = {}

def _save_kv():
    _KV_FILE.parent.mkdir(parents=True, exist_ok=True)
    _KV_FILE.write_text(json.dumps(_kv, ensure_ascii=False, indent=2), encoding="utf-8")


async def _kv_executor(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    _load_kv()
    action = node.config.get("action", "get")
    key = node.config.get("key", "")
    if not key: return NodeResult(node_id=node.id, status="failed", error="key 不能为空")

    if action == "get":
        return NodeResult(node_id=node.id, status="completed", output={"key": key, "value": _kv.get(key), "exists": key in _kv})
    if action == "set":
        val = node.config.get("value", "") or ctx.get("_last_output", {})
        if isinstance(val, str):
            try: val = json.loads(val)
            except json.JSONDecodeError: pass
        _kv[key] = val; _save_kv()
        return NodeResult(node_id=node.id, status="completed", output={"key": key, "value": val})
    if action == "delete":
        existed = key in _kv; _kv.pop(key, None); _save_kv()
        return NodeResult(node_id=node.id, status="completed", output={"key": key, "deleted": existed})
    if action == "list":
        matching = {k: v for k, v in _kv.items() if k.startswith(key)}
        return NodeResult(node_id=node.id, status="completed", output={"keys": list(matching.keys()), "count": len(matching)})
    return NodeResult(node_id=node.id, status="failed", error=f"未知操作: {action}")


def register_data_nodes(registry: NodeRegistry) -> None:
    registry.register(NodeTypeInfo(name="transform", display_name="数据转换", group="data", icon="shuffle",
        description="字段映射、过滤、重命名", parameters=[
            {"name": "mappings", "type": "json", "displayName": "字段映射", "default": "{}"},
            {"name": "filter", "type": "string", "displayName": "过滤条件", "default": ""},
        ], executor=_transform_executor))
    registry.register(NodeTypeInfo(name="approval", display_name="审批", group="action", icon="user-check",
        description="等待人工审批", outputs=2, output_names=["approved", "rejected"], parameters=[
            {"name": "approver", "type": "string", "displayName": "审批人", "default": ""},
            {"name": "message", "type": "string", "displayName": "说明", "default": "请审批"},
            {"name": "autoApprove", "type": "boolean", "displayName": "自动通过", "default": True},
        ], executor=_approval_executor))
    registry.register(NodeTypeInfo(name="kvStore", display_name="数据存储", group="data", icon="hard-drive",
        description="工作流间共享键值存储", parameters=[
            {"name": "action", "type": "options", "displayName": "操作", "default": "get",
             "options": [{"name": "读取", "value": "get"}, {"name": "写入", "value": "set"},
                        {"name": "删除", "value": "delete"}, {"name": "列出", "value": "list"}]},
            {"name": "key", "type": "string", "displayName": "键名", "default": ""},
            {"name": "value", "type": "json", "displayName": "值", "default": ""},
        ], executor=_kv_executor))
