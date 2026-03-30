"""
AgentForge V2 — 滑动窗口 Rate Limiter

基于内存的 IP + user_id 限流，无外部依赖。
"""

import logging
import os
import time

from aiohttp import web

logger = logging.getLogger(__name__)

_RULES: list[tuple[str, int, int]] = [
    ("/api/v1/auth/login", 5, 60),
    ("/api/v1/auth/register", 5, 60),
    ("/api/v1/chat/stream", 15, 60),
    ("/api/v1/chat/message", 15, 60),
    ("/api/v1/workflows/execute", 20, 60),
    ("/api/v1/workflows/generate", 5, 60),
    ("/api/v1/files/upload", 10, 60),
    ("/api/v1/knowledge/clear", 3, 60),
]
_DEFAULT_LIMIT = 120
_DEFAULT_WINDOW = 60


class RateLimiter:
    """滑动窗口限流器。"""

    def __init__(self):
        self._windows: dict[str, list[float]] = {}
        self._last_cleanup = time.time()

    def check(self, key: str, limit: int, window: int = 60) -> bool:
        """返回 True = 放行，False = 超限。"""
        now = time.time()
        if now - self._last_cleanup > 300:
            self._cleanup(now, window)
            self._last_cleanup = now

        times = self._windows.setdefault(key, [])
        cutoff = now - window
        while times and times[0] < cutoff:
            times.pop(0)
        if len(times) >= limit:
            return False
        times.append(now)
        return True

    def _cleanup(self, now: float, default_window: int):
        cutoff = now - default_window * 2
        dead = [k for k, v in self._windows.items() if not v or v[-1] < cutoff]
        for k in dead:
            del self._windows[k]


_limiter = RateLimiter()


def _get_client_ip(request: web.Request) -> str:
    """获取客户端 IP（支持反向代理）。"""
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP", "")
    if real_ip:
        return real_ip
    peername = request.transport.get_extra_info("peername")
    return peername[0] if peername else "unknown"


def make_rate_limit_middleware():
    """Rate Limit 中间件。通过 RATE_LIMIT_ENABLED 环境变量控制开关。"""
    enabled = os.environ.get("RATE_LIMIT_ENABLED", "true").lower() in ("true", "1", "yes")

    @web.middleware
    async def rate_limit(request: web.Request, handler):
        if not enabled or request.method == "OPTIONS":
            return await handler(request)

        path = request.path
        ip = _get_client_ip(request)
        user = request.get("user") or {}
        uid = user.get("sub", "") if isinstance(user, dict) else ""

        identity = f"u:{uid}" if uid else f"ip:{ip}"

        limit, window = _DEFAULT_LIMIT, _DEFAULT_WINDOW
        for prefix, rlimit, rwindow in _RULES:
            if path.startswith(prefix):
                limit, window = rlimit, rwindow
                break

        key = f"{identity}:{path.split('?')[0]}"
        if not _limiter.check(key, limit, window):
            logger.warning("Rate limit: %s %s (limit=%d/%ds)", identity, path, limit, window)
            return web.json_response(
                {"error": "操作过于频繁，请稍后重试", "retry_after": window},
                status=429,
                headers={"Retry-After": str(window)},
            )

        return await handler(request)

    return rate_limit
