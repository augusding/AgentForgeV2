"""
企业知识库连接器 API

GET    /api/v1/connectors              列表
POST   /api/v1/connectors              创建
GET    /api/v1/connectors/{id}         详情
PATCH  /api/v1/connectors/{id}         更新
DELETE /api/v1/connectors/{id}         删除
POST   /api/v1/connectors/{id}/test    测试连接
POST   /api/v1/connectors/{id}/sync    触发同步
GET    /api/v1/connectors/{id}/status  同步状态
GET    /api/v1/connector-types         可用类型及 Schema
"""
from __future__ import annotations

import asyncio
import json
import logging
import traceback

from aiohttp import web

logger = logging.getLogger(__name__)

_SENSITIVE = {"token", "password", "api_key", "secret", "access_token", "private_key", "client_secret"}


def _j(data, s: int = 200) -> web.Response:
    return web.Response(text=json.dumps(data, ensure_ascii=False, default=str),
                        content_type="application/json", status=s)

def _org_actor(req) -> tuple[str, str]:
    u = req.get("user") or {}
    if isinstance(u, dict):
        return u.get("org_id", "_default"), u.get("sub", "user")
    return "_default", "user"

def _mask(cfg: dict) -> dict:
    return {k: "***" if any(s in k.lower() for s in _SENSITIVE) else v for k, v in cfg.items()}


async def handle_list(req: web.Request) -> web.Response:
    org, _ = _org_actor(req)
    store = req.app["engine"].connector_store
    if not store: return _j({"connectors": []})
    items = await store.list_by_org(org)
    for i in items: i["config"] = _mask(i.get("config", {}))
    return _j({"connectors": items})

async def handle_create(req: web.Request) -> web.Response:
    org, actor = _org_actor(req)
    store = req.app["engine"].connector_store
    if not store: return _j({"error": "连接器功能未启用"}, 503)
    try:
        b = await req.json()
        name, ct = b.get("name", "").strip(), b.get("connector_type", "").strip()
        if not name or not ct: return _j({"error": "name 和 connector_type 必填"}, 400)
        item = await store.create(org, name, ct, b.get("config", {}),
                                   int(b.get("sync_interval_minutes", 60)), actor)
        item["config"] = _mask(item.get("config", {}))
        return _j({"connector": item}, 201)
    except Exception as e:
        traceback.print_exc()
        return _j({"error": str(e)}, 500)

async def handle_get(req: web.Request) -> web.Response:
    store = req.app["engine"].connector_store
    item = await store.get(req.match_info["id"]) if store else None
    if not item: return _j({"error": "not found"}, 404)
    item["config"] = _mask(item.get("config", {}))
    return _j({"connector": item})

async def handle_update(req: web.Request) -> web.Response:
    cid = req.match_info["id"]
    _, actor = _org_actor(req)
    store = req.app["engine"].connector_store
    if not store: return _j({"error": "未启用"}, 503)
    try:
        b = await req.json()
        kw = {k: b[k] for k in ("name", "config", "enabled", "sync_interval_minutes", "scope") if k in b}
        item = await store.update(cid, actor=actor, **kw)
        if not item: return _j({"error": "not found"}, 404)
        item["config"] = _mask(item.get("config", {}))
        return _j({"connector": item})
    except Exception as e:
        return _j({"error": str(e)}, 500)

async def handle_delete(req: web.Request) -> web.Response:
    cid = req.match_info["id"]
    _, actor = _org_actor(req)
    store = req.app["engine"].connector_store
    if store and await store.delete(cid, actor):
        return _j({"status": "deleted", "id": cid})
    return _j({"error": "not found"}, 404)

async def handle_test(req: web.Request) -> web.Response:
    cid = req.match_info["id"]
    store = req.app["engine"].connector_store
    cfg = await store.get(cid) if store else None
    if not cfg: return _j({"error": "not found"}, 404)
    try:
        from knowledge.connectors.registry import get_registry
        adapter = get_registry().build(cid, cfg["connector_type"], cfg["config"])
        ok, msg = await adapter.validate()
        if ok and store: await store.update(cid, scope=msg)
        return _j({"ok": ok, "message": msg})
    except Exception as e:
        return _j({"ok": False, "message": str(e)})

async def handle_sync(req: web.Request) -> web.Response:
    cid = req.match_info["id"]
    org, _ = _org_actor(req)
    sm = getattr(req.app["engine"], "sync_manager", None)
    if not sm: return _j({"error": "SyncManager 未初始化"}, 503)
    if sm.is_running(cid): return _j({"status": "already_running", "connector_id": cid})
    b = {}
    try: b = await req.json()
    except Exception: pass
    asyncio.create_task(sm.sync(cid, org_id=org, force_full=b.get("force_full", False)))
    return _j({"status": "started", "connector_id": cid})

async def handle_status(req: web.Request) -> web.Response:
    cid = req.match_info["id"]
    engine = req.app["engine"]
    store = getattr(engine, "connector_store", None)
    sm = getattr(engine, "sync_manager", None)
    cfg = await store.get(cid) if store else None
    if not cfg: return _j({"error": "not found"}, 404)
    return _j({
        "connector_id": cid, "running": sm.is_running(cid) if sm else False,
        "circuit": sm.circuit_status(cid) if sm else {},
        "last_sync_at": cfg.get("last_sync_at"), "last_sync_status": cfg.get("last_sync_status"),
        "last_sync_count": cfg.get("last_sync_count"),
    })

async def handle_types(req: web.Request) -> web.Response:
    from knowledge.connectors.registry import get_registry
    return _j({"types": get_registry().list_types()})


def register(app: web.Application) -> None:
    app.router.add_get("/api/v1/connectors", handle_list)
    app.router.add_post("/api/v1/connectors", handle_create)
    app.router.add_get("/api/v1/connectors/{id}", handle_get)
    app.router.add_patch("/api/v1/connectors/{id}", handle_update)
    app.router.add_delete("/api/v1/connectors/{id}", handle_delete)
    app.router.add_post("/api/v1/connectors/{id}/test", handle_test)
    app.router.add_post("/api/v1/connectors/{id}/sync", handle_sync)
    app.router.add_get("/api/v1/connectors/{id}/status", handle_status)
    app.router.add_get("/api/v1/connector-types", handle_types)
