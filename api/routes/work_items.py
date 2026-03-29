"""
工位数据 CRUD API

POST   /api/v1/work-items/tasks          创建任务
PATCH  /api/v1/work-items/tasks/{id}     更新任务
DELETE /api/v1/work-items/tasks/{id}     删除任务

POST   /api/v1/work-items/schedules      创建日程
PATCH  /api/v1/work-items/schedules/{id} 更新日程
DELETE /api/v1/work-items/schedules/{id} 删除日程

POST   /api/v1/work-items/followups      创建跟进
PATCH  /api/v1/work-items/followups/{id} 更新跟进
DELETE /api/v1/work-items/followups/{id} 删除跟进

POST   /api/v1/work-items/items          创建工作项
PATCH  /api/v1/work-items/items/{id}     更新工作项
DELETE /api/v1/work-items/items/{id}     删除工作项
"""
from __future__ import annotations

import json
import logging
from aiohttp import web

logger = logging.getLogger(__name__)


def _j(data, s=200):
    return web.Response(text=json.dumps(data, ensure_ascii=False, default=str),
                        content_type="application/json", status=s)


def _user(req) -> tuple[str, str, str]:
    """提取 user_id, org_id, position_id"""
    u = req.get("user") or {}
    uid = u.get("sub", "anonymous") if isinstance(u, dict) else "anonymous"
    oid = u.get("org_id", "") if isinstance(u, dict) else ""
    return uid, oid, ""


def _store(req):
    s = req.app["engine"].work_item_store
    if not s:
        raise web.HTTPServiceUnavailable(text='{"error":"WorkItemStore 未启用"}',
                                          content_type="application/json")
    return s


async def _get_position_id(req, body=None) -> str:
    """从 body 或 assignment 获取 position_id"""
    if body and body.get("position_id"):
        return body["position_id"]
    uid, oid, _ = _user(req)
    store = _store(req)
    return await store.get_assignment(uid, oid)


# ── Tasks (priorities) ────────────────────────────────

async def create_task(req: web.Request) -> web.Response:
    store = _store(req)
    uid, oid, _ = _user(req)
    b = await req.json()
    pid = await _get_position_id(req, b)
    if not b.get("title", "").strip():
        return _j({"error": "title 必填"}, 400)
    task_id = await store.add_priority(
        uid, oid, pid,
        title=b["title"].strip(),
        description=b.get("description", ""),
        priority=b.get("priority", "P1"),
        due_date=b.get("due_date", ""),
    )
    return _j({"status": "created", "id": task_id}, 201)


async def update_task(req: web.Request) -> web.Response:
    store = _store(req)
    tid = req.match_info["id"]
    b = await req.json()
    kw = {k: v for k, v in b.items()
          if k in ("title", "description", "priority", "status", "due_date") and v is not None}
    await store.update_priority(tid, **kw)
    return _j({"status": "updated", "id": tid})


async def delete_task(req: web.Request) -> web.Response:
    store = _store(req)
    await store.delete_priority(req.match_info["id"])
    return _j({"status": "deleted"})


# ── Schedules ─────────────────────────────────────────

async def create_schedule(req: web.Request) -> web.Response:
    store = _store(req)
    uid, oid, _ = _user(req)
    b = await req.json()
    pid = await _get_position_id(req, b)
    if not b.get("title", "").strip():
        return _j({"error": "title 必填"}, 400)
    if not b.get("scheduled_time", "").strip():
        return _j({"error": "scheduled_time 必填 (YYYY-MM-DD HH:MM)"}, 400)
    sid = await store.add_schedule(
        uid, oid, pid,
        title=b["title"].strip(),
        scheduled_time=b["scheduled_time"].strip(),
        duration_minutes=int(b.get("duration_minutes", 60)),
        description=b.get("description", ""),
    )
    return _j({"status": "created", "id": sid}, 201)


async def update_schedule(req: web.Request) -> web.Response:
    store = _store(req)
    sid = req.match_info["id"]
    b = await req.json()
    kw = {k: v for k, v in b.items()
          if k in ("title", "description", "scheduled_time", "duration_minutes", "status") and v is not None}
    await store.update_schedule(sid, **kw)
    return _j({"status": "updated", "id": sid})


