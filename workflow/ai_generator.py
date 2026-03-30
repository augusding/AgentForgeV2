"""
AgentForge V2 — AI 工作流生成器

根据用户自然语言描述，调用 LLM 生成完整的工作流定义（nodes + edges）。
"""

import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

CORE_CATALOG = """
## 节点目录（只能使用以下节点）

### 触发器 — 必须有且仅有一个，id 固定 "t1"
- manualTrigger: 手动触发。config: {}
- scheduleTrigger: 定时触发。config: { "cron": "0 9 * * *" } — 格式: 分 时 日 月 周
- webhookTrigger: Webhook。config: { "path": "自定义路径" }

### 核心节点（常用，优先选这些）
- ai: AI处理。config: { "operation": "generate|summarize|classify|extract", "prompt": "具体提示词", "maxLength": 500 }
- http: HTTP请求。config: { "method": "GET|POST", "url": "", "headers": {}, "body": {}, "timeout": 15 }
- code: Python代码。config: { "code": "result = {}" } — 必须设置 result 变量
- if: 条件分支（2输出: 0=true,1=false）。config: { "mode": "expression", "expression": "$input.field > 值" }
- feishu: 飞书通知。config: { "webhookUrl": "", "content": "支持 {{ $input.xxx }}" }
- email: 邮件。config: { "to": "", "subject": "", "body": "" }
- notification: 系统通知。config: { "title": "", "message": "" }

### 扩展节点（按需使用）
- scraper: 网页抓取 { "url":"", "extract":"text" }
- database: SQL查询 { "dbType":"sqlite", "query":"" }
- kvStore: KV存储 { "action":"set|get|delete", "key":"", "scope":"global" }
- transform: 数据过滤 { "filter":"表达式" }
- switch: 多路分发(4输出) { "mode":"value", "routeField":"", "routeValues":"A,B,C" }
- delay: 延时 { "seconds": 5 }
- merge: 合并分支(2输入) { "mode":"combine" }
- loop: 循环 { "field":"items" }
- dingtalk: 钉钉通知 { "webhookUrl":"", "content":"" }
- wecom: 企微通知 { "webhookUrl":"", "content":"" }
- excel: Excel { "action":"read|create", "path":"" }
- document: 文档 { "format":"docx", "template":"" }
- approval: 审批 { "title":"", "autoApprove":false }
- set: 设置变量 { "assignments":{"key":"value"} }
"""

SYSTEM_PROMPT = (
    "你是工作流设计专家。将用户描述转为 JSON 工作流。\n\n"
    "{catalog}\n\n"
    '严格只返回 JSON（无 markdown、无解释）：\n'
    '{{"name":"名称","description":"描述","nodes":[{{"id":"t1","type":"类型","label":"标签","config":{{}},"position":{{"x":0,"y":200}}}}],"edges":[{{"source":"t1","target":"n1"}}]}}\n\n'
    "规则：\n"
    "1. 触发器 id=\"t1\"，后续 id 递增 n1/n2/n3\n"
    "2. position.x 间隔250，分支时 y 上下错开(100/320)\n"
    "3. 用户未指定定时则用 manualTrigger\n"
    "4. 需填写的参数(URL/邮箱)用\"\"占位，label 标注\"需填写\"\n"
    "5. if/switch 分支边加 sourceOutput:0/1\n"
    "6. AI 节点 prompt 写具体内容，不要占位\n"
    "7. 保持精简，不过度设计"
)


async def generate_workflow(llm_client, user_prompt: str) -> dict[str, Any]:
    """调用 LLM 生成工作流定义。"""
    system = SYSTEM_PROMPT.format(catalog=CORE_CATALOG)

    try:
        response = await llm_client.chat(
            system=system,
            messages=[{"role": "user", "content": user_prompt}],
            temperature=0.3,
            max_tokens=4000,
        )
    except Exception as e:
        logger.error("AI 生成工作流 LLM 调用失败: %s", e)
        return {"error": f"LLM 调用失败: {e}"}

    content = response.content if hasattr(response, 'content') else str(response)
    workflow = _extract_json(content)
    if not workflow:
        logger.error("AI 生成工作流 JSON 解析失败: %s", content[:500])
        return {"error": "生成结果解析失败，请重试或换一种描述方式"}

    _validate(workflow)
    return workflow


def _extract_json(text: str) -> dict | None:
    """从 LLM 响应中提取 JSON。"""
    text = re.sub(r'^```(?:json)?\s*\n?', '', text.strip())
    text = re.sub(r'\n?```\s*$', '', text.strip())
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return None


def _validate(wf: dict) -> None:
    """基础校验 + 自动修复。"""
    nodes = wf.get("nodes", [])
    edges = wf.get("edges", [])
    if not nodes:
        return

    trigger_types = {"manualTrigger", "scheduleTrigger", "webhookTrigger"}
    triggers = [n for n in nodes if n.get("type") in trigger_types]
    if not triggers:
        wf["nodes"].insert(0, {
            "id": "t1", "type": "manualTrigger", "label": "手动触发",
            "config": {}, "position": {"x": 0, "y": 200}
        })
        if nodes and not any(e.get("source") == "t1" for e in edges):
            wf["edges"].insert(0, {"source": "t1", "target": nodes[0].get("id", "n1")})
