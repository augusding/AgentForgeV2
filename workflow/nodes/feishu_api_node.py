"""飞书 API 节点：发消息/读文档/多维表格/创建任务（6种操作）。"""
from __future__ import annotations

import json
import logging
import time
from typing import Any

from workflow.registry import NodeRegistry, NodeTypeInfo
from workflow.types import WorkflowNode, NodeResult

logger = logging.getLogger(__name__)
_TOKEN_CACHE: dict[str, tuple[str, float]] = {}
_API = "https://open.feishu.cn/open-apis"


async def _get_token(app_id: str, app_secret: str) -> str:
    now = time.time()
    cached = _TOKEN_CACHE.get(app_id)
    if cached and cached[1] > now + 60: return cached[0]
    import aiohttp
    async with aiohttp.ClientSession() as s:
        async with s.post(f"{_API}/auth/v3/tenant_access_token/internal",
            json={"app_id": app_id, "app_secret": app_secret}, timeout=aiohttp.ClientTimeout(total=10)) as r:
            data = await r.json()
    if data.get("code") != 0: raise RuntimeError(f"飞书Token失败: {data.get('msg', data)}")
    token = data["tenant_access_token"]
    _TOKEN_CACHE[app_id] = (token, now + data.get("expire", 7200) - 60)
    return token


async def _api(method: str, path: str, token: str, body: dict | None = None, params: dict | None = None) -> dict:
    import aiohttp
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json; charset=utf-8"}
    async with aiohttp.ClientSession() as s:
        async with s.request(method, f"{_API}{path}", headers=headers, json=body, params=params,
                              timeout=aiohttp.ClientTimeout(total=30)) as r:
            data = await r.json()
    if data.get("code") not in (0, None): raise RuntimeError(f"飞书API {path}: {data.get('msg', '')}")
    return data


async def _send_message(token, receive_type, receive_id, msg_type, content):
    if receive_type == "email":
        r = await _api("POST", "/contact/v3/users/batch_get_id", token,
            body={"emails": [receive_id]}, params={"user_id_type": "open_id"})
        ul = r.get("data", {}).get("user_list", [])
        if not ul or not ul[0].get("user_id"): raise RuntimeError(f"邮箱 {receive_id} 未找到飞书用户")
        receive_id, receive_type = ul[0]["user_id"], "open_id"
    if msg_type == "text": mc = json.dumps({"text": str(content)}, ensure_ascii=False)
    elif isinstance(content, str):
        try: mc = json.dumps(json.loads(content), ensure_ascii=False)
        except Exception: mc = json.dumps({"zh_cn": {"title": "", "content": [[{"tag": "text", "text": content}]]}}, ensure_ascii=False)
    else: mc = json.dumps(content, ensure_ascii=False)
    r = await _api("POST", "/im/v1/messages", token,
        body={"receive_id": receive_id, "msg_type": msg_type, "content": mc}, params={"receive_id_type": receive_type})
    return {"message_id": r.get("data", {}).get("message_id", ""), "sent": True, "receive_id": receive_id}


async def _get_messages(token, chat_id, limit=20):
    r = await _api("GET", "/im/v1/messages", token,
        params={"container_id_type": "chat", "container_id": chat_id, "page_size": min(limit, 50), "sort_type": "ByCreateTimeDesc"})
    msgs = []
    for item in r.get("data", {}).get("items", []):
        cs = item.get("body", {}).get("content", "{}")
        try: text = json.loads(cs).get("text", cs)
        except Exception: text = cs
        msgs.append({"message_id": item.get("message_id"), "sender_id": item.get("sender", {}).get("id"),
                      "text": text, "create_time": item.get("create_time")})
    return {"messages": msgs, "count": len(msgs), "chat_id": chat_id}


async def _get_doc_content(token, doc_token):
    if "/" in doc_token: doc_token = doc_token.rstrip("/").split("/")[-1]
    try:
        r = await _api("GET", f"/docx/v1/documents/{doc_token}/raw_content", token)
        c = r.get("data", {}).get("content", "")
        return {"content": c, "doc_token": doc_token, "type": "docx", "length": len(c)}
    except RuntimeError:
        r = await _api("GET", f"/doc/v2/{doc_token}/content", token)
        c = r.get("data", {}).get("content", "")
        return {"content": c, "doc_token": doc_token, "type": "doc", "length": len(c)}


