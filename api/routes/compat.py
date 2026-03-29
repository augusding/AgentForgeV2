"""
AgentForge V2 — 前端兼容路由

将旧版前端期望的 API 路径映射到 V2 功能上。
暂未实现的功能返回合理的空数据，避免前端报错。
"""

import json
import logging

from aiohttp import web

logger = logging.getLogger(__name__)


def _json(data, status=200):
    return web.Response(
        text=json.dumps(data, ensure_ascii=False, default=str),
        content_type="application/json", status=status,
    )


# ── Chat 兼容：/chat/sessions → 转接 /sessions ──────────────

async def handle_chat_sessions_list(request):
    """GET /api/v1/chat/sessions"""
    engine = request.app["engine"]
    user = request.get("user") or {}
    user_id = user.get("sub", "anonymous") if isinstance(user, dict) else "anonymous"
    sessions = await engine.session_store.list_sessions(user_id=user_id, limit=50)
    return _json([{
        "id": s["id"], "title": s.get("title", ""),
        "agent_id": s.get("position_id", ""), "position_id": s.get("position_id", ""),
        "updated_at": s.get("updated_at", 0), "message_count": 0,
    } for s in sessions])


async def handle_chat_session_messages(request):
    """GET /api/v1/chat/sessions/{session_id}/messages"""
    engine = request.app["engine"]
    user = request.get("user") or {}
    user_id = user.get("sub", "anonymous") if isinstance(user, dict) else "anonymous"
    session_id = request.match_info["session_id"]
    messages = await engine.session_store.get_history_secure(session_id, user_id, limit=100)
    return _json([{
        "id": m.get("id", ""), "role": m["role"], "content": m["content"],
        "agent_id": "", "agent_name": "", "created_at": m.get("created_at", 0),
        "tokens_used": m.get("tokens_used", 0), "model": m.get("model", ""),
        "tool_calls": m.get("tool_calls", []),
        "attachments": m.get("attachments", []),
    } for m in messages])


async def handle_chat_session_delete(request):
    """DELETE /api/v1/chat/sessions/{session_id}"""
    engine = request.app["engine"]
    user = request.get("user") or {}
    user_id = user.get("sub", "anonymous") if isinstance(user, dict) else "anonymous"
    await engine.session_store.delete_session_secure(request.match_info["session_id"], user_id)
    return _json({"status": "deleted"})


async def handle_chat_session_title_generate(request):
    """POST /api/v1/chat/sessions/{session_id}/title"""
    engine = request.app["engine"]
    session_id = request.match_info["session_id"]
    messages = await engine.session_store.get_history(session_id, limit=3)
    title = next((m["content"][:30] for m in messages if m["role"] == "user" and m["content"]), "新对话")
    await engine.session_store.update_session_title(session_id, title)
    return _json({"title": title})


async def handle_chat_session_title_update(request):
    """PATCH /api/v1/chat/sessions/{session_id}/title"""
    engine = request.app["engine"]
    body = await request.json()
    title = body.get("title", "")
    await engine.session_store.update_session_title(request.match_info["session_id"], title)
    return _json({"title": title})


async def handle_chat_upload(request):
    """POST /api/v1/chat/upload — 转接到 /files/upload"""
    from api.routes.files import handle_upload
    return await handle_upload(request)


async def handle_chat_quick_commands(request):
    """GET /api/v1/chat/quick-commands?position_id=xxx"""
    engine = request.app["engine"]
    target_pid = request.query.get("position_id", "")

    # 优先从请求用户的 active_position 获取
    if not target_pid:
        user = request.get("user") or {}
        if isinstance(user, dict):
            target_pid = user.get("active_position", "")

    commands = []
    for bundle in engine._bundles.values():
        for pos in bundle.positions.values():
            # 如果指定了岗位，只返回该岗位的 prompts
            if target_pid and pos.position_id != target_pid:
                continue
            for p in pos.onboarding.get("prompts", []):
                commands.append({"text": p, "position_id": pos.position_id})

    # 如果指定岗位没有 prompts 或未指定岗位，返回空而不是混合推荐
    return _json(commands[:8])


