"""通知节点：notification（系统通知）"""

import asyncio
import logging

from workflow.registry import NodeRegistry, NodeTypeInfo
from workflow.expression import ExprContext
from workflow.types import WorkflowNode, NodeResult

logger = logging.getLogger(__name__)


async def _notification(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    expr_ctx = ExprContext(input_data=ctx.get("_last_output"), variables=variables, parameters=node.config)
    title = expr_ctx.resolve(node.config.get("title", "工作流通知"))
    message = expr_ctx.resolve(node.config.get("message", ""))

    logger.info("工作流通知: %s — %s", title, message)

    gateway = ctx.get("gateway")
    user_id = ctx.get("user_id", "")
    if gateway and user_id:
        try:
            import asyncio
            asyncio.create_task(gateway.push_to_user(user_id, {
                "type": "workflow_notification", "title": title, "message": message}))
        except Exception:
            pass

    return NodeResult(node_id=node.id, status="completed", output={
        "notification_sent": True, "title": title, "message": message})


def register_notify(registry: NodeRegistry) -> None:
    registry.register(NodeTypeInfo(
        name="notification", display_name="系统通知", group="notify", icon="bell",
        description="发送系统内通知消息",
        parameters=[
            {"name": "title", "type": "string", "displayName": "标题", "default": "工作流通知"},
            {"name": "message", "type": "string", "displayName": "内容", "default": ""},
            {"name": "channel", "type": "options", "displayName": "方式", "default": "system",
             "options": [{"name": "系统通知", "value": "system"}, {"name": "仅日志", "value": "log"}]},
        ],
        executor=_notification))