async def delete_schedule(req: web.Request) -> web.Response:
    store = _store(req)
    await store.delete_schedule(req.match_info["id"])
    return _j({"status": "deleted"})


# ── Followups ─────────────────────────────────────────

async def create_followup(req: web.Request) -> web.Response:
    store = _store(req)
    uid, oid, _ = _user(req)
    b = await req.json()
    pid = await _get_position_id(req, b)
    if not b.get("title", "").strip():
        return _j({"error": "title 必填"}, 400)
    fid = await store.add_followup(
        uid, oid, pid,
        title=b["title"].strip(),
        target=b.get("target", ""),
        due_date=b.get("due_date", ""),
        description=b.get("description", ""),
    )
    return _j({"status": "created", "id": fid}, 201)


async def update_followup(req: web.Request) -> web.Response:
    store = _store(req)
    fid = req.match_info["id"]
    b = await req.json()
    kw = {k: v for k, v in b.items()
          if k in ("title", "description", "target", "due_date", "status") and v is not None}
    await store.update_followup(fid, **kw)
    return _j({"status": "updated", "id": fid})


async def delete_followup(req: web.Request) -> web.Response:
    store = _store(req)
    await store.delete_followup(req.match_info["id"])
    return _j({"status": "deleted"})


# ── Work Items ────────────────────────────────────────

async def create_item(req: web.Request) -> web.Response:
    store = _store(req)
    uid, oid, _ = _user(req)
    b = await req.json()
    pid = await _get_position_id(req, b)
    if not b.get("title", "").strip():
        return _j({"error": "title 必填"}, 400)
    wid = await store.add_work_item(
        uid, oid, pid,
        title=b["title"].strip(),
        item_type=b.get("item_type", "task"),
        priority=b.get("priority", "P1"),
        description=b.get("description", ""),
        due_date=b.get("due_date", ""),
    )
    return _j({"status": "created", "id": wid}, 201)


async def update_item(req: web.Request) -> web.Response:
    store = _store(req)
    wid = req.match_info["id"]
    b = await req.json()
    kw = {k: v for k, v in b.items()
          if k in ("title", "description", "status", "priority", "due_date", "item_type") and v is not None}
    await store.update_work_item(wid, **kw)
    return _j({"status": "updated", "id": wid})


async def delete_item(req: web.Request) -> web.Response:
    store = _store(req)
    await store.delete_work_item(req.match_info["id"])
    return _j({"status": "deleted"})


async def record_suggestion_ignore(req: web.Request) -> web.Response:
    """POST /api/v1/work-items/suggestion-ignore — 记录用户忽略建议"""
    uid, oid, _ = _user(req)
    b = await req.json()
    item_type = b.get("item_type", "")
    if not item_type:
        return _j({"error": "item_type 必填"}, 400)
    engine = req.app["engine"]
    if hasattr(engine, '_signal_store') and engine._signal_store:
        from core.intent_detector import record_ignore
        pid = await _get_position_id(req, b)
        await record_ignore(engine._signal_store, uid, oid, pid, item_type)
    return _j({"status": "recorded"})


def register(app: web.Application) -> None:
    app.router.add_post("/api/v1/work-items/tasks", create_task)
    app.router.add_patch("/api/v1/work-items/tasks/{id}", update_task)
    app.router.add_delete("/api/v1/work-items/tasks/{id}", delete_task)

    app.router.add_post("/api/v1/work-items/schedules", create_schedule)
    app.router.add_patch("/api/v1/work-items/schedules/{id}", update_schedule)
    app.router.add_delete("/api/v1/work-items/schedules/{id}", delete_schedule)

    app.router.add_post("/api/v1/work-items/followups", create_followup)
    app.router.add_patch("/api/v1/work-items/followups/{id}", update_followup)
    app.router.add_delete("/api/v1/work-items/followups/{id}", delete_followup)

    app.router.add_post("/api/v1/work-items/items", create_item)
    app.router.add_patch("/api/v1/work-items/items/{id}", update_item)
    app.router.add_delete("/api/v1/work-items/items/{id}", delete_item)
    app.router.add_post("/api/v1/work-items/suggestion-ignore", record_suggestion_ignore)
