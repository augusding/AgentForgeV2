"""
AgentForge V2 — 工作流路由

工作流 CRUD + 执行 + 触发器管理。
"""

from __future__ import annotations

import json
import logging
from uuid import uuid4

from aiohttp import web

from workflow.types import WorkflowDefinition, WorkflowNode

logger = logging.getLogger(__name__)


def _json(data, status: int = 200) -> web.Response:
    return web.Response(
        text=json.dumps(data, ensure_ascii=False, default=str),
        content_type="application/json", status=status,
    )


async def _get_wf_store(request):
    """获取或创建 WorkflowStore。"""
    if "wf_store" not in request.app:
        from workflow.store import WorkflowStore
        engine = request.app["engine"]
        store = WorkflowStore(str(engine.root_dir / "data" / "workflows.db"))
        await store.ensure_tables()
        request.app["wf_store"] = store
    return request.app["wf_store"]


async def _get_wf_engine(request):
    """获取或创建 WorkflowEngine。"""
    if "wf_engine" not in request.app:
        from workflow.engine import WorkflowEngine
        request.app["wf_engine"] = WorkflowEngine()
    return request.app["wf_engine"]


async def handle_workflow_list(request: web.Request) -> web.Response:
    """GET /api/v1/workflows"""
    store = await _get_wf_store(request)
    org_id = request.query.get("org_id", "")
    position_id = request.query.get("position_id", "")
    workflows = await store.list_workflows(org_id=org_id, position_id=position_id)
    return _json({"workflows": workflows})


async def handle_workflow_get(request: web.Request) -> web.Response:
    """GET /api/v1/workflows/{workflow_id}"""
    store = await _get_wf_store(request)
    wf_id = request.match_info["workflow_id"]
    wf = await store.get_workflow(wf_id)
    if not wf:
        return _json({"error": "工作流不存在"}, status=404)
    return _json({
        "id": wf.id, "name": wf.name, "description": wf.description,
        "nodes": [{"id": n.id, "type": n.type, "label": n.label, "config": n.config} for n in wf.nodes],
        "edges": wf.edges, "trigger": wf.trigger, "version": wf.version,
    })


async def handle_workflow_create(request: web.Request) -> web.Response:
    """POST/PUT /api/v1/workflows — 创建或更新"""
    store = await _get_wf_store(request)
    body = await request.json()
    url_id = request.match_info.get("workflow_id", "")

    wf = WorkflowDefinition(
        id=url_id or body.get("id", uuid4().hex[:12]),
        name=body.get("name", "未命名工作流"),
        description=body.get("description", ""),
        org_id=body.get("org_id", ""),
        position_id=body.get("position_id", ""),
        nodes=[WorkflowNode(**n) for n in body.get("nodes", [])],
        edges=body.get("edges", []),
        trigger=body.get("trigger", {}),
        variables=body.get("variables", {}),
    )
    await store.save_workflow(wf)
    return _json({"id": wf.id, "status": "created"})


async def handle_workflow_delete(request: web.Request) -> web.Response:
    """DELETE /api/v1/workflows/{workflow_id}"""
    store = await _get_wf_store(request)
    wf_id = request.match_info["workflow_id"]
    await store.delete_workflow(wf_id)
    return _json({"status": "deleted"})


async def handle_workflow_execute(request: web.Request) -> web.Response:
    """POST /api/v1/workflows/{workflow_id}/execute"""
    store = await _get_wf_store(request)
    wf_engine = await _get_wf_engine(request)
    engine = request.app["engine"]

    wf_id = request.match_info["workflow_id"]
    wf = await store.get_workflow(wf_id)
    if not wf:
        return _json({"error": "工作流不存在"}, status=404)

    body = await request.json() if request.can_read_body else {}
    trigger_data = body.get("trigger_data", {})

    user = request.get("user") or {}
    uid = user.get("sub", "") if isinstance(user, dict) else ""
    ctx = {"llm": engine._llm, "gateway": request.app.get("gateway"), "user_id": uid}
    execution = await wf_engine.run(wf, trigger_data=trigger_data, context=ctx)

    # 持久化执行记录
    node_results_dict = {
        nid: {"status": nr.status, "output": nr.output, "error": nr.error, "duration": nr.duration}
        for nid, nr in execution.node_results.items()
    }
    await store.save_execution(
        exec_id=execution.id, workflow_id=wf_id, status=execution.status,
        node_results=node_results_dict, variables=execution.variables,
        started_at=execution.started_at, completed_at=execution.completed_at,
        error=execution.error,
    )

    return _json({
        "execution_id": execution.id,
        "status": execution.status,
        "duration": execution.completed_at - execution.started_at,
        "node_results": node_results_dict,
    })