async def _bitable_query(token, app_token, table_id, filter_expr="", fields=None, page_size=20):
    body: dict[str, Any] = {"page_size": min(page_size, 100)}
    if filter_expr: body["filter"] = filter_expr
    if fields: body["field_names"] = fields
    r = await _api("POST", f"/bitable/v1/apps/{app_token}/tables/{table_id}/records/search", token, body=body)
    items = r.get("data", {}).get("items", [])
    return {"records": [{"record_id": i.get("record_id", ""), **i.get("fields", {})} for i in items],
            "total": r.get("data", {}).get("total", len(items))}


async def _bitable_add(token, app_token, table_id, fields):
    r = await _api("POST", f"/bitable/v1/apps/{app_token}/tables/{table_id}/records", token, body={"fields": fields})
    rec = r.get("data", {}).get("record", {})
    return {"record_id": rec.get("record_id", ""), "fields": rec.get("fields", {})}


async def _create_task(token, summary, due_time="", description="", assignee=""):
    body: dict[str, Any] = {"summary": summary, "origin": {"platform_i18n_name": '{"zh_cn": "AgentForge"}'}}
    if description: body["description"] = description
    if due_time:
        if due_time.isdigit(): ts = due_time
        else:
            try:
                import datetime; ts = str(int(datetime.datetime.strptime(due_time, "%Y-%m-%d").timestamp() * 1000))
            except Exception: ts = ""
        if ts: body["due"] = {"time": ts, "is_all_day": True}
    if assignee: body["collaborator_ids"] = [assignee]
    r = await _api("POST", "/task/v1/tasks", token, body=body)
    t = r.get("data", {}).get("task", {})
    return {"task_id": t.get("id", ""), "summary": summary, "created": True,
            "task_url": f"https://applink.feishu.cn/client/todo/task_detail?task_id={t.get('id', '')}"}


