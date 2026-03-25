"""消息通知节点：飞书、钉钉、企业微信（均通过 Webhook Bot）"""

import logging
from workflow.registry import NodeRegistry, NodeTypeInfo
from workflow.types import WorkflowNode, NodeResult

logger = logging.getLogger(__name__)


async def _webhook_post(url: str, payload: dict, timeout: int = 10) -> tuple[int, str]:
    import aiohttp
    try:
        async with aiohttp.ClientSession() as s:
            async with s.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=timeout)) as r:
                return r.status, await r.text()
    except Exception as e:
        return 0, str(e)


async def _feishu(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    url = node.config.get("webhookUrl", "")
    if not url: return NodeResult(node_id=node.id, status="failed", error="webhookUrl 不能为空")
    content = node.config.get("content", "")
    mt = node.config.get("msgType", "text")
    if mt == "markdown":
        payload = {"msg_type": "interactive", "card": {"header": {"title": {"tag": "plain_text", "content": node.config.get("title", "通知")}},
            "elements": [{"tag": "markdown", "content": content}]}}
    else:
        payload = {"msg_type": "text", "content": {"text": content}}
    st, resp = await _webhook_post(url, payload)
    ok = st == 200
    return NodeResult(node_id=node.id, status="completed" if ok else "failed",
        output={"sent": ok, "status_code": st}, error="" if ok else f"飞书: {st} {resp[:100]}")


async def _dingtalk(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    url = node.config.get("webhookUrl", "")
    if not url: return NodeResult(node_id=node.id, status="failed", error="webhookUrl 不能为空")
    content = node.config.get("content", "")
    mt = node.config.get("msgType", "text")
    if mt == "markdown":
        payload = {"msgtype": "markdown", "markdown": {"title": node.config.get("title", "通知"), "text": content}}
    else:
        payload = {"msgtype": "text", "text": {"content": content}}
    st, resp = await _webhook_post(url, payload)
    ok = st == 200
    return NodeResult(node_id=node.id, status="completed" if ok else "failed",
        output={"sent": ok, "status_code": st}, error="" if ok else f"钉钉: {st}")


async def _wecom(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    url = node.config.get("webhookUrl", "")
    if not url: return NodeResult(node_id=node.id, status="failed", error="webhookUrl 不能为空")
    content = node.config.get("content", "")
    mt = node.config.get("msgType", "text")
    if mt == "markdown":
        payload = {"msgtype": "markdown", "markdown": {"content": content}}
    else:
        payload = {"msgtype": "text", "text": {"content": content}}
    st, resp = await _webhook_post(url, payload)
    ok = st == 200
    return NodeResult(node_id=node.id, status="completed" if ok else "failed",
        output={"sent": ok, "status_code": st}, error="" if ok else f"企微: {st}")


def register_messaging(registry: NodeRegistry) -> None:
    _p = [
        {"name": "webhookUrl", "type": "string", "displayName": "Webhook URL", "default": ""},
        {"name": "msgType", "type": "options", "displayName": "消息类型", "default": "text",
         "options": [{"name": "文本", "value": "text"}, {"name": "Markdown", "value": "markdown"}]},
        {"name": "title", "type": "string", "displayName": "标题", "default": "工作流通知"},
        {"name": "content", "type": "string", "displayName": "内容", "default": "", "description": "支持 {{ 表达式 }}"},
    ]
    registry.register(NodeTypeInfo(name="feishu", display_name="飞书通知", group="notify", icon="message-circle",
        description="发送消息到飞书群", parameters=_p, executor=_feishu))
    registry.register(NodeTypeInfo(name="dingtalk", display_name="钉钉通知", group="notify", icon="message-square",
        description="发送消息到钉钉群", parameters=_p, executor=_dingtalk))
    registry.register(NodeTypeInfo(name="wecom", display_name="企业微信", group="notify", icon="messages-square",
        description="发送消息到企微群", parameters=_p, executor=_wecom))
