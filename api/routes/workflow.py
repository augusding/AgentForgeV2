"""
AgentForge V2 — 工作流路由

工作流 CRUD + 执行 + 触发器管理。
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
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
    """获取 WorkflowStore：优先使用 ForgeEngine 已初始化的实例。"""
    forge = request.app.get("engine")
    if forge and forge.wf_store:
        return forge.wf_store
    if "wf_store" not in request.app:
        from workflow.store import WorkflowStore
        store = WorkflowStore(str(forge.root_dir / "data" / "workflows.db") if forge else "data/workflows.db")
        await store.ensure_tables()
        request.app["wf_store"] = store
    return request.app["wf_store"]


async def _get_wf_engine(request):
    """获取 WorkflowEngine：优先使用 ForgeEngine 已初始化的实例（含完整节点注册）。"""
    forge = request.app.get("engine")
    if forge and forge.wf_engine:
        return forge.wf_engine
    if "wf_engine" not in request.app:
        from workflow.engine import WorkflowEngine
        from workflow.registry import NodeRegistry
        from workflow.nodes import register_all_nodes
        registry = NodeRegistry()
        register_all_nodes(registry)
        request.app["wf_engine"] = WorkflowEngine(registry=registry)
    return request.app["wf_engine"]


def _get_org_id(request) -> str:
    user = request.get("user") or {}
    return user.get("org_id", "") if isinstance(user, dict) else ""


async def handle_workflow_stats(request: web.Request) -> web.Response:
    """GET /api/v1/workflows/stats?days=7"""
    store = await _get_wf_store(request)
    days = int(request.query.get("days", "7"))
    cutoff = time.time() - days * 86400
    try:
        import aiosqlite
        async with store._db() as db:
            db.row_factory = aiosqlite.Row
            total = (await (await db.execute("SELECT COUNT(*) as c FROM workflow_executions WHERE started_at>?", (cutoff,))).fetchone())["c"]
            success = (await (await db.execute("SELECT COUNT(*) as c FROM workflow_executions WHERE status='completed' AND started_at>?", (cutoff,))).fetchone())["c"]
            failed = (await (await db.execute("SELECT COUNT(*) as c FROM workflow_executions WHERE status IN ('failed','timeout') AND started_at>?", (cutoff,))).fetchone())["c"]
            avg_row = await (await db.execute("SELECT AVG(completed_at-started_at) as a FROM workflow_executions WHERE status='completed' AND completed_at>0 AND started_at>?", (cutoff,))).fetchone()
            avg_dur = round(avg_row["a"] or 0, 2)
            cur = await db.execute("SELECT date(started_at,'unixepoch','localtime') as day, COUNT(*) as total, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as success FROM workflow_executions WHERE started_at>? GROUP BY day ORDER BY day", (cutoff,))
            daily = [dict(r) for r in await cur.fetchall()]
        return _json({"days": days, "total_executions": total, "success": success, "failed": failed,
            "success_rate": round(success / max(total, 1) * 100, 1), "avg_duration": avg_dur, "daily": daily})
    except Exception as e:
        return _json({"error": str(e)}, 500)


async def handle_workflow_list(request: web.Request) -> web.Response:
    """GET /api/v1/workflows"""
    store = await _get_wf_store(request)
    org_id = request.query.get("org_id", "") or _get_org_id(request)
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
    stop_at = body.get("stop_at_node", "")

    user = request.get("user") or {}
    uid = user.get("sub", "") if isinstance(user, dict) else ""
    ctx = {"llm": engine._llm, "gateway": request.app.get("gateway"), "user_id": uid,
           "wf_engine": wf_engine, "wf_store": store}
    # 注入岗位 context
    if wf.position_id:
        try:
            for b in engine._bundles.values():
                pos = b.positions.get(wf.position_id)
                if pos:
                    if pos.context: ctx["position_context"] = pos.context
                    ctx["position"] = pos
                    break
        except Exception: pass
    execution = await wf_engine.run(wf, trigger_data=trigger_data, context=ctx, stop_at_node=stop_at)

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


async def handle_workflow_execute_stream(request: web.Request) -> web.StreamResponse:
    """POST /api/v1/workflows/{workflow_id}/execute/stream — SSE 流式执行"""
    store = await _get_wf_store(request)
    wf_engine = await _get_wf_engine(request)
    engine = request.app["engine"]
    wf_id = request.match_info["workflow_id"]
    wf = await store.get_workflow(wf_id)
    if not wf:
        return web.Response(status=404, text="工作流不存在")
    body = await request.json() if request.can_read_body else {}
    user = request.get("user") or {}
    uid = user.get("sub", "") if isinstance(user, dict) else ""
    resp = web.StreamResponse(headers={"Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*"})
    await resp.prepare(request)

    async def sse(event: str, data: dict):
        try: await resp.write(f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n".encode())
        except Exception: pass

    event_queue: asyncio.Queue = asyncio.Queue()
    class _SSEGw:
        async def push_to_user(self, uid, data): await event_queue.put(data)

    ctx = {"llm": engine._llm, "gateway": _SSEGw(), "user_id": uid,
           "wf_engine": wf_engine, "wf_store": store}
    if wf.position_id:
        try:
            for b in engine._bundles.values():
                pos = b.positions.get(wf.position_id)
                if pos:
                    if pos.context: ctx["position_context"] = pos.context
                    ctx["position"] = pos; break
        except Exception: pass

    async def _run():
        try:
            ex = await wf_engine.run(wf, trigger_data=body.get("trigger_data", {}), context=ctx)
            await event_queue.put({"type": "__done__", "ex": ex})
        except Exception as e:
            await event_queue.put({"type": "__error__", "error": str(e)})

    task = asyncio.create_task(_run())
    try:
        while True:
            try: ev = await asyncio.wait_for(event_queue.get(), timeout=120)
            except asyncio.TimeoutError: await sse("error", {"message": "超时"}); break
            et = ev.get("type", "")
            if et == "__done__":
                ex = ev["ex"]
                nrd = {nid: {"status": nr.status, "output": nr.output, "error": nr.error, "duration": nr.duration}
                       for nid, nr in ex.node_results.items()}
                await store.save_execution(exec_id=ex.id, workflow_id=wf_id, status=ex.status,
                    node_results=nrd, variables=ex.variables, started_at=ex.started_at,
                    completed_at=ex.completed_at, error=ex.error)
                await sse("done", {"execution_id": ex.id, "status": ex.status,
                    "duration": ex.completed_at - ex.started_at, "node_results": nrd})
                break
            elif et == "__error__":
                await sse("error", {"message": ev.get("error", "")}); break
            elif et == "workflow_node_status":
                ns = ev.get("status", "")
                if ns == "running": await sse("node_start", {"node_id": ev.get("node_id")})
                elif ns in ("completed", "skipped"): await sse("node_done", {"node_id": ev.get("node_id"), "status": ns, "duration": ev.get("duration", 0)})
                elif ns == "failed": await sse("node_error", {"node_id": ev.get("node_id"), "error": ev.get("error", "")})
    except ConnectionResetError: pass
    finally: task.cancel()
    return resp


async def handle_workflow_executions(request: web.Request) -> web.Response:
    """GET /api/v1/workflows/{workflow_id}/executions"""
    store = await _get_wf_store(request)
    wf_id = request.match_info["workflow_id"]
    limit = int(request.query.get("limit", "20"))
    executions = await store.get_executions(wf_id, limit=limit)
    return _json({"executions": executions})


async def handle_approval_list(request: web.Request) -> web.Response:
    """GET /api/v1/workflows/approvals"""
    store = await _get_wf_store(request)
    items = await store.list_pending_approvals()
    return _json({"approvals": items, "total": len(items)})


async def handle_approval_action(request: web.Request) -> web.Response:
    """POST /api/v1/workflows/executions/{exec_id}/approve"""
    store = await _get_wf_store(request)
    wf_engine = await _get_wf_engine(request)
    engine = request.app["engine"]
    exec_id = request.match_info["exec_id"]
    body = await request.json()
    approved = bool(body.get("approved", True))
    comment = body.get("comment", "")
    exec_data = await store.get_execution(exec_id)
    if not exec_data: return _json({"error": "执行不存在"}, 404)
    if exec_data.get("status") != "paused": return _json({"error": f"状态非 paused: {exec_data.get('status')}"}, 400)
    wf = await store.get_workflow(exec_data["workflow_id"])
    if not wf: return _json({"error": "工作流不存在"}, 404)
    node_results = exec_data.get("node_results", {})
    paused_nid = ""
    for nid, nr in node_results.items():
        if nr.get("status") == "waiting_approval": paused_nid = nid; break
    if not paused_nid: return _json({"error": "无等待审批节点"}, 400)
    node_results[paused_nid] = {"status": "completed", "output": {"approved": approved, "comment": comment, "_output_index": 0 if approved else 1}, "error": "", "duration": 0}
    user = request.get("user") or {}
    uid = user.get("sub", "") if isinstance(user, dict) else ""
    ctx = {"llm": engine._llm, "gateway": request.app.get("gateway"), "user_id": uid, "wf_engine": wf_engine, "wf_store": store}
    execution = await wf_engine.run(wf, trigger_data=exec_data.get("trigger_data", {}), context=ctx)
    merged = {**node_results}
    merged.update({nid: {"status": nr.status, "output": nr.output, "error": nr.error, "duration": nr.duration} for nid, nr in execution.node_results.items()})
    import time as _t
    await store.update_execution_status(exec_id, execution.status, node_results=merged, variables=execution.variables, error=execution.error, completed_at=execution.completed_at or _t.time())
    return _json({"execution_id": exec_id, "approved": approved, "status": execution.status})


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
    engine = request.app["engine"]
    ctx = {"llm": engine._llm, "wf_engine": engine.wf_engine, "wf_store": engine.wf_store}
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
    app.router.add_post("/api/v1/workflows/{workflow_id}/execute/stream", handle_workflow_execute_stream)
    app.router.add_get("/api/v1/workflows/stats", handle_workflow_stats)
    app.router.add_get("/api/v1/workflows/approvals", handle_approval_list)
    app.router.add_post("/api/v1/workflows/executions/{exec_id}/approve", handle_approval_action)
    app.router.add_get("/api/v1/workflows/{workflow_id}/executions", handle_workflow_executions)
    app.router.add_post("/api/v1/webhook/{trigger_id}", handle_webhook)
    app.router.add_get("/api/v1/triggers", handle_trigger_list)
    app.router.add_post("/api/v1/workflow-engine/test-node", handle_test_node)
