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

    def __init__(self, registry: NodeRegistry | None = None):
        self._registry = registry or NodeRegistry()

    async def run(
        self, workflow: WorkflowDefinition,
        trigger_data: dict | None = None, context: dict | None = None,
    ) -> WorkflowExecution:
        """执行工作流。"""
        execution = WorkflowExecution(
            id=uuid4().hex[:12], workflow_id=workflow.id,
            trigger_data=trigger_data or {},
            variables={**workflow.variables, **(trigger_data or {})},
            started_at=time.time(),
        )
        ctx = context or {}
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

            execution.status = "completed"
        except Exception as e:
            execution.status = "failed"; execution.error = str(e)

        execution.completed_at = time.time()
        logger.info("工作流完成: wf=%s status=%s nodes=%d %.1fs",
                     workflow.id, execution.status, len(execution.node_results),
                     execution.completed_at - execution.started_at)
        return execution

    async def _execute_node(self, node: WorkflowNode, execution: WorkflowExecution,
                            edges: list[dict], ctx: dict) -> NodeResult:
        """执行单个节点：表达式解析 → 执行器调用。"""
        executor = self._registry.get_executor(node.type)
        if not executor:
            return NodeResult(node_id=node.id, status="failed", error=f"未知节点类型: {node.type}")

        upstream = _get_upstream_output(node.id, edges, execution)
        node_outputs = {nid: nr.output for nid, nr in execution.node_results.items() if nr.output}

        enriched_ctx = {**ctx, "_last_output": upstream, "_node_outputs": node_outputs}

        start = time.time()
        try:
            expr_ctx = ExprContext(
                input_data=upstream, node_outputs=node_outputs,
                variables=execution.variables, parameters=node.config)
            resolved_node = WorkflowNode(
                id=node.id, type=node.type, label=node.label,
                config=expr_ctx.resolve_dict(node.config),
                inputs=node.inputs, outputs=node.outputs,
                next_nodes=node.next_nodes, position=node.position)

            result = await executor(resolved_node, execution.variables, enriched_ctx)
            result.duration = time.time() - start
            return result
        except Exception as e:
            return NodeResult(node_id=node.id, status="failed", error=str(e), duration=time.time() - start)


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
