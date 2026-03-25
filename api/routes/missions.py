"""AgentForge V2 — Mission 历史路由"""

import json
from aiohttp import web


def _json(data, status=200):
    return web.Response(
        text=json.dumps(data, ensure_ascii=False, default=str),
        content_type="application/json", status=status,
    )


async def handle_missions_list(request: web.Request) -> web.Response:
    """GET /api/v1/missions?user_id=xxx&limit=20"""
    engine = request.app["engine"]
    if not engine.mission_tracer:
        return _json({"missions": []})
    user_id = request.query.get("user_id", "")
    org_id = request.query.get("org_id", "")
    limit = int(request.query.get("limit", "20"))
    missions = await engine.mission_tracer.get_recent(user_id=user_id, org_id=org_id, limit=limit)
    return _json({"missions": missions})


async def handle_token_usage(request: web.Request) -> web.Response:
    """GET /api/v1/stats/tokens?org_id=xxx&days=7"""
    engine = request.app["engine"]
    if not engine.token_tracker:
        return _json({"daily": {}, "by_model": []})
    org_id = request.query.get("org_id", "")
    days = int(request.query.get("days", "7"))
    daily = await engine.token_tracker.get_daily_usage(org_id=org_id)
    by_model = await engine.token_tracker.get_usage_by_model(org_id=org_id, days=days)
    return _json({"daily": daily, "by_model": by_model})


def register(app: web.Application) -> None:
    app.router.add_get("/api/v1/missions", handle_missions_list)
    app.router.add_get("/api/v1/stats/tokens", handle_token_usage)
