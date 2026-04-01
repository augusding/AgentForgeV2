"""AgentForge V2 — 健康检查 + 系统信息路由"""
from __future__ import annotations
import json, time
from aiohttp import web


def _json(data: dict, status: int = 200) -> web.Response:
    return web.Response(text=json.dumps(data, ensure_ascii=False, default=str),
                        content_type="application/json", status=status)


async def handle_health(request: web.Request) -> web.Response:
    engine = request.app["engine"]
    checks = {"status": "ok"}
    # DB
    try:
        if engine.session_store:
            await engine.session_store.count_messages("__health_check__")
            checks["db"] = "ok"
    except Exception as e:
        checks["db"] = f"error: {e}"; checks["status"] = "degraded"
    # LLM
    if engine._llm and engine._llm._tiers:
        checks["llm"] = f"ok ({len(engine._llm._tiers)} tiers)"
    else:
        checks["llm"] = "no tiers configured"; checks["status"] = "degraded"
    # Knowledge
    if engine.knowledge_base:
        checks["knowledge"] = engine.knowledge_base.get_stats().get("status", "unknown")
    else:
        checks["knowledge"] = "disabled"
    # Meta
    checks["name"] = engine.config.name if engine.config else "AgentForge"
    checks["version"] = engine.config.version if engine.config else "2.0.0"
    checks["timestamp"] = time.time()
    checks["tools"] = engine._tool_registry.count if engine._tool_registry else 0
    checks["profiles"] = list(engine._bundles.keys()) if engine._bundles else []
    gateway = request.app.get("gateway")
    if gateway:
        checks["ws_connections"] = gateway.connection_count
    return _json(checks, status=200 if checks["status"] == "ok" else 503)


async def handle_stats(request: web.Request) -> web.Response:
    engine = request.app["engine"]
    stats = {
        "profiles": list(engine._bundles.keys()),
        "tools_count": engine._tool_registry.count if engine._tool_registry else 0,
        "knowledge": engine.knowledge_base.get_stats() if engine.knowledge_base else {},
    }
    if engine.token_tracker:
        stats["token_usage_today"] = await engine.token_tracker.get_daily_usage()
    return _json(stats)


async def handle_metrics(request: web.Request) -> web.Response:
    """GET /api/v1/metrics — 实时运行指标"""
    engine = request.app["engine"]
    m = getattr(engine, "_metrics", None)
    if not m:
        return _json({"error": "metrics not initialized"}, 503)
    data = m.snapshot()
    if engine.token_tracker:
        try: data["token_usage_today"] = await engine.token_tracker.get_daily_usage()
        except Exception: pass
    return _json(data)


def register(app: web.Application) -> None:
    app.router.add_get("/api/v1/health", handle_health)
    app.router.add_get("/api/v1/stats", handle_stats)
    app.router.add_get("/api/v1/metrics", handle_metrics)
