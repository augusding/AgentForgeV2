"""
AgentForge V2 — Builder 路由

引导式 Agent 配置创建 API。
"""

from __future__ import annotations

import json
import logging

from aiohttp import web

logger = logging.getLogger(__name__)


def _json(data, status: int = 200) -> web.Response:
    return web.Response(
        text=json.dumps(data, ensure_ascii=False, default=str),
        content_type="application/json", status=status,
    )


async def _get_builder(request):
    if "builder_engine" not in request.app:
        from builder.engine import BuilderEngine
        engine = request.app["engine"]
        request.app["builder_engine"] = BuilderEngine(
            engine._llm, db_path=str(engine.root_dir / "data" / "builder.db"),
        )
    return request.app["builder_engine"]


async def handle_builder_create(request: web.Request) -> web.Response:
    """POST /api/v1/builder/sessions — 创建构建会话。"""
    builder = await _get_builder(request)
    result = await builder.create_session()
    return _json(result)


async def handle_builder_chat(request: web.Request) -> web.Response:
    """POST /api/v1/builder/sessions/{session_id}/chat  Body: {"message": "..."}"""
    builder = await _get_builder(request)
    session_id = request.match_info["session_id"]
    body = await request.json()
    message = body.get("message", "")
    if not message:
        return _json({"error": "message 不能为空"}, status=400)
    result = await builder.chat(session_id, message)
    return _json(result)


async def handle_builder_status(request: web.Request) -> web.Response:
    """GET /api/v1/builder/sessions/{session_id}"""
    builder = await _get_builder(request)
    session_id = request.match_info["session_id"]
    status = builder.get_session(session_id)
    if not status:
        return _json({"error": "会话不存在"}, status=404)
    return _json(status)


async def handle_builder_deploy(request: web.Request) -> web.Response:
    """POST /api/v1/builder/sessions/{session_id}/deploy"""
    builder = await _get_builder(request)
    engine = request.app["engine"]
    session_id = request.match_info["session_id"]
    body = await request.json() if request.can_read_body else {}
    output_dir = body.get("output_dir", str(engine.root_dir / "profiles" / "custom"))
    result = await builder.deploy(session_id, output_dir)
    return _json(result)


def register(app: web.Application) -> None:
    app.router.add_post("/api/v1/builder/sessions", handle_builder_create)
    app.router.add_post("/api/v1/builder/sessions/{session_id}/chat", handle_builder_chat)
    app.router.add_get("/api/v1/builder/sessions/{session_id}", handle_builder_status)
    app.router.add_post("/api/v1/builder/sessions/{session_id}/deploy", handle_builder_deploy)
