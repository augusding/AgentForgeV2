"""
AgentForge V2 — HTTP API 应用

创建 aiohttp app，挂载中间件和路由。
所有路由按领域拆分到 routes/ 子目录。
"""

from __future__ import annotations

import json
import logging
import os
from typing import TYPE_CHECKING

from aiohttp import web

if TYPE_CHECKING:
    from core.engine import ForgeEngine

logger = logging.getLogger(__name__)


def _json(data: dict, status: int = 200) -> web.Response:
    """统一 JSON 响应。"""
    return web.Response(
        text=json.dumps(data, ensure_ascii=False, default=str),
        content_type="application/json",
        status=status,
    )


def _make_cors_middleware():
    """CORS 中间件 — 从环境变量读取允许的域名。"""
    raw = os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://localhost:8080,http://localhost:3000,http://localhost:3001")
    allowed = {o.strip().rstrip("/") for o in raw.split(",") if o.strip()}

    @web.middleware
    async def cors(request, handler):
        origin = request.headers.get("Origin", "")
        if allowed and origin:
            matched = origin.rstrip("/") in allowed
        else:
            matched = not allowed

        if request.method == "OPTIONS":
            resp = web.Response(status=204)
        else:
            resp = await handler(request)

        if matched and origin:
            resp.headers["Access-Control-Allow-Origin"] = origin
            resp.headers["Access-Control-Allow-Credentials"] = "true"
        elif not allowed:
            resp.headers["Access-Control-Allow-Origin"] = "*"

        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Trace-Id"
        resp.headers["Access-Control-Max-Age"] = "3600"
        return resp
    return cors


def _make_error_middleware():
    """全局错误处理中间件。"""
    @web.middleware
    async def error_handler(request, handler):
        try:
            return await handler(request)
        except web.HTTPException:
            raise
        except Exception as e:
            logger.error("请求处理失败: %s %s — %s", request.method, request.path, e, exc_info=True)
            return _json({"error": str(e)}, status=500)
    return error_handler


def create_app(engine: ForgeEngine) -> web.Application:
    """创建 aiohttp 应用。"""
    from api.middleware.auth import make_auth_middleware, load_jwt_secret

    jwt_secret = load_jwt_secret()
    api_key = os.environ.get("AGENTFORGE_API_KEY", "")

    from api.middleware.rate_limit import make_rate_limit_middleware

    app = web.Application(middlewares=[
        _make_cors_middleware(),
        make_rate_limit_middleware(),
        make_auth_middleware(jwt_secret, api_key),
        _make_error_middleware(),
    ])
    app["engine"] = engine
    app["jwt_secret"] = jwt_secret

    # 注册路由
    from api.routes.health import register as reg_health
    from api.routes.auth import register as reg_auth
    from api.routes.chat import register as reg_chat
    from api.routes.positions import register as reg_positions
    from api.routes.sessions import register as reg_sessions
    from api.routes.workflow import register as reg_workflow
    from api.routes.knowledge import register as reg_knowledge
    from api.routes.builder import register as reg_builder
    from api.routes.missions import register as reg_missions
    from api.routes.files import register as reg_files
    from api.routes.workstation import register as reg_workstation
    from api.routes.org import register as reg_org

    reg_health(app)
    reg_auth(app)
    reg_chat(app)
    reg_positions(app)
    reg_sessions(app)
    reg_workflow(app)
    reg_knowledge(app)
    reg_builder(app)
    reg_missions(app)
    reg_files(app)
    reg_workstation(app)
    reg_org(app)

    from api.routes.work_items import register as reg_work_items
    reg_work_items(app)

    from api.routes.connectors import register as reg_connectors
    reg_connectors(app)

    from api.routes.evolution import register as reg_evolution
    reg_evolution(app)

    from api.routes.toolbox import register as reg_toolbox
    reg_toolbox(app)

    # 配置路由（config + LLM）
    from api.routes.config import register as reg_config
    reg_config(app)

    # 兼容路由（放在最后，真实路由优先匹配）
    try:
        from api.routes.compat import register as reg_compat
        reg_compat(app)
    except Exception as e:
        logger.error("compat 路由注册失败: %s", e, exc_info=True)
    try:
        from api.routes.compat_workflow import register as reg_compat_wf
        reg_compat_wf(app)
    except Exception as e:
        logger.error("compat_workflow 路由注册失败: %s", e, exc_info=True)

    # WebSocket 网关
    from api.gateway import WebSocketGateway
    gateway = WebSocketGateway()
    app["gateway"] = gateway
    app.router.add_get("/ws", gateway.handle_ws)

    logger.info("API 路由注册完成")
    return app
