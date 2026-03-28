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
            "onboarding": {}, "recent_chats": [], "pending_items": [],
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

    quick_workflows = []

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
                "description": pos.description, "role": pos.role, "goal": pos.goal,
                "identity": pos.identity, "values": pos.values, "behavior": pos.behavior,
                "default_model": pos.default_model, "complex_model": pos.complex_model,
                "onboarding": pos.onboarding,
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
    priorities, schedules, followups, work_items = [], [], [], []
    recent_sessions, workflow_execs = [], []
    token_today = 0

    try:
        if engine.work_item_store:
            priorities = await engine.work_item_store.get_priorities(user_id, org_id, position_id, status="active")
            schedules = await engine.work_item_store.get_schedules(user_id, org_id)
            followups = await engine.work_item_store.get_followups(user_id, org_id)
            work_items = await engine.work_item_store.get_work_items(user_id, org_id, position_id)
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

    pending_followups = [f for f in followups if f.get("status") == "pending"]
    failed_workflows = [e for e in workflow_execs if e.get("status") == "failed"]

    greeting = "早上好" if now.hour < 12 else "下午好" if now.hour < 18 else "晚上好"

    # ── AI 建议引擎（按优先级排序）──
    actions = []

    # 1. 逾期任务（最高优先级）
    for p in priorities:
        if p.get("due_date") and p["due_date"] < today_str:
            days = (now - datetime.datetime.strptime(p["due_date"], "%Y-%m-%d")).days
            actions.append({"title": p["title"], "reason": f"已逾期 {days} 天",
                            "category": "overdue", "urgency": "high",
                            "prompt": f"帮我推进逾期任务：{p['title']}"})

    # 2. 逾期跟进
    for f in pending_followups:
        if f.get("due_date") and f["due_date"] < today_str:
            days = (now - datetime.datetime.strptime(f["due_date"], "%Y-%m-%d")).days
            actions.append({"title": f"跟进{f.get('target', '')}：{f['title']}", "reason": f"已逾期 {days} 天",
                            "category": "overdue", "urgency": "high",
                            "prompt": f"帮我跟进：{f['title']}"})

    # 3. 今天截止的任务
    for p in priorities:
        if p.get("due_date") == today_str:
            actions.append({"title": p["title"], "reason": "今天截止",
                            "category": "due_today", "urgency": "medium",
                            "prompt": f"帮我完成今天截止的任务：{p['title']}"})

    # 4. P0 任务（即使没到期也要推进）
    for p in priorities:
        if p.get("priority") == "P0" and not any(a["title"] == p["title"] for a in actions):
            actions.append({"title": p["title"], "reason": "P0 高优先级",
                            "category": "high_priority", "urgency": "medium",
                            "prompt": f"帮我推进 P0 任务：{p['title']}"})

    # 5. 失败的工作流
    for wf in failed_workflows[:2]:
        actions.append({"title": f"修复工作流：{wf.get('workflow_name', '')}", "reason": str(wf.get("error", ""))[:50],
                        "category": "workflow_error", "urgency": "high",
                        "prompt": f"帮我排查工作流问题：{wf.get('workflow_name', '')}"})

    # 6. 明天有重要日程时提醒准备
    tomorrow_str = (now + datetime.timedelta(days=1)).strftime("%Y-%m-%d")
    tomorrow_schedules = [s for s in schedules if (s.get("scheduled_time") or "").startswith(tomorrow_str)]
    if tomorrow_schedules:
        actions.append({"title": f"明天有 {len(tomorrow_schedules)} 个日程，建议提前准备",
                        "reason": "、".join(s["title"] for s in tomorrow_schedules[:3]),
                        "category": "prepare", "urgency": "low",
                        "prompt": f"帮我准备明天的日程：{tomorrow_schedules[0]['title']}"})

    # 7. 空闲时的建议
    if not actions:
        actions.append({"title": "规划今天的工作", "reason": "暂无紧急事项，可以做些规划",
                        "category": "plan", "urgency": "low",
                        "prompt": "帮我规划今天的工作"})

    return _json({
        "greeting": greeting, "actions": actions[:6], "stats": {
            "pending_tasks": len(priorities), "total_work_items": len(work_items),
            "overdue_followups": len(pending_followups), "failed_workflows": len(failed_workflows),
        },
        "priorities": priorities, "work_items": work_items,
        "schedules": schedules, "followups": followups,
    })


def register(app: web.Application) -> None:
    app.router.add_get("/api/v1/workstation/home", handle_home)
    app.router.add_get("/api/v1/workstation/positions", handle_positions)
    app.router.add_get("/api/v1/workstation/positions/{position_id}", handle_position_detail)
    app.router.add_post("/api/v1/workstation/assign", handle_assign)
    app.router.add_post("/api/v1/workstation/daily-brief", handle_daily_brief)
