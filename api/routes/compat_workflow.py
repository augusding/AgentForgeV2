"""AgentForge V2 — workflow-engine 兼容路由，映射前端旧路径到 V2 工作流。"""

import json
import logging
import re

from aiohttp import web

from workflow.types import WorkflowDefinition, WorkflowNode

logger = logging.getLogger(__name__)


def _json(data, status=200):
    return web.Response(
        text=json.dumps(data, ensure_ascii=False, default=str),
        content_type="application/json", status=status,
    )


# ── 节点目录 ──────────────────────────────────────────────

async def handle_node_catalog(request):
    """GET /api/v1/workflow-engine/nodes — 从 NodeRegistry 获取真实节点目录"""
    engine = request.app["engine"]
    if engine.wf_engine and hasattr(engine.wf_engine, '_registry'):
        catalog = engine.wf_engine._registry.get_catalog()
        if catalog:
            return _json({"nodes": catalog})
    # fallback
    return _json({"nodes": [
        {"name": "manualTrigger", "displayName": "手动触发", "group": "trigger"},
        {"name": "scheduleTrigger", "displayName": "定时触发", "group": "trigger"},
        {"name": "webhookTrigger", "displayName": "Webhook 触发", "group": "trigger"},
        {"name": "code", "displayName": "代码执行", "group": "logic"},
        {"name": "set", "displayName": "设置变量", "group": "data"},
        {"name": "notification", "displayName": "通知", "group": "notify"},
    ]})


# ── 工作流 CRUD 转发 ─────────────────────────────────────

def _wf_to_json(wf):
    return {
        "id": wf.id, "name": wf.name, "description": wf.description,
        "nodes": [{"id": n.id, "type": n.type, "label": n.label,
                   "config": n.config, "position": n.position} for n in wf.nodes],
        "edges": wf.edges, "trigger": wf.trigger, "version": wf.version,
    }


async def handle_wf_list(request):
    engine = request.app["engine"]
    if not engine.wf_store:
        return _json({"workflows": []})
    workflows = await engine.wf_store.list_workflows()
    return _json({"workflows": workflows})


async def handle_wf_get(request):
    engine = request.app["engine"]
    wf_id = request.match_info["wf_id"]
    if engine.wf_store:
        wf = await engine.wf_store.get_workflow(wf_id)
        if wf:
            return _json(_wf_to_json(wf))
    return _json({"error": "工作流不存在"}, status=404)


async def handle_wf_create(request):
    engine = request.app["engine"]
    if not engine.wf_store:
        return _json({"error": "store 不可用"}, status=503)
    body = await request.json()
    from uuid import uuid4
    wf = WorkflowDefinition(
        id=body.get("id", uuid4().hex[:12]),
        name=body.get("name", "未命名工作流"),
        description=body.get("description", ""),
        nodes=[WorkflowNode(**n) for n in body.get("nodes", [])],
        edges=body.get("edges", []),
        trigger=body.get("trigger", {}),
        variables=body.get("variables", {}),
    )
    await engine.wf_store.save_workflow(wf)
    return _json({"id": wf.id, "status": "created"})


async def handle_wf_update(request):
    engine = request.app["engine"]
    if not engine.wf_store:
        return _json({"error": "store 不可用"}, status=503)
    wf_id = request.match_info["wf_id"]
    body = await request.json()
    body.setdefault("id", wf_id)
    wf = WorkflowDefinition(
        id=body["id"], name=body.get("name", ""),
        description=body.get("description", ""),
        nodes=[WorkflowNode(**n) for n in body.get("nodes", [])],
        edges=body.get("edges", []),
        trigger=body.get("trigger", {}),
        variables=body.get("variables", {}),
    )
    await engine.wf_store.save_workflow(wf)
    return _json({"id": wf.id, "status": "updated"})


async def handle_wf_delete(request):
    engine = request.app["engine"]
    if not engine.wf_store:
        return _json({"error": "store 不可用"}, status=503)
    await engine.wf_store.delete_workflow(request.match_info["wf_id"])
    return _json({"status": "deleted"})


async def handle_wf_execute(request):
    engine = request.app["engine"]
    if not engine.wf_store or not engine.wf_engine:
        return _json({"error": "workflow engine 不可用"}, status=503)
    wf_id = request.match_info["wf_id"]
    wf = await engine.wf_store.get_workflow(wf_id)
    if not wf:
        return _json({"error": "工作流不存在"}, status=404)
    body = await request.json() if request.can_read_body else {}
    execution = await engine.wf_engine.run(wf, trigger_data=body.get("trigger_data", {}),
                                            context={"llm": engine._llm})
    node_results = {nid: {"status": nr.status, "output": nr.output, "error": nr.error,
                          "duration": nr.duration} for nid, nr in execution.node_results.items()}
    await engine.wf_store.save_execution(
        exec_id=execution.id, workflow_id=wf_id, status=execution.status,
        node_results=node_results, variables=execution.variables,
        started_at=execution.started_at, completed_at=execution.completed_at,
        error=execution.error)
    return _json({"execution_id": execution.id, "status": execution.status,
                  "duration": execution.completed_at - execution.started_at})