# ── Auth 兼容 ────────────────────────────────────────────

async def handle_auth_logout(request):
    """POST /api/v1/auth/logout"""
    resp = _json({"status": "ok"})
    resp.del_cookie("agentforge_token")
    return resp


# ── Agents/Config/Profiles 兼容 ──────────────────────────

async def handle_agents_list(request):
    """GET /api/v1/agents — 前端期望 agents，V2 用 positions"""
    engine = request.app["engine"]
    return _json([{
        "agent_id": p["position_id"], "name": p["display_name"],
        "squad": p.get("department", ""),
        "identity": {
            "display_name": p["display_name"],
            "avatar_emoji": p.get("icon", "bot"),
            "color": p.get("color", "#3B82F6"),
        },
        "description": p.get("description", ""),
    } for p in engine.get_positions_list()])


async def handle_profiles_list(request):
    """GET /api/v1/profiles"""
    engine = request.app["engine"]
    return _json([{"id": name, "name": name} for name in engine._bundles])


# ── Work Items / Daily Context ────────────────────────────

def _user(request):
    u = request.get("user") or {}
    return (u.get("sub", "anonymous"), u.get("org_id", "")) if isinstance(u, dict) else ("anonymous", "")


async def handle_work_items_list(request):
    """GET /api/v1/work-items"""
    engine = request.app["engine"]
    user_id, org_id = _user(request)
    if engine.work_item_store:
        return _json(await engine.work_item_store.get_work_items(user_id, org_id))
    return _json([])


async def handle_work_item_create(request):
    """POST /api/v1/work-items"""
    engine = request.app["engine"]
    user_id, org_id = _user(request)
    body = await request.json()
    if not engine.work_item_store:
        return _json({"error": "store 不可用"}, status=500)
    wid = await engine.work_item_store.add_work_item(
        user_id=user_id, org_id=org_id, position_id=body.get("position_id", ""),
        title=body.get("title", ""), description=body.get("description", ""),
        item_type=body.get("type", "task"), priority=body.get("priority", "P1"))
    return _json({"id": wid, "status": "created"})


async def handle_daily_context(request):
    """GET /api/v1/daily-context"""
    engine = request.app["engine"]
    user_id, org_id = _user(request)
    position_id = request.query.get("position_id", "")
    priorities, schedules, followups = [], [], []
    if engine.work_item_store:
        priorities = await engine.work_item_store.get_priorities(user_id, org_id, position_id)
        schedules = await engine.work_item_store.get_schedules(user_id, org_id)
        followups = await engine.work_item_store.get_followups(user_id, org_id)
    return _json({"priorities": priorities, "schedules": schedules, "followups": followups})


async def handle_daily_context_add(request):
    """POST /api/v1/daily-context/{item_type}"""
    engine = request.app["engine"]
    user_id, org_id = _user(request)
    item_type = request.match_info.get("item_type", "")
    body = await request.json()
    if not engine.work_item_store:
        return _json({"error": "store 不可用"}, status=500)
    title = body.get("title", "") or body.get("text", "")
    if item_type == "priorities":
        pid = await engine.work_item_store.add_priority(
            user_id, org_id, body.get("position_id", ""),
            title=title, description=body.get("description", ""),
            priority=body.get("priority", "P1"))
        return _json({"id": pid})
    elif item_type == "schedule":
        sid = await engine.work_item_store.add_schedule(
            user_id, org_id, body.get("position_id", ""),
            title=title, scheduled_time=body.get("time", ""),
            duration_minutes=body.get("duration", 60))
        return _json({"id": sid})
    elif item_type == "followups":
        fid = await engine.work_item_store.add_followup(
            user_id, org_id, body.get("position_id", ""),
            title=title, target=body.get("target", ""))
        return _json({"id": fid})
    return _json({"error": f"未知类型: {item_type}"}, status=400)


