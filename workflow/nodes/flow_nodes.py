"""流程控制节点：loop, delay, merge, subWorkflow"""

import asyncio
import json
import logging
import time

from workflow.registry import NodeRegistry, NodeTypeInfo
from workflow.types import WorkflowNode, NodeResult

logger = logging.getLogger(__name__)


async def _loop_executor(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    items_raw = node.config.get("items", "")
    if items_raw and isinstance(items_raw, str):
        try: items = json.loads(items_raw)
        except json.JSONDecodeError: items = []
    elif isinstance(items_raw, list): items = items_raw
    else:
        last = ctx.get("_last_output", {})
        items = last.get("items", last.get("data", [last] if last else []))
        if not isinstance(items, list): items = [items]

    items = items[:int(node.config.get("maxIterations", 100))]
    expression = node.config.get("expression", "")
    results = []
    for i, item in enumerate(items):
        if expression:
            from workflow.expression import ExprContext
            ec = ExprContext(input_data=item if isinstance(item, dict) else {"value": item, "index": i},
                            variables={**variables, "_index": i, "_item": item})
            r = ec.resolve(expression)
            results.append(r if isinstance(r, dict) else {"result": r, "index": i})
        else:
            results.append(item if isinstance(item, dict) else {"value": item, "index": i})
    return NodeResult(node_id=node.id, status="completed", output={"items": results, "count": len(results)})


async def _delay_executor(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    secs = float(node.config.get("seconds", 1))
    unit = node.config.get("unit", "seconds")
    if unit == "minutes": secs *= 60
    await asyncio.sleep(min(secs, 3600))
    return NodeResult(node_id=node.id, status="completed", output={"delayed": secs, "resumed_at": time.time()})


async def _merge_executor(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    mode = node.config.get("mode", "combine")
    outputs = ctx.get("_node_outputs", {})
    if mode == "append":
        all_items = []
        for out in outputs.values():
            if isinstance(out, dict):
                it = out.get("items", out.get("data", []))
                all_items.extend(it if isinstance(it, list) else [out])
            elif isinstance(out, list): all_items.extend(out)
        return NodeResult(node_id=node.id, status="completed", output={"items": all_items, "count": len(all_items)})
    combined = {nid: (o if isinstance(o, dict) else {"value": o}) for nid, o in outputs.items()}
    return NodeResult(node_id=node.id, status="completed", output={"merged": combined, "sources": len(outputs)})


async def _sub_workflow_executor(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    wf_id = node.config.get("workflowId", "")
    if not wf_id: return NodeResult(node_id=node.id, status="failed", error="workflowId 不能为空")
    engine, store = ctx.get("wf_engine"), ctx.get("wf_store")
    if not engine or not store:
        return NodeResult(node_id=node.id, status="failed", error="工作流引擎不可用")
    try:
        wf = await store.get_workflow(wf_id)
        if not wf: return NodeResult(node_id=node.id, status="failed", error=f"工作流不存在: {wf_id}")
        trigger = ctx.get("_last_output", {})
        execution = await engine.run(wf, trigger_data=trigger, context=ctx)
        return NodeResult(node_id=node.id, status=execution.status, output={
            "execution_id": execution.id, "status": execution.status,
            "variables": execution.variables, "duration": execution.completed_at - execution.started_at,
        }, error=execution.error)
    except Exception as e:
        return NodeResult(node_id=node.id, status="failed", error=f"子工作流失败: {e}")


def register_flow(registry: NodeRegistry) -> None:
    registry.register(NodeTypeInfo(name="loop", display_name="循环", group="logic", icon="repeat",
        description="遍历列表数据", parameters=[
            {"name": "items", "type": "json", "displayName": "数据列表", "default": "[]"},
            {"name": "expression", "type": "string", "displayName": "表达式", "default": ""},
            {"name": "maxIterations", "type": "number", "displayName": "最大次数", "default": 100},
        ], executor=_loop_executor))
    registry.register(NodeTypeInfo(name="delay", display_name="延时", group="logic", icon="timer",
        description="等待后继续", parameters=[
            {"name": "seconds", "type": "number", "displayName": "时间", "default": 5},
            {"name": "unit", "type": "options", "displayName": "单位", "default": "seconds",
             "options": [{"name": "秒", "value": "seconds"}, {"name": "分钟", "value": "minutes"}]},
        ], executor=_delay_executor))
    registry.register(NodeTypeInfo(name="merge", display_name="合并", group="logic", icon="git-merge",
        description="合并多分支数据", inputs=2, parameters=[
            {"name": "mode", "type": "options", "displayName": "模式", "default": "combine",
             "options": [{"name": "拼接", "value": "append"}, {"name": "合并", "value": "combine"}]},
        ], executor=_merge_executor))
    registry.register(NodeTypeInfo(name="subWorkflow", display_name="子工作流", group="logic", icon="git-fork",
        description="调用另一个工作流", parameters=[
            {"name": "workflowId", "type": "string", "displayName": "工作流 ID", "default": ""},
        ], executor=_sub_workflow_executor))
