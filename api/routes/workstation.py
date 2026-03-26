"""AgentForge V2 — 工位路由：工位首页、岗位列表、每日上下文。"""

import json
import logging

from aiohttp import web

logger = logging.getLogger(__name__)


def _json(data, status=200):
    return web.Response(
        text=json.dumps(data, ensure_ascii=False, default=str),
        content_type="application/json", status=status,
    )


def _get_user(request) -> tuple[str, str]:
    """从 JWT 中提取 user_id 和 org_id。未认证时返回 anonymous。"""
    user = request.get("user")
    if user and isinstance(user, dict):
        return user.get("sub", "anonymous"), user.get("org_id", "")
    return "anonymous", ""


async def handle_home(request: web.Request) -> web.Response:
    """GET /api/v1/workstation/home — 工位首页数据"""
    engine = request.app["engine"]
    user_id, org_id = _get_user(request)
    position_id = request.query.get("position_id", "")

    # 没传 position_id 时从持久化分配中恢复
    if not position_id and engine.work_item_store:
        position_id = await engine.work_item_store.get_assignment(user_id, org_id)

    # 查找岗位配置
    pos_cfg = None
    for bundle in engine._bundles.values():
        pos = bundle.positions.get(position_id)
        if pos:
            pos_cfg = pos
            break

    if not pos_cfg:
        return _json({
            "assigned": False, "position": None, "assistant": {},
            "metrics": [], "quick_workflows": [], "tools": [],
            "knowledge_scope": [], "onboarding": {}, "recent_chats": [], "pending_items": [],
        })

    position_info = {
        "position_id": pos_cfg.position_id, "display_name": pos_cfg.display_name,
        "icon": pos_cfg.icon, "color": pos_cfg.color,
        "department": pos_cfg.department, "description": pos_cfg.description,
    }

    priorities, schedules, followups, work_items, insights = [], [], [], [], []
    if engine.work_item_store:
        priorities = await engine.work_item_store.get_priorities(user_id, org_id, position_id)
        schedules = await engine.work_item_store.get_schedules(user_id, org_id)
        followups = await engine.work_item_store.get_followups(user_id, org_id)
        work_items = await engine.work_item_store.get_work_items(user_id, org_id, position_id, limit=10)
    if engine.signal_store:
        insights = await engine.signal_store.get_insights(user_id, org_id, position_id, limit=5)

    quick_workflows = [{"id": s["id"], "name": s.get("name", s["id"]),
                        "description": s.get("description", ""), "icon": s.get("icon", "play")}
                       for s in pos_cfg.skills if isinstance(s, dict) and s.get("id")]

    recent_chats = []
    if engine.session_store:
        for sess in await engine.session_store.list_sessions(user_id=user_id, position_id=position_id, limit=5):
            recent_chats.append({"session_id": sess["id"], "title": sess.get("title", ""),
                                 "updated_at": sess.get("updated_at", 0)})

    return _json({
        "assigned": True,
        "position": position_info,
        "assistant": {
            "personality": pos_cfg.role[:100] if pos_cfg.role else "",
            "default_model": pos_cfg.default_model,
        },
        "metrics": [],
        "quick_workflows": quick_workflows,
        "tools": pos_cfg.tools,
        "knowledge_scope": pos_cfg.knowledge_scope,
        "onboarding": pos_cfg.onboarding,
        "recent_chats": recent_chats,
        "pending_items": [],
        # V2 额外数据
        "focus": {"priorities": priorities, "schedules": schedules, "followups": followups},
        "work_items": work_items,
        "insights": insights,
    })


async def handle_positions(request: web.Request) -> web.Response:
    """GET /api/v1/workstation/positions"""
    engine = request.app["engine"]
    profile = request.query.get("profile", "")
    return _json({"positions": engine.get_positions_list(profile)})


async def handle_position_detail(request: web.Request) -> web.Response:
    """GET /api/v1/workstation/positions/{position_id}"""
    engine = request.app["engine"]
    position_id = request.match_info["position_id"]
    for bundle in engine._bundles.values():
        if position_id in bundle.positions:
            pos = bundle.positions[position_id]
            return _json({
                "position_id": pos.position_id, "display_name": pos.display_name,
                "icon": pos.icon, "color": pos.color,
                "department": pos.department, "domain": pos.domain,
                "description": pos.description, "tools": pos.tools,
                "knowledge_scope": pos.knowledge_scope, "onboarding": pos.onboarding,
                "skills": [{"id": s.get("id", ""), "name": s.get("name", "")} for s in pos.skills],
            })
    return _json({"error": "岗位不存在"}, status=404)


async def handle_assign(request: web.Request) -> web.Response:
    """POST /api/v1/workstation/assign — 分配岗位"""
    engine = request.app["engine"]
    user_id, org_id = _get_user(request)
    if user_id == "anonymous":
        return _json({"error": "请先登录"}, status=401)
    body = await request.json()
    position_id = body.get("position_id", "")
    if not position_id:
        return _json({"error": "position_id 不能为空"}, status=400)
    if engine.work_item_store:
        await engine.work_item_store.set_assignment(user_id, org_id, position_id)
    return _json({"status": "assigned", "position_id": position_id})


