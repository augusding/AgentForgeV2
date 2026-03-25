"""AgentForge V2 — 组织管理路由"""

import json
import logging

from aiohttp import web

logger = logging.getLogger(__name__)


def _json(data, status=200):
    return web.Response(
        text=json.dumps(data, ensure_ascii=False, default=str),
        content_type="application/json", status=status,
    )


def _get_user(request) -> tuple[str, str]:
    user = request.get("user")
    if user and isinstance(user, dict):
        return user.get("sub", ""), user.get("org_id", "")
    return "", ""


async def _get_org_store(request):
    if "org_store" not in request.app:
        from memory.org_store import OrgStore
        engine = request.app["engine"]
        store = OrgStore(str(engine.root_dir / "data" / "orgs.db"))
        await store.ensure_tables()
        request.app["org_store"] = store
    return request.app["org_store"]


async def handle_org_create(request: web.Request) -> web.Response:
    """POST /api/v1/orgs"""
    store = await _get_org_store(request)
    user_id, _ = _get_user(request)
    body = await request.json()
    name = body.get("name", "")
    if not name:
        return _json({"error": "name 不能为空"}, status=400)
    org_id = await store.create_org(
        name=name, owner_id=user_id,
        industry=body.get("industry", ""),
        profile_name=body.get("profile_name", ""))
    return _json({"org_id": org_id, "name": name})


async def handle_org_list(request: web.Request) -> web.Response:
    """GET /api/v1/admin/orgs"""
    store = await _get_org_store(request)
    orgs = await store.list_orgs()
    result = []
    for o in orgs:
        count = await store.get_member_count(o["id"])
        result.append({**o, "member_count": count})
    return _json(result)


async def handle_org_detail(request: web.Request) -> web.Response:
    """GET /api/v1/orgs/{org_id}"""
    store = await _get_org_store(request)
    org_id = request.match_info["org_id"]
    org = await store.get_org(org_id)
    if not org:
        return _json({"error": "组织不存在"}, status=404)
    members = await store.get_members(org_id)
    return _json({**org, "members": members})


async def handle_org_members(request: web.Request) -> web.Response:
    """GET /api/v1/orgs/{org_id}/members"""
    store = await _get_org_store(request)
    members = await store.get_members(request.match_info["org_id"])
    return _json({"members": members})


async def handle_org_add_member(request: web.Request) -> web.Response:
    """POST /api/v1/orgs/{org_id}/members"""
    store = await _get_org_store(request)
    org_id = request.match_info["org_id"]
    body = await request.json()
    user_id = body.get("user_id", "")
    if not user_id:
        return _json({"error": "user_id 不能为空"}, status=400)
    mid = await store.add_member(org_id, user_id, role=body.get("role", "member"),
                                  position_id=body.get("position_id", ""))
    return _json({"id": mid, "status": "added"})


async def handle_org_remove_member(request: web.Request) -> web.Response:
    """DELETE /api/v1/orgs/{org_id}/members/{user_id}"""
    store = await _get_org_store(request)
    await store.remove_member(request.match_info["org_id"], request.match_info["user_id"])
    return _json({"status": "removed"})


def register(app: web.Application) -> None:
    app.router.add_post("/api/v1/orgs", handle_org_create)
    app.router.add_get("/api/v1/orgs/{org_id}", handle_org_detail)
    app.router.add_get("/api/v1/orgs/{org_id}/members", handle_org_members)
    app.router.add_post("/api/v1/orgs/{org_id}/members", handle_org_add_member)
    app.router.add_delete("/api/v1/orgs/{org_id}/members/{user_id}", handle_org_remove_member)
    app.router.add_get("/api/v1/admin/orgs", handle_org_list)
