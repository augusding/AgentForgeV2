"""HTTP 请求节点"""

import json
import logging

from workflow.registry import NodeRegistry, NodeTypeInfo
from workflow.types import WorkflowNode, NodeResult

logger = logging.getLogger(__name__)


async def _http_executor(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    import aiohttp

    method = node.config.get("method", "GET").upper()
    url = node.config.get("url", "")
    if not url:
        return NodeResult(node_id=node.id, status="failed", error="URL 不能为空")

    hdrs = node.config.get("headers", "{}")
    if isinstance(hdrs, str):
        try: hdrs = json.loads(hdrs)
        except json.JSONDecodeError: hdrs = {}

    body = node.config.get("body", "")
    body_type = node.config.get("bodyType", "json")
    timeout = node.config.get("timeout", 30)

    try:
        async with aiohttp.ClientSession() as session:
            kw: dict = {"headers": hdrs or {}, "timeout": aiohttp.ClientTimeout(total=timeout)}
            if method in ("POST", "PUT", "PATCH") and body:
                if body_type == "json":
                    try: kw["json"] = json.loads(body) if isinstance(body, str) else body
                    except json.JSONDecodeError: kw["data"] = body
                else:
                    kw["data"] = body

            async with session.request(method, url, **kw) as resp:
                ct = resp.headers.get("Content-Type", "")
                data = await resp.json() if "json" in ct else await resp.text()
                return NodeResult(node_id=node.id, status="completed", output={
                    "status_code": resp.status, "data": data, "ok": 200 <= resp.status < 300})
    except Exception as e:
        return NodeResult(node_id=node.id, status="failed", error=f"HTTP 请求失败: {e}")


def register_http(registry: NodeRegistry) -> None:
    registry.register(NodeTypeInfo(
        name="http", display_name="HTTP 请求", group="action", icon="globe",
        description="发送 HTTP 请求，支持 GET/POST/PUT/DELETE",
        parameters=[
            {"name": "method", "type": "options", "displayName": "方法", "default": "GET",
             "options": [{"name": "GET", "value": "GET"}, {"name": "POST", "value": "POST"},
                        {"name": "PUT", "value": "PUT"}, {"name": "DELETE", "value": "DELETE"}]},
            {"name": "url", "type": "string", "displayName": "URL", "default": ""},
            {"name": "headers", "type": "json", "displayName": "请求头", "default": "{}"},
            {"name": "body", "type": "json", "displayName": "请求体", "default": "",
             "displayOptions": {"show": {"method": ["POST", "PUT"]}}},
            {"name": "bodyType", "type": "options", "displayName": "Body 类型", "default": "json",
             "options": [{"name": "JSON", "value": "json"}, {"name": "文本", "value": "text"}],
             "displayOptions": {"show": {"method": ["POST", "PUT"]}}},
            {"name": "timeout", "type": "number", "displayName": "超时(秒)", "default": 30},
        ], executor=_http_executor))