async def handle_daily_brief(request: web.Request) -> web.Response:
    """POST /api/v1/workstation/daily-brief — AI 生成今日行动建议"""
    import datetime
    import time as _time

    engine = request.app["engine"]
    user_id, org_id = _get_user(request)
    position_id = ""
    if engine.work_item_store:
        position_id = await engine.work_item_store.get_assignment(user_id, org_id)

    pos_name = ""
    for bundle in engine._bundles.values():
        pos = bundle.positions.get(position_id)
        if pos:
            pos_name = pos.display_name
            break

    now = datetime.datetime.now()
    today_str = now.strftime("%Y-%m-%d")

    # ── 收集数据 ──
    priorities, schedules, followups = [], [], []
    recent_sessions, workflow_execs = [], []
    token_today = 0

    try:
        if engine.work_item_store:
            priorities = await engine.work_item_store.get_priorities(user_id, org_id, position_id, status="active")
            schedules = await engine.work_item_store.get_schedules(user_id, org_id)
            followups = await engine.work_item_store.get_followups(user_id, org_id)
    except Exception:
        pass

    try:
        if engine.session_store:
            recent_sessions = await engine.session_store.list_sessions(user_id=user_id, limit=5)
    except Exception:
        pass

    try:
        if engine.wf_store:
            wfs = await engine.wf_store.list_workflows()
            for wf in wfs[:10]:
                try:
                    execs = await engine.wf_store.get_executions(wf["id"], limit=1)
                    if execs:
                        ex = execs[0]
                        ex["workflow_name"] = wf.get("name", "")
                        ex["workflow_id"] = wf["id"]
                        workflow_execs.append(ex)
                except Exception:
                    pass
    except Exception:
        pass

    today_schedules = [s for s in schedules if (s.get("scheduled_time") or "").startswith(today_str)]
    pending_followups = [f for f in followups if f.get("status") == "pending"]
    failed_workflows = [e for e in workflow_execs if e.get("status") == "failed"]

    stats = {
        "pending_tasks": len(priorities),
        "today_schedules": len(today_schedules),
        "overdue_followups": len(pending_followups),
        "failed_workflows": len(failed_workflows),
        "today_tokens": token_today,
        "total_workflows": len(workflow_execs),
        "recent_sessions": len(recent_sessions),
    }

    greeting = "早上好" if now.hour < 12 else "下午好" if now.hour < 18 else "晚上好"
    summary = f"今天有 {stats['pending_tasks']} 条待办、{stats['today_schedules']} 个日程"
    if stats["failed_workflows"] > 0:
        summary += f"、{stats['failed_workflows']} 个工作流需要处理"

    # ── 生成行动建议（规则）──
    actions = []
    if failed_workflows:
        for wf in failed_workflows[:2]:
            actions.append({"title": f"修复工作流：{wf.get('workflow_name', '')}", "reason": str(wf.get("error", ""))[:50],
                            "action": "查看并修复工作流", "type": "workflow", "urgency": "high",
                            "metadata": {"workflowId": wf.get("workflow_id", "")}})
    if priorities:
        for p in priorities[:2]:
            actions.append({"title": p["title"],
                            "reason": f"{p.get('priority','P1')}" + (f" 截止 {p['due_date']}" if p.get("due_date") else ""),
                            "action": "在 AI 对话中推进", "type": "chat", "urgency": "high" if p.get("priority") == "P0" else "medium",
                            "metadata": {"prompt": f"帮我推进任务：{p['title']}"}})
    if pending_followups:
        for f in pending_followups[:1]:
            actions.append({"title": f"跟进：{f['title']}", "reason": f"对象：{f.get('target', '')}",
                            "action": "记录跟进进展", "type": "followup", "urgency": "medium"})
    if not actions:
        actions.append({"title": "开始你的第一个任务", "reason": "还没有待办事项",
                        "action": "告诉 AI 你今天要做什么", "type": "chat", "urgency": "low",
                        "metadata": {"prompt": "帮我规划今天的工作"}})

    return _json({
        "greeting": greeting, "summary": summary, "actions": actions[:5], "stats": stats,
        "workflow_status": [{"name": e.get("workflow_name", ""), "status": e.get("status", ""),
                             "error": str(e.get("error", ""))[:80], "workflow_id": e.get("workflow_id", ""),
                             "executed_at": e.get("started_at", 0)} for e in workflow_execs[:6]],
        "today_schedules": today_schedules[:5],
        "recent_sessions": [{"id": s.get("id", ""), "title": s.get("title", "新对话")} for s in recent_sessions[:5]],
    })


def register(app: web.Application) -> None:
    app.router.add_get("/api/v1/workstation/home", handle_home)
    app.router.add_get("/api/v1/workstation/positions", handle_positions)
    app.router.add_get("/api/v1/workstation/positions/{position_id}", handle_position_detail)
    app.router.add_post("/api/v1/workstation/assign", handle_assign)
    app.router.add_post("/api/v1/workstation/daily-brief", handle_daily_brief)
