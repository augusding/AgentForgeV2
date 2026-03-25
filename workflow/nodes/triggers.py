"""触发器节点：manualTrigger, scheduleTrigger, webhookTrigger"""

import time
import datetime

from workflow.registry import NodeRegistry, NodeTypeInfo
from workflow.types import WorkflowNode, NodeResult


async def _manual(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    return NodeResult(node_id=node.id, status="completed", output={"trigger": "manual"})


async def _schedule(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    now = datetime.datetime.now()
    return NodeResult(node_id=node.id, status="completed", output={
        "trigger": "schedule", "triggered_at": now.isoformat(),
        "timestamp": time.time(), "date": now.strftime("%Y-%m-%d"), "time": now.strftime("%H:%M:%S"),
    })


async def _webhook(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    data = ctx.get("trigger_data", variables.get("trigger_data", {}))
    return NodeResult(node_id=node.id, status="completed", output={"trigger": "webhook", "body": data})


def register_triggers(registry: NodeRegistry) -> None:
    registry.register(NodeTypeInfo(
        name="manualTrigger", display_name="手动触发", group="trigger", icon="play",
        inputs=0, outputs=1, description="手动启动工作流", executor=_manual))
    registry.register(NodeTypeInfo(
        name="scheduleTrigger", display_name="定时触发", group="trigger", icon="clock",
        inputs=0, outputs=1, description="按 Cron 表达式定时触发",
        parameters=[{"name": "cron", "type": "string", "displayName": "Cron 表达式", "default": "0 9 * * *"}],
        executor=_schedule))
    registry.register(NodeTypeInfo(
        name="webhookTrigger", display_name="Webhook 触发", group="trigger", icon="webhook",
        inputs=0, outputs=1, description="接收 HTTP 请求触发", executor=_webhook))