async def handle_workflow_executions(request: web.Request) -> web.Response:
    """GET /api/v1/workflows/{workflow_id}/executions"""
    store = await _get_wf_store(request)
    wf_id = request.match_info["workflow_id"]
    limit = int(request.query.get("limit", "20"))
    executions = await store.get_executions(wf_id, limit=limit)
    return _json({"executions": executions})


async def _get_trigger_manager(request):
    """获取或创建 TriggerManager。"""
    if "trigger_manager" not in request.app:
        from workflow.trigger import TriggerManager
        store = await _get_wf_store(request)
        wf_engine = await _get_wf_engine(request)
        engine = request.app["engine"]
        tm = TriggerManager(store, wf_engine, llm_client=engine._llm)
        await tm.load_triggers()
        request.app["trigger_manager"] = tm
    return request.app["trigger_manager"]


async def handle_webhook(request: web.Request) -> web.Response:
    """POST /api/v1/webhook/{trigger_id} — Webhook 触发入口"""
    trigger_id = request.match_info["trigger_id"]
    body = await request.json() if request.can_read_body else {}
    tm = await _get_trigger_manager(request)
    ctx = {"llm": request.app["engine"]._llm}
    result = await tm.handle_webhook(trigger_id, body, context=ctx)
    return _json(result, status=200 if "error" not in result else 404)


async def handle_trigger_list(request: web.Request) -> web.Response:
    """GET /api/v1/triggers — 列出所有触发器"""
    tm = await _get_trigger_manager(request)
    return _json({"webhooks": tm.get_webhook_ids(), "chat_triggers": tm.get_chat_triggers()})


async def handle_test_node(request: web.Request) -> web.Response:
    """POST /api/v1/workflow-engine/test-node — 单节点测试"""
    engine = request.app["engine"]
    body = await request.json()
    node_type = body.get("type", "")
    config = body.get("parameters", body.get("config", {}))
    input_data = body.get("input", {})

    if not node_type or not engine.wf_engine:
        return _json({"error": "节点类型不能为空"}, status=400)

    executor = engine.wf_engine._registry.get_executor(node_type)
    if not executor:
        return _json({"error": f"未知节点类型: {node_type}"}, status=400)

    from workflow.types import WorkflowNode as WFNode
    import time as _time
    test_node = WFNode(id="test", type=node_type, config=config)
    ctx = {"llm": engine._llm, "_last_output": input_data, "_node_outputs": {}}
    start = _time.time()
    try:
        result = await executor(test_node, body.get("variables", {}), ctx)
        result.duration = _time.time() - start
        return _json({"status": result.status, "output": result.output, "error": result.error, "duration": round(result.duration, 3)})
    except Exception as e:
        return _json({"status": "failed", "error": str(e), "duration": round(_time.time() - start, 3)})


def register(app: web.Application) -> None:
    app.router.add_get("/api/v1/workflows", handle_workflow_list)
    app.router.add_get("/api/v1/workflows/{workflow_id}", handle_workflow_get)
    app.router.add_post("/api/v1/workflows", handle_workflow_create)
    app.router.add_put("/api/v1/workflows/{workflow_id}", handle_workflow_create)  # upsert
    app.router.add_delete("/api/v1/workflows/{workflow_id}", handle_workflow_delete)
    app.router.add_post("/api/v1/workflows/{workflow_id}/execute", handle_workflow_execute)
    app.router.add_get("/api/v1/workflows/{workflow_id}/executions", handle_workflow_executions)
    app.router.add_post("/api/v1/webhook/{trigger_id}", handle_webhook)
    app.router.add_get("/api/v1/triggers", handle_trigger_list)
    app.router.add_post("/api/v1/workflow-engine/test-node", handle_test_node)
