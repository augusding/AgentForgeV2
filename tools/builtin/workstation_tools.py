"""AgentForge V2 — 工位管理工具，让 AI 助手管理优先事项、日程、跟进和工作项。"""

from __future__ import annotations

import json
from tools.registry import ToolDefinition


def create_workstation_tools(work_item_store) -> list[ToolDefinition]:
    """创建工位管理工具集（需要 WorkItemStore 实例）。"""

    async def _manage_priority(args: dict) -> str:
        action = args.get("action", "list")
        uid, oid, pid = args.get("user_id", ""), args.get("org_id", ""), args.get("position_id", "")
        if action == "list":
            return json.dumps({"priorities": await work_item_store.get_priorities(uid, oid, pid)}, ensure_ascii=False)
        elif action == "add":
            rid = await work_item_store.add_priority(
                uid, oid, pid, title=args.get("title", ""), description=args.get("description", ""),
                priority=args.get("priority", "P1"), due_date=args.get("due_date", ""))
            return json.dumps({"status": "created", "id": rid}, ensure_ascii=False)
        elif action == "update":
            kw = {k: v for k, v in args.items() if k in ("title", "description", "priority", "status", "due_date") and v}
            await work_item_store.update_priority(args.get("id", ""), **kw)
            return json.dumps({"status": "updated"}, ensure_ascii=False)
        elif action == "delete":
            await work_item_store.delete_priority(args.get("id", ""))
            return json.dumps({"status": "deleted"}, ensure_ascii=False)
        return json.dumps({"error": f"未知操作: {action}"}, ensure_ascii=False)

    async def _manage_schedule(args: dict) -> str:
        action = args.get("action", "list")
        uid, oid, pid = args.get("user_id", ""), args.get("org_id", ""), args.get("position_id", "")
        if action == "list":
            return json.dumps({"schedules": await work_item_store.get_schedules(uid, oid, date=args.get("date", ""))}, ensure_ascii=False)
        elif action == "add":
            rid = await work_item_store.add_schedule(
                uid, oid, pid, title=args.get("title", ""), scheduled_time=args.get("time", ""),
                duration_minutes=args.get("duration", 60), description=args.get("description", ""))
            return json.dumps({"status": "created", "id": rid}, ensure_ascii=False)
        elif action == "delete":
            await work_item_store.delete_schedule(args.get("id", ""))
            return json.dumps({"status": "deleted"}, ensure_ascii=False)
        return json.dumps({"error": f"未知操作: {action}"}, ensure_ascii=False)

    async def _manage_followup(args: dict) -> str:
        action = args.get("action", "list")
        uid, oid = args.get("user_id", ""), args.get("org_id", "")
        if action == "list":
            return json.dumps({"followups": await work_item_store.get_followups(uid, oid)}, ensure_ascii=False)
        elif action == "add":
            rid = await work_item_store.add_followup(
                uid, oid, args.get("position_id", ""), title=args.get("title", ""),
                target=args.get("target", ""), due_date=args.get("due_date", ""),
                description=args.get("description", ""))
            return json.dumps({"status": "created", "id": rid}, ensure_ascii=False)
        elif action == "update":
            kw = {k: v for k, v in args.items() if k in ("title", "description", "target", "due_date", "status") and v}
            await work_item_store.update_followup(args.get("id", ""), **kw)
            return json.dumps({"status": "updated"}, ensure_ascii=False)
        elif action == "delete":
            await work_item_store.delete_followup(args.get("id", ""))
            return json.dumps({"status": "deleted"}, ensure_ascii=False)
        return json.dumps({"error": f"未知操作: {action}"}, ensure_ascii=False)

    async def _manage_work_item(args: dict) -> str:
        action = args.get("action", "list")
        uid, oid, pid = args.get("user_id", ""), args.get("org_id", ""), args.get("position_id", "")
        if action == "list":
            return json.dumps({"work_items": await work_item_store.get_work_items(uid, oid, pid)}, ensure_ascii=False)
        elif action == "add":
            rid = await work_item_store.add_work_item(
                uid, oid, pid, title=args.get("title", ""), item_type=args.get("type", "task"),
                priority=args.get("priority", "P1"), description=args.get("description", ""),
                due_date=args.get("due_date", ""))
            return json.dumps({"status": "created", "id": rid}, ensure_ascii=False)
        elif action == "update":
            kw = {k: v for k, v in args.items() if k in ("title", "description", "status", "priority", "due_date") and v}
            await work_item_store.update_work_item(args.get("id", ""), **kw)
            return json.dumps({"status": "updated"}, ensure_ascii=False)
        elif action == "delete":
            await work_item_store.delete_work_item(args.get("id", ""))
            return json.dumps({"status": "deleted"}, ensure_ascii=False)
        return json.dumps({"error": f"未知操作: {action}"}, ensure_ascii=False)

    # 共享用户上下文参数
    _ctx = {
        "user_id": {"type": "string", "description": "用户ID（从上下文获取）"},
        "org_id": {"type": "string", "description": "组织ID（从上下文获取）"},
        "position_id": {"type": "string", "description": "岗位ID（从上下文获取）"},
    }

    return [
        ToolDefinition(
            name="manage_priority",
            description="管理优先事项。支持 list/add/update/delete。用于管理用户今天要重点关注的工作。",
            input_schema={"type": "object", "properties": {
                "action": {"type": "string", "enum": ["list", "add", "update", "delete"]},
                "title": {"type": "string", "description": "事项标题"},
                "description": {"type": "string"},
                "priority": {"type": "string", "enum": ["P0", "P1", "P2"], "default": "P1"},
                "due_date": {"type": "string", "description": "截止日期 YYYY-MM-DD"},
                "status": {"type": "string", "enum": ["active", "done", "cancelled"]},
                "id": {"type": "string", "description": "事项ID（update/delete时）"},
                **_ctx,
            }, "required": ["action"]},
            handler=_manage_priority, category="workstation",
        ),
        ToolDefinition(
            name="manage_schedule",
            description="管理日程安排。支持 list/add/delete。用于查看和管理用户的日程。",
            input_schema={"type": "object", "properties": {
                "action": {"type": "string", "enum": ["list", "add", "delete"]},
                "title": {"type": "string", "description": "日程标题"},
                "time": {"type": "string", "description": "日程时间 YYYY-MM-DD HH:MM"},
                "duration": {"type": "integer", "description": "时长（分钟）", "default": 60},
                "description": {"type": "string"},
                "date": {"type": "string", "description": "查询日期 YYYY-MM-DD（list时）"},
                "id": {"type": "string", "description": "日程ID（delete时）"},
                **_ctx,
            }, "required": ["action"]},
            handler=_manage_schedule, category="workstation",
        ),
        ToolDefinition(
            name="manage_followup",
            description="管理跟进事项。支持 list/add/update/delete。用于追踪需要后续跟进的工作。",
            input_schema={"type": "object", "properties": {
                "action": {"type": "string", "enum": ["list", "add", "update", "delete"]},
                "title": {"type": "string", "description": "跟进标题"},
                "target": {"type": "string", "description": "跟进对象（人/团队）"},
                "due_date": {"type": "string", "description": "截止日期 YYYY-MM-DD"},
                "description": {"type": "string"},
                "status": {"type": "string", "enum": ["pending", "done", "cancelled"]},
                "id": {"type": "string", "description": "跟进ID（update/delete时）"},
                **_ctx,
            }, "required": ["action"]},
            handler=_manage_followup, category="workstation",
        ),
        ToolDefinition(
            name="manage_work_item",
            description="管理工作项。支持 list/add/update/delete。用于管理任务、bug、需求等工作项。",
            input_schema={"type": "object", "properties": {
                "action": {"type": "string", "enum": ["list", "add", "update", "delete"]},
                "title": {"type": "string", "description": "工作项标题"},
                "type": {"type": "string", "enum": ["task", "bug", "feature", "doc"], "default": "task"},
                "priority": {"type": "string", "enum": ["P0", "P1", "P2"]},
                "description": {"type": "string"},
                "status": {"type": "string", "enum": ["todo", "in_progress", "done", "cancelled"]},
                "due_date": {"type": "string", "description": "截止日期 YYYY-MM-DD"},
                "id": {"type": "string", "description": "工作项ID（update/delete时）"},
                **_ctx,
            }, "required": ["action"]},
            handler=_manage_work_item, category="workstation",
        ),
    ]
