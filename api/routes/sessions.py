"""
AgentForge V2 — 会话路由

会话列表、历史查询、会话管理。
"""

from __future__ import annotations

import json

from aiohttp import web


def _json(data, status: int = 200) -> web.Response:
    return web.Response(
        text=json.dumps(data, ensure_ascii=False, default=str),
        content_type="application/json", status=status,
    )


async def handle_sessions_list(request: web.Request) -> web.Response:
    """GET /api/v1/sessions?user_id=xxx&position_id=yyy"""
    engine = request.app["engine"]
    user_id = request.query.get("user_id", "anonymous")
    org_id = request.query.get("org_id", "")
    position_id = request.query.get("position_id", "")
    limit = int(request.query.get("limit", "20"))

    sessions = await engine.session_store.list_sessions(
        user_id=user_id, org_id=org_id, position_id=position_id, limit=limit,
    )
    return _json({"sessions": sessions})


async def handle_session_history(request: web.Request) -> web.Response:
    """GET /api/v1/sessions/{session_id}/messages"""
    engine = request.app["engine"]
    user = request.get("user") or {}
    user_id = user.get("sub", "anonymous") if isinstance(user, dict) else "anonymous"
    session_id = request.match_info["session_id"]
    limit = int(request.query.get("limit", "50"))

    messages = await engine.session_store.get_history_secure(session_id, user_id, limit=limit)
    return _json({"messages": messages})


async def handle_session_delete(request: web.Request) -> web.Response:
    """DELETE /api/v1/sessions/{session_id}"""
    engine = request.app["engine"]
    user = request.get("user") or {}
    user_id = user.get("sub", "anonymous") if isinstance(user, dict) else "anonymous"
    session_id = request.match_info["session_id"]
    ok = await engine.session_store.delete_session_secure(session_id, user_id)
    return _json({"status": "deleted" if ok else "not_found"})


def register(app: web.Application) -> None:
    app.router.add_get("/api/v1/sessions", handle_sessions_list)
    app.router.add_get("/api/v1/sessions/{session_id}/messages", handle_session_history)
    app.router.add_delete("/api/v1/sessions/{session_id}", handle_session_delete)