# ── Stubs ─────────────────────────────────────────────────

async def _stub_list(request): return _json([])
async def _stub_obj(request): return _json({})
async def _stub_ok(request): return _json({"status": "ok"})


async def handle_analytics_daily(request):
    """GET /api/v1/analytics/daily"""
    import datetime
    return _json({
        "date": datetime.date.today().isoformat(),
        "total_sessions": 0, "total_tokens": 0, "total_messages": 0,
        "by_capability": {},
    })


async def handle_analytics_quality(request):
    """GET /api/v1/analytics/quality"""
    return _json({
        "days": 7, "total_completions": 0,
        "feedback_up": 0, "feedback_down": 0, "positive_rate": 0,
        "copy_count": 0, "download_count": 0, "regenerate_count": 0,
        "adoption_rate": 0, "rag_queries": 0, "rag_avg_score": 0,
        "knowledge_hit_rate": 0, "quality_score": 0,
    })


async def handle_insights_v2(request):
    """GET /api/v1/workstation/insights-v2"""
    return _json({"items": [], "counts": {"risk": 0, "opportunity": 0, "alert": 0}, "total": 0})


async def handle_risks(request):
    """GET /api/v1/workstation/risks"""
    return _json({"risks": [], "count": 0, "critical": 0, "high": 0})


async def handle_patterns(request):
    """GET /api/v1/workstation/patterns"""
    return _json({"total": 0, "patterns": {}})


async def handle_notifications_list(request):
    """GET /api/v1/notifications"""
    return _json([])


async def handle_notification_read(request):
    """PATCH /api/v1/notifications/{notif_id}/read"""
    return _json({"status": "ok"})


async def handle_audit_logs(request):
    """GET /api/v1/audit-logs"""
    engine = request.app["engine"]
    limit = int(request.query.get("limit", "50"))
    user_id = request.query.get("user_id", "")
    if engine._audit_logger:
        logs = await engine._audit_logger.get_recent_from_db(limit, user_id)
        return _json({"logs": logs})
    return _json({"logs": []})


async def handle_system_logs(request):
    """GET /api/v1/system/logs"""
    engine = request.app["engine"]
    limit = int(request.query.get("limit", "100"))
    category = request.query.get("category", "")
    level = request.query.get("level", "")
    lc = getattr(engine, "_log_collector", None)
    if lc:
        logs = await lc.get_from_db(limit=limit, category=category, level=level)
        return _json({"logs": logs, "count": len(logs)})
    return _json({"logs": [], "count": 0})


async def handle_analytics_signal_list(request):
    """GET /api/v1/analytics/signal — 用户记忆信号列表"""
    engine = request.app["engine"]
    limit = int(request.query.get("limit", "50"))
    user = request.get("user") or {}
    user_id = user.get("sub", "") if isinstance(user, dict) else ""
    org_id = user.get("org_id", "") if isinstance(user, dict) else ""

    signal_store = getattr(engine, '_signal_store', None)
    if not signal_store:
        return _json([])

    try:
        signals = await signal_store.get_recent_signals(
            user_id=user_id, org_id=org_id, limit=limit)
        return _json(signals)
    except Exception:
        return _json([])


async def handle_analytics_signal_delete(request):
    """DELETE /api/v1/analytics/signal/{signal_id}"""
    engine = request.app["engine"]
    signal_id = request.match_info["signal_id"]
    signal_store = getattr(engine, '_signal_store', None)
    if not signal_store:
        return _json({"error": "未启用"}, 503)

    try:
        async with signal_store._connect() as db:
            await db.execute("DELETE FROM signals WHERE id = ?", (signal_id,))
            await db.commit()
        return _json({"status": "deleted"})
    except Exception as e:
        return _json({"error": str(e)}, 500)


