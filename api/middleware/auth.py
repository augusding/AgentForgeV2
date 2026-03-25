"""
AgentForge V2 — JWT 认证中间件

支持三种认证方式：
1. JWT Cookie (httpOnly)
2. Bearer JWT Token
3. Bearer API Key (向后兼容)
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from aiohttp import web

logger = logging.getLogger(__name__)

_JWT_ALGORITHM = "HS256"
_JWT_EXPIRY_DAYS = 7

# 不需要认证的路径
_PUBLIC_PATHS = {
    "/api/v1/health",
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/register-org",
    "/api/v1/auth/send-code",
    "/api/v1/stats",
}


def load_jwt_secret() -> str:
    """从环境变量 > 文件 > 自动生成。"""
    secret = os.environ.get("JWT_SECRET", "")
    if secret:
        return secret
    secret_path = Path("data/.jwt_secret")
    if secret_path.exists():
        stored = secret_path.read_text().strip()
        if stored:
            return stored
    new_secret = secrets.token_hex(32)
    secret_path.parent.mkdir(parents=True, exist_ok=True)
    secret_path.write_text(new_secret)
    logger.info("JWT 密钥已生成: data/.jwt_secret")
    return new_secret


def hash_password(password: str, salt: str) -> str:
    """PBKDF2-SHA256 密码哈希。"""
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000
    ).hex()


def create_jwt(
    secret: str, user_id: str, username: str, role: str = "user",
    org_id: str = "", org_role: str = "",
) -> str:
    """创建 JWT Token。"""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "org_id": org_id,
        "org_role": org_role,
        "iat": now,
        "exp": now + timedelta(days=_JWT_EXPIRY_DAYS),
    }
    return jwt.encode(payload, secret, algorithm=_JWT_ALGORITHM)


def decode_jwt(secret: str, token: str) -> dict | None:
    """解码 JWT。成功返回 payload，失败返回 None。"""
    try:
        return jwt.decode(token, secret, algorithms=[_JWT_ALGORITHM])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def validate_username(username: str) -> str | None:
    """验证用户名，返回错误信息或 None。"""
    if len(username) < 3 or len(username) > 32:
        return "用户名长度须为 3-32 个字符"
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        return "用户名仅允许字母、数字和下划线"
    return None


def validate_password(password: str) -> str | None:
    """验证密码强度，返回错误信息或 None。"""
    if len(password) < 6:
        return "密码长度至少 6 个字符"
    return None


def make_auth_middleware(jwt_secret: str, api_key: str = ""):
    """创建认证中间件。大部分路径走软认证，只对敏感写操作硬认证。"""

    _HARD_AUTH_PREFIXES = ("/api/v1/admin/", "/api/v1/orgs")

    @web.middleware
    async def auth_middleware(request: web.Request, handler):
        if request.method == "OPTIONS":
            return await handler(request)

        # 公开路径直接放行（不设 user）
        if (request.path in _PUBLIC_PATHS
                or request.path.startswith("/api/v1/auth/")
                or request.path.startswith("/api/v1/webhook/")
                or request.path == "/ws" or request.path.startswith("/ws?")):
            return await handler(request)

        # 尝试认证
        auth_result = _verify(request, jwt_secret, api_key)
        if isinstance(auth_result, dict):
            request["user"] = auth_result
        elif auth_result is True:
            request["user"] = {"sub": "api_client", "role": "admin"}
        else:
            request["user"] = None

        # 硬认证：敏感路径必须认证成功
        if request["user"] is None:
            for prefix in _HARD_AUTH_PREFIXES:
                if request.path.startswith(prefix):
                    return web.json_response({"error": "未认证"}, status=401)

        # 其他路径：软认证，让路由自己处理 user=None
        return await handler(request)

    return auth_middleware


def _verify(request: web.Request, jwt_secret: str, api_key: str) -> bool | dict:
    """三重认证。"""
    # 1. JWT Cookie
    token = request.cookies.get("agentforge_token")
    if token:
        payload = decode_jwt(jwt_secret, token)
        if payload:
            return payload

    # 2. Authorization header
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token_val = auth_header[7:]
        payload = decode_jwt(jwt_secret, token_val)
        if payload:
            return payload
        if api_key and hmac.compare_digest(token_val, api_key):
            return True

    # 3. 无认证配置时放行
    if not api_key and not jwt_secret:
        return True

    return False