# ── AI 工作流生成 ─────────────────────────────────────────

_GEN_SYSTEM = """你是一个工作流设计专家。根据用户的描述生成可视化工作流 JSON。

## 可用节点类型
- manualTrigger: 手动触发
- scheduleTrigger: 定时触发
- webhookTrigger: Webhook 触发
- ai: AI 处理（支持 generate/classify/extract/summarize 操作）
- code: Python 代码执行
- if: 条件判断（输出0=true, 输出1=false）
- switch: 多路分发
- set: 设置变量
- notification: 发送通知
- approval: 人工审批（输出0=approved, 输出1=rejected）
- loop: 循环处理
- http: HTTP 请求

## 工作流 JSON 格式
```json
{
  "name": "工作流名称",
  "description": "描述",
  "nodes": [
    {"id": "node_1", "type": "manualTrigger", "name": "开始", "position": [0, 0], "parameters": {}},
    {"id": "node_2", "type": "ai", "name": "AI处理", "position": [250, 0], "parameters": {"operation": "generate", "prompt": "..."}}
  ],
  "connections": [
    {"source": "node_1", "sourceOutput": 0, "target": "node_2", "targetInput": 0}
  ]
}
```

## 规则
1. 必须以 trigger 节点开头
2. position 从左到右排列，x 间隔约 250
3. 条件分支时 y 方向展开（间隔约 150）
4. AI 节点 parameters: {"operation": "generate|classify|extract|summarize", "prompt": "..."}

## 输出
用 JSON 包裹在 ```json ... ``` 中返回：
```json
{"workflow": { ... }, "explanation": "设计说明"}
```"""


async def handle_workflow_generate(request):
    """POST /api/v1/workflow-engine/generate — AI 生成工作流"""
    engine = request.app["engine"]
    body = await request.json()
    prompt = body.get("prompt", "").strip()
    mindmap = body.get("mindmap", "")
    history = body.get("history", [])

    if not prompt and not mindmap:
        return _json({"error": "prompt or mindmap is required"}, status=400)
    if not engine._llm:
        return _json({"error": "LLM not initialized"}, status=503)

    messages = [{"role": h.get("role", "user"), "content": h.get("content", "")} for h in history]
    user_content = prompt
    if mindmap:
        user_content = f"请基于以下业务流程图生成工作流：\n\n{mindmap}"
        if prompt:
            user_content += f"\n\n补充说明：{prompt}"
    messages.append({"role": "user", "content": user_content})

    raw = ""
    try:
        resp = await engine._llm.chat(system=_GEN_SYSTEM, messages=messages,
                                       temperature=0.3, max_tokens=4096)
        raw = resp.content
        json_match = re.search(r'```json\s*(.*?)\s*```', raw, re.DOTALL)
        parsed = json.loads(json_match.group(1)) if json_match else json.loads(raw)
        workflow = parsed.get("workflow", parsed)
        if "nodes" not in workflow:
            return _json({"error": "生成的工作流缺少 nodes", "raw": raw[:2000]}, status=422)
        return _json({"workflow": workflow, "explanation": parsed.get("explanation", "")})
    except json.JSONDecodeError:
        return _json({"error": "AI 返回格式解析失败", "raw": raw[:2000]}, status=422)
    except Exception as e:
        logger.error("工作流生成失败: %s", e)
        return _json({"error": f"生成失败: {e}"}, status=500)


# ── Stubs ─────────────────────────────────────────────────

async def _stub_ok(request): return _json({"status": "ok"})
async def _stub_list(request): return _json([])


def register(app: web.Application) -> None:
    r = app.router
    r.add_get("/api/v1/workflow-engine/nodes", handle_node_catalog)
    r.add_get("/api/v1/workflow-engine/workflows", handle_wf_list)
    r.add_get("/api/v1/workflow-engine/workflows/{wf_id}", handle_wf_get)
    r.add_post("/api/v1/workflow-engine/workflows", handle_wf_create)
    r.add_put("/api/v1/workflow-engine/workflows/{wf_id}", handle_wf_update)
    r.add_delete("/api/v1/workflow-engine/workflows/{wf_id}", handle_wf_delete)
    r.add_post("/api/v1/workflow-engine/workflows/{wf_id}/execute", handle_wf_execute)
    r.add_get("/api/v1/workflow-engine/executions", _stub_list)
    r.add_post("/api/v1/workflow-engine/generate", handle_workflow_generate)
    from api.routes.workflow import handle_test_node
    r.add_post("/api/v1/workflow-engine/test-node", handle_test_node)