def register(app: web.Application) -> None:
    r = app.router
    r.add_get("/api/v1/audit-logs", handle_audit_logs)
    r.add_get("/api/v1/system/logs", handle_system_logs)
    # Chat 兼容
    r.add_get("/api/v1/chat/sessions", handle_chat_sessions_list)
    r.add_get("/api/v1/chat/sessions/{session_id}/messages", handle_chat_session_messages)
    r.add_delete("/api/v1/chat/sessions/{session_id}", handle_chat_session_delete)
    r.add_post("/api/v1/chat/sessions/{session_id}/title", handle_chat_session_title_generate)
    r.add_patch("/api/v1/chat/sessions/{session_id}/title", handle_chat_session_title_update)
    r.add_post("/api/v1/chat/upload", handle_chat_upload)
    r.add_get("/api/v1/chat/quick-commands", handle_chat_quick_commands)
    # feedback 已迁移到 chat.py
    r.add_delete("/api/v1/chat/messages/{message_id}/feedback", _stub_ok)
    r.add_get("/api/v1/chat/sessions/{session_id}/feedbacks", _stub_list)

    # Auth 兼容
    r.add_post("/api/v1/auth/logout", handle_auth_logout)
    r.add_post("/api/v1/auth/onboarding-complete", _stub_ok)
    r.add_post("/api/v1/auth/send-code", _stub_ok)
    r.add_post("/api/v1/auth/register-org", _stub_ok)

    # Agents/Config/Profiles 兼容
    r.add_get("/api/v1/agents", handle_agents_list)
    # config 路由已迁移到 config.py
    r.add_get("/api/v1/profiles", handle_profiles_list)
    r.add_post("/api/v1/profiles/{profile_id}/switch", _stub_ok)
    r.add_get("/api/v1/squads", _stub_list)

    # Notifications
    r.add_get("/api/v1/notifications", handle_notifications_list)
    r.add_patch("/api/v1/notifications/{notif_id}/read", handle_notification_read)
    r.add_post("/api/v1/notifications/read-all", _stub_ok)

    # Workstation 结构化 stub（前端期望特定格式）
    r.add_get("/api/v1/workstation/insights-v2", handle_insights_v2)
    r.add_get("/api/v1/workstation/patterns", handle_patterns)
    r.add_get("/api/v1/workstation/risks", handle_risks)

    # 其他 stub（避免前端 404）
    for path in (
        "/api/v1/heartbeats", "/api/v1/knowledge", "/api/v1/knowledge/connectors",
        "/api/v1/knowledge/connector-types", "/api/v1/users", "/api/v1/templates",
        "/api/v1/scenarios", "/api/v1/custom-tools/templates",
        "/api/v1/skills/my", "/api/v1/skills/suggestions",
        "/api/v1/playbook/rules", "/api/v1/approvals",
        "/api/v1/marketplace/builtin", "/api/v1/marketplace/installed",
    ):
        r.add_get(path, _stub_list)
    r.add_get("/api/v1/learning/overview", _stub_obj)
    # llm/test-key 已迁移到 config.py

    # Analytics（前端 Dashboard 页面需要）
    r.add_get("/api/v1/analytics/daily", handle_analytics_daily)
    r.add_get("/api/v1/analytics/weekly", _stub_list)
    r.add_get("/api/v1/analytics/quality", handle_analytics_quality)
    r.add_get("/api/v1/analytics/quality/trend", _stub_list)
    r.add_get("/api/v1/analytics/insights", _stub_list)
    r.add_get("/api/v1/analytics/signal", handle_analytics_signal_list)
    r.add_post("/api/v1/analytics/signal", _stub_ok)
    r.add_delete("/api/v1/analytics/signal/{signal_id}", handle_analytics_signal_delete)
    r.add_get("/api/v1/analytics/session/{session_id}", _stub_obj)

    # Work Items / Daily Context（真实数据）
    r.add_get("/api/v1/work-items", handle_work_items_list)
    r.add_post("/api/v1/work-items", handle_work_item_create)
    r.add_get("/api/v1/daily-context", handle_daily_context)
    r.add_post("/api/v1/daily-context/{item_type}", handle_daily_context_add)
