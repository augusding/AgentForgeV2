"""AgentForge V2 — 进化系统 API：信号队列 + 用户画像。"""
from __future__ import annotations

import json
import logging

from aiohttp import web

logger = logging.getLogger(__name__)


def _json(data, status: int = 200) -> web.Response:
    return web.Response(text=json.dumps(data, ensure_ascii=False, default=str),
                        content_type="application/json", status=status)

def _get_user(request) -> tuple[str, str]:
    user = request.get("user") or {}
    if isinstance(user, dict):
        return user.get("sub", "anonymous"), user.get("org_id", "")
    return "anonymous", ""


async def handle_signal_queue(request: web.Request) -> web.Response:
    """GET /api/v1/evolution/signals"""
    engine = request.app["engine"]
    _, org_id = _get_user(request)
    position_id = request.query.get("position_id", "")
    signal_type = request.query.get("signal_type", "")
    limit = min(int(request.query.get("limit", "50")), 200)
    if not engine.signal_store:
        return _json({"signals": [], "total": 0})
    signals = await engine.signal_store.get_recent_signals(
        user_id="", org_id=org_id, position_id=position_id,
        limit=limit, signal_type=signal_type)
    result = []
    for s in signals:
        try: detail = json.loads(s.get("content", "{}"))
        except Exception: detail = {"raw": s.get("content", "")}
        result.append({
            "id": s["id"], "position_id": s["position_id"], "user_id": s["user_id"],
            "signal_type": s["signal_type"], "user_need": detail.get("user_need", ""),
            "suggest_field": detail.get("suggest_field", ""),
            "suggest_change": detail.get("suggest_change", ""),
            "scope": detail.get("scope", "shared"),
            "trigger_reason": detail.get("trigger_reason", ""),
            "created_at": s["created_at"],
        })
    return _json({"signals": result, "total": len(result)})


async def handle_pending_summary(request: web.Request) -> web.Response:
    """GET /api/v1/evolution/pending"""
    engine = request.app["engine"]
    if not engine.signal_store:
        return _json({"items": []})
    items = await engine.signal_store.get_pending_list(min_count=1, stale_days=999, limit=100)
    return _json({"items": [{"position_id": i["position_id"], "user_id": i["user_id"],
                              "pending_count": i["pending_count"], "last_analyzed": i.get("last_analyzed")}
                             for i in items]})


async def handle_profile_get(request: web.Request) -> web.Response:
    """GET /api/v1/evolution/profile"""
    engine = request.app["engine"]
    user_id, org_id = _get_user(request)
    position_id = request.query.get("position_id", "")
    if not position_id:
        return _json({"error": "position_id 必填"}, 400)
    ups = getattr(engine, "_user_profile_store", None)
    if not ups:
        return _json({"profile": {}, "entries": []})
    profile = await ups.get_profile(user_id, org_id, position_id)
    async with ups._db() as db:
        cursor = await db.execute(
            "SELECT id, category, content, source, confidence, created_at, updated_at "
            "FROM user_profiles WHERE user_id=? AND org_id=? AND position_id=? "
            "ORDER BY category, updated_at DESC", (user_id, org_id, position_id))
        entries = [dict(r) for r in await cursor.fetchall()]
    return _json({"profile": profile, "entries": entries})


async def handle_profile_delete(request: web.Request) -> web.Response:
    """DELETE /api/v1/evolution/profile/{entry_id}"""
    engine = request.app["engine"]
    user_id, _ = _get_user(request)
    entry_id = request.match_info["entry_id"]
    ups = getattr(engine, "_user_profile_store", None)
    if not ups:
        return _json({"error": "未初始化"}, 503)
    ok = await ups.delete_entry(entry_id, user_id)
    return _json({"status": "deleted"}) if ok else _json({"error": "不存在或无权限"}, 404)


def register(app: web.Application) -> None:
    app.router.add_get("/api/v1/evolution/signals", handle_signal_queue)
    app.router.add_get("/api/v1/evolution/pending", handle_pending_summary)
    app.router.add_get("/api/v1/evolution/profile", handle_profile_get)
    app.router.add_delete("/api/v1/evolution/profile/{entry_id}", handle_profile_delete)
