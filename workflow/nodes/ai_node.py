"""AI 节点：generate / classify / extract / summarize / route + 岗位 context 注入"""

import json
import logging

from workflow.registry import NodeRegistry, NodeTypeInfo
from workflow.types import WorkflowNode, NodeResult

logger = logging.getLogger(__name__)


def _build_position_context(ctx: dict) -> str:
    """从执行上下文提取岗位配置，构建 system prompt。"""
    pos_ctx = ctx.get("position_context", "")
    if pos_ctx:
        return f"你是工作流 AI 节点。以下是岗位专业背景，仅在相关时参考：\n{pos_ctx}"
    position = ctx.get("position")
    if position:
        parts = []
        if getattr(position, "identity", ""): parts.append(position.identity.strip())
        if getattr(position, "context", ""): parts.append(f"专业知识：\n{position.context.strip()}")
        if parts: return "你是工作流 AI 节点。\n" + "\n\n".join(parts)
    return ""


async def _ai_executor(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    llm = ctx.get("llm")
    if not llm:
        return NodeResult(node_id=node.id, status="failed", error="LLM 客户端不可用")

    op = node.config.get("operation", "generate")
    prompt = node.config.get("prompt", "")
    instruction = node.config.get("instruction", "")
    last = ctx.get("_last_output", {})
    inp = (last.get("text") or last.get("ai_result") or last.get("result") or
           (json.dumps(last, ensure_ascii=False) if isinstance(last, dict) else str(last)))

    custom_sys = node.config.get("system_prompt", "").strip()
    base = custom_sys or _build_position_context(ctx) or "你是工作流 AI 节点，帮助完成自动化任务。"

    try:
        if op == "generate":
            r = await llm.chat(system=base, messages=[{"role": "user", "content": prompt or inp}])
            return NodeResult(node_id=node.id, status="completed", output={"text": r.content, "ai_result": r.content})
        if op == "classify":
            cats = node.config.get("categories", "")
            r = await llm.chat(system=f"{base}\n\n分类到: {cats}。只输出类别名。",
                               messages=[{"role": "user", "content": (instruction + "\n\n" + inp) if instruction else inp}])
            return NodeResult(node_id=node.id, status="completed", output={"category": r.content.strip(), "text": r.content})
        if op == "extract":
            schema = node.config.get("extractionSchema", "{}")
            r = await llm.chat(system=f"{base}\n\n提取字段返回 JSON: {schema}",
                               messages=[{"role": "user", "content": (instruction + "\n\n" + inp) if instruction else inp}])
            try: extracted = json.loads(r.content.strip().strip("`").removeprefix("json").strip())
            except json.JSONDecodeError: extracted = {"raw": r.content}
            return NodeResult(node_id=node.id, status="completed", output={"extracted": extracted, "text": r.content})
        if op == "summarize":
            ml = node.config.get("maxLength", 200)
            r = await llm.chat(system=f"{base}\n\n摘要不超过{ml}字。", messages=[{"role": "user", "content": inp}])
            return NodeResult(node_id=node.id, status="completed", output={"summary": r.content, "text": r.content})
        if op == "route":
            desc = node.config.get("routeDescriptions", "")
            r = await llm.chat(system=f"{base}\n\n判断路由分支: {desc}。只输出分支名。",
                               messages=[{"role": "user", "content": inp}])
            return NodeResult(node_id=node.id, status="completed", output={"route": r.content.strip(), "text": r.content})
        return NodeResult(node_id=node.id, status="failed", error=f"未知操作: {op}")
    except Exception as e:
        return NodeResult(node_id=node.id, status="failed", error=f"AI 调用失败: {e}")


def register_ai(registry: NodeRegistry) -> None:
    registry.register(NodeTypeInfo(
        name="ai", display_name="AI 处理", group="ai", icon="sparkles",
        description="调用 LLM 执行生成、分类、提取、摘要或路由",
        parameters=[
            {"name": "operation", "type": "options", "displayName": "操作", "default": "generate",
             "options": [{"name": "生成", "value": "generate"}, {"name": "分类", "value": "classify"},
                        {"name": "提取", "value": "extract"}, {"name": "摘要", "value": "summarize"},
                        {"name": "路由", "value": "route"}]},
            {"name": "prompt", "type": "string", "displayName": "提示词", "default": "",
             "displayOptions": {"show": {"operation": ["generate"]}}},
            {"name": "instruction", "type": "string", "displayName": "指令", "default": "",
             "displayOptions": {"show": {"operation": ["classify", "extract", "summarize"]}}},
            {"name": "categories", "type": "string", "displayName": "分类类别", "default": "",
             "displayOptions": {"show": {"operation": ["classify"]}}},
            {"name": "extractionSchema", "type": "json", "displayName": "提取 Schema", "default": "{}",
             "displayOptions": {"show": {"operation": ["extract"]}}},
            {"name": "maxLength", "type": "number", "displayName": "摘要长度", "default": 200,
             "displayOptions": {"show": {"operation": ["summarize"]}}},
            {"name": "routeDescriptions", "type": "string", "displayName": "路由描述", "default": "",
             "displayOptions": {"show": {"operation": ["route"]}}},
            {"name": "system_prompt", "type": "string", "displayName": "自定义 System Prompt", "default": "",
             "description": "留空时自动使用岗位专家配置"},
        ], executor=_ai_executor))