async def _feishu_api_executor(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    app_id = node.config.get("app_id", "").strip()
    app_secret = node.config.get("app_secret", "").strip()
    op = node.config.get("operation", "send_message")
    if not app_id or not app_secret:
        return NodeResult(node_id=node.id, status="failed", error="app_id 和 app_secret 不能为空")
    try: token = await _get_token(app_id, app_secret)
    except Exception as e: return NodeResult(node_id=node.id, status="failed", error=f"认证失败: {e}")
    last = ctx.get("_last_output", {})
    try:
        if op == "send_message":
            rt = node.config.get("receive_type", "chat_id")
            rid = node.config.get("receive_id", "") or (last.get("chat_id", "") if isinstance(last, dict) else "")
            mt = node.config.get("msg_type", "text")
            content = node.config.get("content", "") or (last.get("text", "") if isinstance(last, dict) else str(last))
            if not rid: return NodeResult(node_id=node.id, status="failed", error="receive_id 不能为空")
            out = await _send_message(token, rt, rid, mt, content)
        elif op == "get_messages":
            cid = node.config.get("chat_id", "")
            if not cid: return NodeResult(node_id=node.id, status="failed", error="chat_id 不能为空")
            out = await _get_messages(token, cid, int(node.config.get("limit", 20)))
        elif op == "get_doc_content":
            dt = node.config.get("doc_token", "").strip()
            if not dt: return NodeResult(node_id=node.id, status="failed", error="doc_token 不能为空")
            out = await _get_doc_content(token, dt)
        elif op == "bitable_query":
            at = node.config.get("bitable_app_token", "").strip()
            tid = node.config.get("table_id", "").strip()
            if not at or not tid: return NodeResult(node_id=node.id, status="failed", error="app_token 和 table_id 不能为空")
            fr = node.config.get("fields", "")
            flds = [f.strip() for f in fr.split(",") if f.strip()] if fr else []
            out = await _bitable_query(token, at, tid, node.config.get("filter_expr", ""), flds, int(node.config.get("page_size", 20)))
        elif op == "bitable_add":
            at = node.config.get("bitable_app_token", "").strip()
            tid = node.config.get("table_id", "").strip()
            if not at or not tid: return NodeResult(node_id=node.id, status="failed", error="app_token 和 table_id 不能为空")
            fr = node.config.get("record_fields", "")
            if isinstance(fr, str):
                try: fd = json.loads(fr) if fr.strip() else {}
                except Exception: fd = {}
            elif isinstance(fr, dict): fd = fr
            else: fd = {}
            if not fd and isinstance(last, dict): fd = {k: v for k, v in last.items() if not k.startswith("_")}
            out = await _bitable_add(token, at, tid, fd)
        elif op == "create_task":
            summary = node.config.get("summary", "") or (last.get("text", "") if isinstance(last, dict) else "")
            if not summary: return NodeResult(node_id=node.id, status="failed", error="summary 不能为空")
            out = await _create_task(token, summary, node.config.get("due_time", ""),
                                      node.config.get("description", ""), node.config.get("assignee_open_id", ""))
        else:
            return NodeResult(node_id=node.id, status="failed", error=f"未知操作: {op}")
        return NodeResult(node_id=node.id, status="completed", output=out)
    except Exception as e:
        return NodeResult(node_id=node.id, status="failed", error=str(e))


_OPS = [{"name": "发送消息", "value": "send_message"}, {"name": "获取群消息", "value": "get_messages"},
        {"name": "读取文档", "value": "get_doc_content"}, {"name": "查询多维表格", "value": "bitable_query"},
        {"name": "新增表格记录", "value": "bitable_add"}, {"name": "创建任务", "value": "create_task"}]

def register_feishu_api(registry: NodeRegistry) -> None:
    registry.register(NodeTypeInfo(
        name="feishu_api", display_name="飞书 API", group="feishu", icon="bird",
        description="飞书企业自建应用 API：发消息、读文档、操作多维表格、创建任务",
        parameters=[
            {"name": "app_id", "type": "string", "displayName": "App ID", "default": ""},
            {"name": "app_secret", "type": "string", "displayName": "App Secret", "default": ""},
            {"name": "operation", "type": "options", "displayName": "操作", "default": "send_message", "options": _OPS},
            {"name": "receive_type", "type": "options", "displayName": "接收方类型", "default": "chat_id",
             "options": [{"name": "群 chat_id", "value": "chat_id"}, {"name": "open_id", "value": "open_id"}, {"name": "邮箱", "value": "email"}],
             "displayOptions": {"show": {"operation": ["send_message"]}}},
            {"name": "receive_id", "type": "string", "displayName": "接收方ID", "default": "", "displayOptions": {"show": {"operation": ["send_message"]}}},
            {"name": "msg_type", "type": "options", "displayName": "消息类型", "default": "text",
             "options": [{"name": "纯文本", "value": "text"}, {"name": "富文本", "value": "post"}, {"name": "消息卡片", "value": "interactive"}],
             "displayOptions": {"show": {"operation": ["send_message"]}}},
            {"name": "content", "type": "string", "displayName": "消息内容", "default": "", "displayOptions": {"show": {"operation": ["send_message"]}}},
            {"name": "chat_id", "type": "string", "displayName": "群 chat_id", "default": "", "displayOptions": {"show": {"operation": ["get_messages"]}}},
            {"name": "limit", "type": "number", "displayName": "获取条数", "default": 20, "displayOptions": {"show": {"operation": ["get_messages"]}}},
            {"name": "doc_token", "type": "string", "displayName": "文档Token或URL", "default": "", "displayOptions": {"show": {"operation": ["get_doc_content"]}}},
            {"name": "bitable_app_token", "type": "string", "displayName": "多维表格AppToken", "default": "", "displayOptions": {"show": {"operation": ["bitable_query", "bitable_add"]}}},
            {"name": "table_id", "type": "string", "displayName": "数据表ID", "default": "", "displayOptions": {"show": {"operation": ["bitable_query", "bitable_add"]}}},
            {"name": "filter_expr", "type": "string", "displayName": "过滤条件", "default": "", "displayOptions": {"show": {"operation": ["bitable_query"]}}},
            {"name": "fields", "type": "string", "displayName": "返回字段", "default": "", "displayOptions": {"show": {"operation": ["bitable_query"]}}},
            {"name": "page_size", "type": "number", "displayName": "最多返回", "default": 20, "displayOptions": {"show": {"operation": ["bitable_query"]}}},
            {"name": "record_fields", "type": "json", "displayName": "字段数据JSON", "default": "{}", "displayOptions": {"show": {"operation": ["bitable_add"]}}},
            {"name": "summary", "type": "string", "displayName": "任务标题", "default": "", "displayOptions": {"show": {"operation": ["create_task"]}}},
            {"name": "description", "type": "string", "displayName": "任务描述", "default": "", "displayOptions": {"show": {"operation": ["create_task"]}}},
            {"name": "due_time", "type": "string", "displayName": "截止时间", "default": "", "displayOptions": {"show": {"operation": ["create_task"]}}},
            {"name": "assignee_open_id", "type": "string", "displayName": "负责人open_id", "default": "", "displayOptions": {"show": {"operation": ["create_task"]}}},
        ], executor=_feishu_api_executor))
