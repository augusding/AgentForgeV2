"""
AgentForge V2 — 认证路由

登录、注册、用户信息、密码修改。
用户数据存储在 SQLite (data/users.db)。
"""

from __future__ import annotations

import json
import logging
import secrets
import time
from pathlib import Path

import aiosqlite
from aiohttp import web

from api.middleware.auth import (
    create_jwt, decode_jwt, hash_password, load_jwt_secret,
    validate_password, validate_username,
)

logger = logging.getLogger(__name__)


def _json(data, status: int = 200) -> web.Response:
    return web.Response(
        text=json.dumps(data, ensure_ascii=False, default=str),
        content_type="application/json", status=status,
    )


async def _get_user_db(request) -> aiosqlite.Connection:
    """获取用户数据库连接。"""
    if "user_db_path" not in request.app:
        engine = request.app["engine"]
        db_path = str(engine.root_dir / "data" / "users.db")
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        request.app["user_db_path"] = db_path
        # 初始化表
        async with aiosqlite.connect(db_path) as db:
            db.row_factory = aiosqlite.Row
            await db.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    salt TEXT NOT NULL,
                    display_name TEXT DEFAULT '',
                    role TEXT DEFAULT 'user',
                    org_id TEXT DEFAULT '',
                    org_role TEXT DEFAULT '',
                    created_at REAL NOT NULL,
                    last_login REAL DEFAULT 0
                )
            """)
            await db.commit()
            # 确保默认 admin 存在
            import os
            admin_user = os.environ.get("ADMIN_USERNAME", "admin")
            admin_pass = os.environ.get("ADMIN_PASSWORD", "admin123")
            cursor = await db.execute("SELECT id FROM users WHERE username = ?", (admin_user,))
            if not await cursor.fetchone():
                salt = secrets.token_hex(16)
                pw_hash = hash_password(admin_pass, salt)
                await db.execute(
                    "INSERT INTO users (id, username, password_hash, salt, display_name, role, created_at) "
                    "VALUES (?, ?, ?, ?, ?, 'admin', ?)",
                    (secrets.token_hex(8), admin_user, pw_hash, salt, "管理员", time.time()),
                )
                await db.commit()
                logger.info("默认管理员已创建: %s", admin_user)

    db = await aiosqlite.connect(request.app["user_db_path"])
    db.row_factory = aiosqlite.Row
    return db


async def handle_login(request: web.Request) -> web.Response:
    """POST /api/v1/auth/login  Body: {"username": "...", "password": "..."}"""
    try:
        body = await request.json()
    except Exception:
        return _json({"error": "请求体不是合法 JSON"}, 400)
    username = body.get("username", "").strip()
    password = body.get("password", "")

    if not username or not password:
        return _json({"error": "用户名和密码不能为空"}, status=400)

    db = await _get_user_db(request)
    try:
        cursor = await db.execute("SELECT * FROM users WHERE username = ?", (username,))
        user = await cursor.fetchone()
        if not user:
            return _json({"error": "用户名或密码错误"}, status=401)

        user = dict(user)
        pw_hash = hash_password(password, user["salt"])
        if pw_hash != user["password_hash"]:
            return _json({"error": "用户名或密码错误"}, status=401)

        # 更新登录时间
        await db.execute("UPDATE users SET last_login = ? WHERE id = ?", (time.time(), user["id"]))
        await db.commit()

        # 查询用户所属组织
        org_info = {"org_id": user.get("org_id", ""), "org_role": user.get("org_role", ""), "org_name": ""}
        try:
            from memory.org_store import OrgStore
            org_store = OrgStore(str(request.app["engine"].root_dir / "data" / "orgs.db"))
            await org_store.ensure_tables()
            user_org = await org_store.get_user_org(user["id"])
            if user_org:
                org_info = {
                    "org_id": user_org.get("org_id", ""),
                    "org_role": user_org.get("role", ""),
                    "org_name": user_org.get("org_name", ""),
                }
        except Exception:
            pass

        jwt_secret = request.app.get("jwt_secret", load_jwt_secret())
        request.app["jwt_secret"] = jwt_secret

        token = create_jwt(
            jwt_secret, user["id"], user["username"], user["role"],
            org_id=org_info["org_id"], org_role=org_info["org_role"],
        )

        resp = _json({
            "token": token,
            "user": {
                "id": user["id"],
                "username": user["username"],
                "display_name": user["display_name"],
                "role": user["role"],
            },
            **org_info,
        })
        resp.set_cookie("agentforge_token", token, httponly=True, samesite="Lax", max_age=7 * 86400, path="/")
        return resp
    finally:
        await db.close()


async def handle_register(request: web.Request) -> web.Response:
    """POST /api/v1/auth/register  Body: {"username", "password", "display_name"}"""
    body = await request.json()
    username = body.get("username", "").strip()
    password = body.get("password", "")
    display_name = body.get("display_name", username)

    err = validate_username(username)
    if err:
        return _json({"error": err}, status=400)
    err = validate_password(password)
    if err:
        return _json({"error": err}, status=400)

    db = await _get_user_db(request)
    try:
        cursor = await db.execute("SELECT id FROM users WHERE username = ?", (username,))
        if await cursor.fetchone():
            return _json({"error": "用户名已存在"}, status=409)

        user_id = secrets.token_hex(8)
        salt = secrets.token_hex(16)
        pw_hash = hash_password(password, salt)

        await db.execute(
            "INSERT INTO users (id, username, password_hash, salt, display_name, role, created_at) "
            "VALUES (?, ?, ?, ?, ?, 'user', ?)",
            (user_id, username, pw_hash, salt, display_name, time.time()),
        )
        await db.commit()

        return _json({"user_id": user_id, "username": username, "status": "created"})
    finally:
        await db.close()


async def handle_me(request: web.Request) -> web.Response:
    """GET /api/v1/auth/me — 获取当前用户信息。"""
    user = request.get("user")
    if not user or not isinstance(user, dict):
        return _json({"id": "", "username": "", "role": "", "authenticated": False})
    result = {
        "id": user.get("sub", ""), "username": user.get("username", ""),
        "role": user.get("role", ""), "org_id": user.get("org_id", ""),
        "org_role": user.get("org_role", ""), "org_name": "",
        "authenticated": True,
    }
    # 从 work_item_store 获取用户当前岗位分配
    try:
        engine = request.app.get("engine")
        if engine and engine.work_item_store:
            pos_id = await engine.work_item_store.get_assignment(
                user.get("sub", ""), user.get("org_id", ""))
            if pos_id:
                result["active_position"] = pos_id
    except Exception:
        pass
    try:
        from memory.org_store import OrgStore
        org_store = OrgStore(str(request.app["engine"].root_dir / "data" / "orgs.db"))
        await org_store.ensure_tables()
        user_org = await org_store.get_user_org(user.get("sub", ""))
        if user_org:
            result["org_name"] = user_org.get("org_name", "")
            result["org_role"] = user_org.get("role", result["org_role"])
    except Exception:
        pass
    return _json(result)


async def handle_change_password(request: web.Request) -> web.Response:
    """POST /api/v1/auth/change-password  Body: {"old_password", "new_password"}"""
    user = request.get("user")
    if not user or not isinstance(user, dict):
        return _json({"error": "请先登录"}, status=401)

    body = await request.json()
    old_pw = body.get("old_password", "") or body.get("current_password", "")
    new_pw = body.get("new_password", "")

    err = validate_password(new_pw)
    if err:
        return _json({"error": err}, status=400)

    db = await _get_user_db(request)
    try:
        cursor = await db.execute("SELECT * FROM users WHERE id = ?", (user["sub"],))
        row = await cursor.fetchone()
        if not row:
            return _json({"error": "用户不存在"}, status=404)

        row = dict(row)
        if hash_password(old_pw, row["salt"]) != row["password_hash"]:
            return _json({"error": "原密码错误"}, status=401)

        new_salt = secrets.token_hex(16)
        new_hash = hash_password(new_pw, new_salt)
        await db.execute(
            "UPDATE users SET password_hash = ?, salt = ? WHERE id = ?",
            (new_hash, new_salt, user["sub"]),
        )
        await db.commit()
        return _json({"status": "password_changed"})
    finally:
        await db.close()


def register(app: web.Application) -> None:
    app.router.add_post("/api/v1/auth/login", handle_login)
    app.router.add_post("/api/v1/auth/register", handle_register)
    app.router.add_get("/api/v1/auth/me", handle_me)
    app.router.add_post("/api/v1/auth/change-password", handle_change_password)
