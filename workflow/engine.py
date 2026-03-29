"""
AgentForge V2 — WorkflowEngine: DAG 工作流执行器

拓扑排序 → 逐节点执行 → 条件分支 → 并行支持 → 表达式引擎。
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict, deque
from typing import Any
from uuid import uuid4

from workflow.expression import ExprContext
from workflow.registry import NodeRegistry
from workflow.types import (
    NodeResult, WorkflowDefinition, WorkflowExecution, WorkflowNode,
)

logger = logging.getLogger(__name__)


class WorkflowEngine:
    """
    DAG 工作流执行器。

    用法:
        engine = WorkflowEngine(registry=node_registry)
        execution = await engine.run(workflow_def, trigger_data)
    """

    def __init__(self, registry: NodeRegistry | None = None, store=None, max_concurrency: int = 10):
        self._registry = registry or NodeRegistry()
        self._store = store
        self._max_concurrency = max_concurrency
        self._node_semaphore = asyncio.Semaphore(max_concurrency)

    async def run(self, workflow: WorkflowDefinition, trigger_data: dict | None = None,
                  context: dict | None = None, stop_at_node: str = "") -> WorkflowExecution:
        """执行工作流（含超时控制）。"""
        timeout = getattr(workflow, 'timeout_seconds', 300) or 300
        if timeout > 0:
            try:
                return await asyncio.wait_for(self._run_internal(workflow, trigger_data, context, stop_at_node), timeout=timeout)
            except asyncio.TimeoutError:
                ex = WorkflowExecution(id=uuid4().hex[:12], workflow_id=workflow.id, status="timeout",
                    error=f"工作流超时({timeout}s)", started_at=time.time(), completed_at=time.time())
                if self._store:
                    try: await self._store.save_execution(exec_id=ex.id, workflow_id=workflow.id, status="timeout",
                        node_results={}, variables={}, error=ex.error, started_at=ex.started_at, completed_at=ex.completed_at)
                    except Exception: pass
                logger.error("工作流超时: wf=%s timeout=%ds", workflow.id, timeout)
                return ex
        return await self._run_internal(workflow, trigger_data, context, stop_at_node)

    async def _run_internal(self, workflow: WorkflowDefinition, trigger_data: dict | None = None,
                             context: dict | None = None, stop_at_node: str = "") -> WorkflowExecution:
        exec_id = uuid4().hex[:12]
        execution = WorkflowExecution(
            id=exec_id, workflow_id=workflow.id,
            trigger_data=trigger_data or {},
            variables={**workflow.variables, **(trigger_data or {}),
                       "_workflow_id": workflow.id, "_execution_id": exec_id},
            started_at=time.time(),
        )
        if self._store:
            try: await self._store.save_execution(exec_id=exec_id, workflow_id=workflow.id, status="running",
                    node_results={}, variables=execution.variables, started_at=execution.started_at)
            except Exception as e: logger.warning("持久化失败(start): %s", e)
        ctx = context or {}
        ctx.setdefault("wf_engine", self)
        ctx.setdefault("wf_store", self._store)
        node_map = {n.id: n for n in workflow.nodes}
        edges = workflow.edges

        # DAG: in-degree + adjacency
        in_degree: dict[str, int] = defaultdict(int)
        adjacency: dict[str, list[str]] = defaultdict(list)
        for node in workflow.nodes:
            if node.id not in in_degree:
                in_degree[node.id] = 0
        for edge in edges:
            adjacency[edge["source"]].append(edge["target"])
            in_degree[edge["target"]] += 1

        queue: deque[str] = deque(nid for nid, deg in in_degree.items() if deg == 0)

        try:
            while queue:
                batch = list(queue); queue.clear()
                tasks = [self._execute_node(node_map[nid], execution, edges, ctx)
                         for nid in batch if nid in node_map]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                for nid, result in zip(batch, results):
                    if isinstance(result, Exception):
                        execution.node_results[nid] = NodeResult(node_id=nid, status="failed", error=str(result))
                    else:
                        execution.node_results[nid] = result

                    nr = execution.node_results.get(nid)
                    if nr and nr.output and isinstance(nr.output, dict):
                        execution.variables.update(nr.output)

                    # 构建按 label+id 索引的 node outputs（支持 $node["节点名"] 引用）
                    label_outputs: dict = {}
                    for n in workflow.nodes:
                        r = execution.node_results.get(n.id)
                        if r and r.output:
                            label_outputs[n.id] = r.output
                            if n.label:
                                label_outputs[n.label] = r.output
                    ctx["_node_outputs"] = label_outputs

                    _push_node_status(ctx, execution, nid, nr)
                    if self._store:
                        try:
                            _nrd = {k: {"status": v.status, "output": v.output, "error": v.error, "duration": v.duration} for k, v in execution.node_results.items()}
                            await self._store.update_execution_status(execution.id, "running", node_results=_nrd, variables=execution.variables)
                        except Exception: pass
                    # 错误路由
                    if nr and nr.status == "failed":
                        nd = node_map.get(nid)
                        oe = getattr(nd, 'on_error', 'stop') if nd else 'stop'
                        if oe == "error_output":
                            for nxt in adjacency.get(nid, []):
                                ei = _find_edge(edges, nid, nxt)
                                if ei and ei.get("sourceOutput") == -1:
                                    execution.node_results[nid] = NodeResult(node_id=nid, status="failed", error=nr.error,
                                        output={"_error": True, "error_message": nr.error, "error_node": nid}, duration=nr.duration)
                                    in_degree[nxt] -= 1
                                    if in_degree[nxt] <= 0: queue.append(nxt)
                            continue
                        elif oe == "continue":
                            for nxt in adjacency.get(nid, []):
                                ei = _find_edge(edges, nid, nxt)
                                if ei and ei.get("sourceOutput", 0) != -1:
                                    in_degree[nxt] -= 1
                                    if in_degree[nxt] <= 0: queue.append(nxt)
                            continue
                    # 审批节点挂起
                    if nr and nr.status == "waiting_approval":
                        execution.status = "paused"; execution.paused_at_node = nid
                        execution.completed_at = time.time()
                        _push_execution_done(ctx, execution)
                        logger.info("工作流暂停等待审批: wf=%s node=%s", workflow.id, nid)
                        return execution
                    if nr and nr.status in ("completed", "skipped"):
                        out_idx = nr.output.get("_output_index") if isinstance(nr.output, dict) else None
                        for next_id in adjacency.get(nid, []):
                            edge_info = _find_edge(edges, nid, next_id)
                            # _output_index 路由：只释放匹配的输出口
                            if out_idx is not None and edge_info:
                                if edge_info.get("sourceOutput", 0) != out_idx:
                                    execution.node_results.setdefault(next_id, NodeResult(node_id=next_id, status="skipped"))
                                    continue
                            in_degree[next_id] -= 1
                            if in_degree[next_id] <= 0:
                                if _evaluate_edge(edge_info, execution.variables):
                                    queue.append(next_id)

                # stop_at_node: 执行到指定节点后停止
                if stop_at_node and nid == stop_at_node:
                    execution.status = "completed"; execution.completed_at = time.time()
                    _push_execution_done(ctx, execution)
                    return execution

            execution.status = "completed"
        except Exception as e:
            execution.status = "failed"; execution.error = str(e)

        execution.completed_at = time.time()
        # 检查是否有失败节点 → 标记工作流失败
        if execution.status == "completed" and any(nr.status == "failed" for nr in execution.node_results.values()):
            if not any(getattr(node_map.get(nid), 'on_error', 'stop') in ('continue', 'error_output')
                       for nid, nr in execution.node_results.items() if nr.status == "failed"):
                execution.status = "failed"
        _push_execution_done(ctx, execution)
        logger.info("工作流完成: wf=%s status=%s nodes=%d %.1fs",
                     workflow.id, execution.status, len(execution.node_results),
                     execution.completed_at - execution.started_at)
        return execution

    async def _execute_node(self, node: WorkflowNode, execution: WorkflowExecution,
                            edges: list[dict], ctx: dict) -> NodeResult:
        if node.disabled:
            return NodeResult(node_id=node.id, status="skipped", output={"skipped_reason": "disabled"})
        async with self._node_semaphore:
            return await self._execute_node_inner(node, execution, edges, ctx)

    async def _execute_node_inner(self, node: WorkflowNode, execution: WorkflowExecution,
                                   edges: list[dict], ctx: dict) -> NodeResult:
        executor = self._registry.get_executor(node.type)
        if not executor:
            return NodeResult(node_id=node.id, status="failed", error=f"未知节点类型: {node.type}")
        upstream = _get_upstream_output(node.id, edges, execution)
        node_outputs = {nid: nr.output for nid, nr in execution.node_results.items() if nr.output}
        enriched_ctx = {**ctx, "_last_output": upstream, "_node_outputs": node_outputs}
        start = time.time()
        try:
            expr_ctx = ExprContext(input_data=upstream, node_outputs=node_outputs,
                                   variables=execution.variables, parameters=node.config)
            resolved = WorkflowNode(id=node.id, type=node.type, label=node.label,
                config=expr_ctx.resolve_dict(node.config), inputs=node.inputs, outputs=node.outputs,
                next_nodes=node.next_nodes, position=node.position,
                retry_count=node.retry_count, retry_delay=node.retry_delay)
        except Exception as e:
            return NodeResult(node_id=node.id, status="failed", error=f"表达式解析失败: {e}", duration=time.time() - start)
        max_attempts = max(1, resolved.retry_count + 1)
        last_result: NodeResult | None = None
        for attempt in range(max_attempts):
            if attempt > 0:
                await asyncio.sleep(resolved.retry_delay)
                logger.info("节点重试 %s attempt=%d/%d", node.id, attempt + 1, max_attempts)
            try:
                result = await executor(resolved, execution.variables, enriched_ctx)
                result.duration = time.time() - start
                if result.status != "failed": return result
                last_result = result
            except Exception as e:
                last_result = NodeResult(node_id=node.id, status="failed", error=str(e), duration=time.time() - start)
        return last_result or NodeResult(node_id=node.id, status="failed", error="执行失败", duration=time.time() - start)

    async def recover_on_startup(self) -> int:
        if not self._store: return 0
        count = 0
        try:
            running = await self._store.list_by_status("running")
            for ex in running:
                await self._store.update_execution_status(ex["id"], "interrupted", error="服务重启中断", completed_at=time.time())
                count += 1; logger.warning("标记中断: %s (wf=%s)", ex["id"], ex.get("workflow_id"))
        except Exception as e: logger.error("恢复检查失败: %s", e)
        return count


def _find_edge(edges: list[dict], source: str, target: str) -> dict | None:
    for e in edges:
        if e["source"] == source and e["target"] == target:
            return e
    return None


def _evaluate_edge(edge: dict | None, variables: dict) -> bool:
    if not edge or "condition" not in edge:
        return True
    try:
        return bool(eval(edge["condition"], {"__builtins__": {}}, variables))
    except Exception:
        return True


def _get_upstream_output(node_id: str, edges: list[dict], execution: WorkflowExecution) -> Any:
    for edge in edges:
        if edge["target"] == node_id:
            nr = execution.node_results.get(edge["source"])
            if nr and nr.output:
                return nr.output
    return {}


def _push_node_status(ctx: dict, execution: WorkflowExecution, nid: str, nr: NodeResult | None) -> None:
    gateway, uid = ctx.get("gateway"), ctx.get("user_id", "")
    if not gateway or not uid:
        return
    try:
        asyncio.get_event_loop().create_task(gateway.push_to_user(uid, {
            "type": "workflow_node_status", "execution_id": execution.id,
            "workflow_id": execution.workflow_id, "node_id": nid,
            "status": nr.status if nr else "failed",
            "error": nr.error if nr else "", "duration": nr.duration if nr else 0,
        }))
    except Exception:
        pass


def _push_execution_done(ctx: dict, execution: WorkflowExecution) -> None:
    gateway, uid = ctx.get("gateway"), ctx.get("user_id", "")
    if not gateway or not uid:
        return
    try:
        asyncio.get_event_loop().create_task(gateway.push_to_user(uid, {
            "type": "workflow_execution_done", "execution_id": execution.id,
            "workflow_id": execution.workflow_id, "status": execution.status,
            "duration": execution.completed_at - execution.started_at,
            "node_count": len(execution.node_results),
        }))
    except Exception:
        pass
