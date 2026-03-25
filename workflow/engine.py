"""
AgentForge V2 — WorkflowEngine: DAG 工作流执行器

拓扑排序 → 逐节点执行 → 条件分支 → 并行支持。
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict, deque
from typing import Any, Callable, Awaitable
from uuid import uuid4

from workflow.types import (
    NodeResult, WorkflowDefinition, WorkflowExecution, WorkflowNode,
)

logger = logging.getLogger(__name__)

# 节点执行器签名: (node, variables, context) -> NodeResult
NodeExecutor = Callable[[WorkflowNode, dict, dict], Awaitable[NodeResult]]


class WorkflowEngine:
    """
    DAG 工作流执行器。

    用法:
        engine = WorkflowEngine()
        engine.register_executor("ai", ai_node_executor)
        execution = await engine.run(workflow_def, trigger_data)
    """

    def __init__(self):
        self._executors: dict[str, NodeExecutor] = {}
        self._register_defaults()

    def register_executor(self, node_type: str, executor: NodeExecutor) -> None:
        """注册节点类型执行器。"""
        self._executors[node_type] = executor

    async def run(
        self,
        workflow: WorkflowDefinition,
        trigger_data: dict | None = None,
        context: dict | None = None,
    ) -> WorkflowExecution:
        """执行工作流。"""
        execution = WorkflowExecution(
            id=uuid4().hex[:12],
            workflow_id=workflow.id,
            trigger_data=trigger_data or {},
            variables={**workflow.variables, **(trigger_data or {})},
            started_at=time.time(),
        )

        ctx = context or {}
        node_map = {n.id: n for n in workflow.nodes}

        # 构建 DAG：入度表 + 邻接表
        in_degree: dict[str, int] = defaultdict(int)
        adjacency: dict[str, list[str]] = defaultdict(list)

        for node in workflow.nodes:
            if node.id not in in_degree:
                in_degree[node.id] = 0

        for edge in workflow.edges:
            src, tgt = edge["source"], edge["target"]
            adjacency[src].append(tgt)
            in_degree[tgt] += 1

        # 拓扑排序 + 执行
        queue: deque[str] = deque()
        for nid, deg in in_degree.items():
            if deg == 0:
                queue.append(nid)

        try:
            while queue:
                # 可并行执行的节点
                batch = list(queue)
                queue.clear()

                tasks = []
                for nid in batch:
                    node = node_map.get(nid)
                    if not node:
                        continue
                    tasks.append(self._execute_node(node, execution, ctx))

                results = await asyncio.gather(*tasks, return_exceptions=True)

                for nid, result in zip(batch, results):
                    if isinstance(result, Exception):
                        execution.node_results[nid] = NodeResult(
                            node_id=nid, status="failed", error=str(result),
                        )
                        logger.error("节点执行异常: %s — %s", nid, result)
                    else:
                        execution.node_results[nid] = result

                    # 更新变量
                    nr = execution.node_results.get(nid)
                    if nr and nr.output and isinstance(nr.output, dict):
                        execution.variables.update(nr.output)

                    # 释放下游节点
                    if nr and nr.status in ("completed", "skipped"):
                        for next_id in adjacency.get(nid, []):
                            in_degree[next_id] -= 1
                            if in_degree[next_id] <= 0:
                                # 条件节点：检查是否满足条件
                                edge_info = self._find_edge(workflow.edges, nid, next_id)
                                if self._evaluate_edge(edge_info, execution.variables):
                                    queue.append(next_id)

            execution.status = "completed"

        except Exception as e:
            execution.status = "failed"
            execution.error = str(e)
            logger.error("工作流执行失败: %s — %s", workflow.id, e)

        execution.completed_at = time.time()
        logger.info(
            "工作流完成: wf=%s exec=%s status=%s nodes=%d duration=%.1fs",
            workflow.id, execution.id, execution.status,
            len(execution.node_results),
            execution.completed_at - execution.started_at,
        )
        return execution

    async def _execute_node(
        self, node: WorkflowNode, execution: WorkflowExecution, ctx: dict,
    ) -> NodeResult:
        """执行单个节点。"""
        executor = self._executors.get(node.type)
        if not executor:
            return NodeResult(node_id=node.id, status="failed", error=f"未知节点类型: {node.type}")

        start = time.time()
        try:
            result = await executor(node, execution.variables, ctx)
            result.duration = time.time() - start
            logger.debug("节点完成: %s (%s) → %s", node.id, node.type, result.status)
            return result
        except Exception as e:
            return NodeResult(
                node_id=node.id, status="failed",
                error=str(e), duration=time.time() - start,
            )

    @staticmethod
    def _find_edge(edges: list[dict], source: str, target: str) -> dict | None:
        for e in edges:
            if e["source"] == source and e["target"] == target:
                return e
        return None

    @staticmethod
    def _evaluate_edge(edge: dict | None, variables: dict) -> bool:
        """评估边的条件（无条件则通过）。"""
        if not edge or "condition" not in edge:
            return True
        condition = edge["condition"]
        try:
            return bool(eval(condition, {"__builtins__": {}}, variables))
        except Exception:
            return True

    # ── 默认节点执行器 ────────────────────────────────────

    def _register_defaults(self) -> None:
        self.register_executor("ai", _default_ai_executor)
        self.register_executor("code", _default_code_executor)
        self.register_executor("condition", _default_condition_executor)
        self.register_executor("notification", _default_notification_executor)


# ── 内置节点执行器 ────────────────────────────────────────

async def _default_ai_executor(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    """AI 节点：调用 LLM 处理。"""
    prompt = node.config.get("prompt", "")
    # 变量替换
    for key, val in variables.items():
        prompt = prompt.replace(f"{{{{{key}}}}}", str(val))

    llm = ctx.get("llm")
    if not llm:
        return NodeResult(node_id=node.id, status="failed", error="LLM 客户端不可用")

    try:
        resp = await llm.chat(system="你是工作流 AI 节点。", messages=[{"role": "user", "content": prompt}])
        return NodeResult(node_id=node.id, status="completed", output={"ai_result": resp.content})
    except Exception as e:
        return NodeResult(node_id=node.id, status="failed", error=str(e))


async def _default_code_executor(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    """代码节点：执行 Python 代码片段。"""
    code = node.config.get("code", "")
    try:
        local_vars = {**variables}
        exec(code, {"__builtins__": __builtins__}, local_vars)
        result = local_vars.get("result", {})
        return NodeResult(node_id=node.id, status="completed", output=result if isinstance(result, dict) else {"result": result})
    except Exception as e:
        return NodeResult(node_id=node.id, status="failed", error=str(e))


async def _default_condition_executor(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    """条件节点：评估条件表达式。"""
    expression = node.config.get("expression", "True")
    try:
        result = bool(eval(expression, {"__builtins__": {}}, variables))
        return NodeResult(node_id=node.id, status="completed", output={"condition_result": result})
    except Exception as e:
        return NodeResult(node_id=node.id, status="failed", error=str(e))


async def _default_notification_executor(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    """通知节点：记录通知（实际发送由外部系统处理）。"""
    message = node.config.get("message", "")
    for key, val in variables.items():
        message = message.replace(f"{{{{{key}}}}}", str(val))

    logger.info("工作流通知: %s", message)
    return NodeResult(node_id=node.id, status="completed", output={"notification_sent": message})
