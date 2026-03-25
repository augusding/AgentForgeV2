"""
AgentForge V2 — CORS 中间件
"""

from aiohttp import web


def cors_middleware():
    """CORS 中间件工厂。"""

    @web.middleware
    async def middleware(request: web.Request, handler):
        # 预检请求
        if request.method == "OPTIONS":
            response = web.Response(status=200)
        else:
            try:
                response = await handler(request)
            except web.HTTPException as e:
                response = e

        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Max-Age"] = "3600"
        return response

    return middleware
