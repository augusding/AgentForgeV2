"""AgentForge V2 — 工作流工具：让 LLM 能查询和触发工作流。"""

from __future__ import annotations

import json
import logging

from tools.registry import ToolDefinition

logger = logging.getLogger(__name__)


def create_workflow_tools(wf_store, trigger_manager=None) -> list[ToolDefinition]:
    """创建工作流相关工具（需要 WorkflowStore 实例）。"""

    async def _list_handler(args: dict) -> str:
        try:
            workflows = await wf_store.list_workflows(org_id=args.get("org_id", ""))
            result = [{"id": w.get("id", ""), "name": w.get("name", ""),
                        "description": w.get("description", ""), "enabled": w.get("enabled", True),
                        "node_count": w.get("node_count", 0)} for w in workflows]
            return json.dumps({"workflows": result, "count": len(result)}, ensure_ascii=False)
        except Exception as e:
            return json.dumps({"error": f"获取工作流列表失败: {e}"}, ensure_ascii=False)

    async def _run_handler(args: dict) -> str:
        name = args.get("name", "").strip()
        wf_id = args.get("workflow_id", "").strip()
        if not name and not wf_id:
            return json.dumps({"error": "请指定工作流名称或 ID"}, ensure_ascii=False)
        try:
            workflows = await wf_store.list_workflows()
            matched = None
            for wf in workflows:
                if wf_id and wf.get("id") == wf_id:
                    matched = wf; break
                if name and name.lower() in wf.get("name", "").lower():
                    matched = wf; break
            if not matched:
                return json.dumps({"error": f"未找到工作流: {name or wf_id}",
                                   "suggestion": "可以用 list_workflows 查看所有可用工作流"}, ensure_ascii=False)
            if not matched.get("enabled", True):
                return json.dumps({"error": f"工作流 '{matched['name']}' 已禁用"}, ensure_ascii=False)
            return json.dumps({"action": "confirm_run", "workflow_id": matched["id"],
                               "workflow_name": matched.get("name", ""),
                               "description": matched.get("description", ""),
                               "node_count": matched.get("node_count", 0),
                               "message": f"找到工作流「{matched['name']}」，请确认是否执行。"}, ensure_ascii=False)
        except Exception as e:
            return json.dumps({"error": f"查找工作流失败: {e}"}, ensure_ascii=False)

    return [
        ToolDefinition(
            name="list_workflows",
            description="列出当前可用的工作流。当用户询问'有哪些工作流''可用的流程''工作流列表'时使用。",
            input_schema={"type": "object", "properties": {
                "org_id": {"type": "string", "description": "组织 ID（可选）"},
            }, "required": []},
            handler=_list_handler, category="workflow",
        ),
        ToolDefinition(
            name="run_workflow",
            description="触发执行指定的工作流。当用户要求'执行/运行/触发某个工作流'时使用。返回确认信息，用户确认后才执行。",
            input_schema={"type": "object", "properties": {
                "name": {"type": "string", "description": "工作流名称（模糊匹配）"},
                "workflow_id": {"type": "string", "description": "工作流 ID（精确匹配）"},
            }, "required": []},
            handler=_run_handler, category="workflow",
        ),
    ]
