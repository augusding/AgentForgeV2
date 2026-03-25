"""
AgentForge V2 — 岗位路由

岗位列表、详情查询。
"""

from __future__ import annotations

import json

from aiohttp import web


def _json(data, status: int = 200) -> web.Response:
    return web.Response(
        text=json.dumps(data, ensure_ascii=False, default=str),
        content_type="application/json", status=status,
    )


async def handle_positions_list(request: web.Request) -> web.Response:
    """GET /api/v1/positions?profile=ad-monetization"""
    engine = request.app["engine"]
    profile = request.query.get("profile", "")
    positions = engine.get_positions_list(profile)
    return _json({"positions": positions})


async def handle_position_detail(request: web.Request) -> web.Response:
    """GET /api/v1/positions/{position_id}"""
    engine = request.app["engine"]
    position_id = request.match_info["position_id"]

    for bundle in engine._bundles.values():
        if position_id in bundle.positions:
            pos = bundle.positions[position_id]
            return _json({
                "position_id": pos.position_id,
                "display_name": pos.display_name,
                "icon": pos.icon,
                "color": pos.color,
                "department": pos.department,
                "domain": pos.domain,
                "description": pos.description,
                "tools": pos.tools,
                "knowledge_scope": pos.knowledge_scope,
                "onboarding": pos.onboarding,
            })

    return _json({"error": "岗位不存在"}, status=404)


def register(app: web.Application) -> None:
    app.router.add_get("/api/v1/positions", handle_positions_list)
    app.router.add_get("/api/v1/positions/{position_id}", handle_position_detail)
