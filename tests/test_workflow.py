"""
AgentForge V2 — 工作流引擎测试
"""

import asyncio
import os
import pytest
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from workflow.engine import WorkflowEngine
from workflow.registry import NodeRegistry
from workflow.nodes import register_all_nodes
from workflow.types import WorkflowDefinition, WorkflowNode, NodeResult
from workflow.store import WorkflowStore


# ── WorkflowEngine 测试 ───────────────────────────────────

class TestWorkflowEngine:

    def setup_method(self):
        registry = NodeRegistry()
        register_all_nodes(registry)
        self.engine = WorkflowEngine(registry=registry)

    @pytest.mark.asyncio
    async def test_simple_linear(self):
        """线性工作流：A → B → C"""
        wf = WorkflowDefinition(
            id="test-linear",
            name="线性测试",
            nodes=[
                WorkflowNode(id="a", type="code", config={"code": "result = {'step': 'a'}"}),
                WorkflowNode(id="b", type="code", config={"code": "result = {'step': 'b'}"}),
                WorkflowNode(id="c", type="code", config={"code": "result = {'step': 'c'}"}),
            ],
            edges=[
                {"source": "a", "target": "b"},
                {"source": "b", "target": "c"},
            ],
        )
        execution = await self.engine.run(wf)
        assert execution.status == "completed"
        assert len(execution.node_results) == 3
        assert execution.node_results["a"].status == "completed"
        assert execution.node_results["c"].status == "completed"

    @pytest.mark.asyncio
    async def test_parallel(self):
        """并行工作流：A → (B, C) → D"""
        wf = WorkflowDefinition(
            id="test-parallel",
            name="并行测试",
            nodes=[
                WorkflowNode(id="a", type="code", config={"code": "result = {'from': 'a'}"}),
                WorkflowNode(id="b", type="code", config={"code": "result = {'from': 'b'}"}),
                WorkflowNode(id="c", type="code", config={"code": "result = {'from': 'c'}"}),
                WorkflowNode(id="d", type="code", config={"code": "result = {'from': 'd'}"}),
            ],
            edges=[
                {"source": "a", "target": "b"},
                {"source": "a", "target": "c"},
                {"source": "b", "target": "d"},
                {"source": "c", "target": "d"},
            ],
        )
        execution = await self.engine.run(wf)
        assert execution.status == "completed"
        assert len(execution.node_results) == 4

    @pytest.mark.asyncio
    async def test_condition_node(self):
        """条件节点。"""
        wf = WorkflowDefinition(
            id="test-cond",
            name="条件测试",
            variables={"threshold": 10},
            nodes=[
                WorkflowNode(id="check", type="condition", config={"expression": "threshold > 5"}),
            ],
            edges=[],
        )
        execution = await self.engine.run(wf)
        assert execution.status == "completed"
        assert execution.node_results["check"].output == {"condition_result": True}

    @pytest.mark.asyncio
    async def test_variables_propagation(self):
        """变量在节点间传递。"""
        wf = WorkflowDefinition(
            id="test-vars",
            name="变量传递",
            nodes=[
                WorkflowNode(id="set", type="code", config={"code": "result = {'x': 42}"}),
                WorkflowNode(id="use", type="code", config={"code": "result = {'doubled': x * 2}"}),
            ],
            edges=[{"source": "set", "target": "use"}],
        )
        execution = await self.engine.run(wf)
        assert execution.status == "completed"
        assert execution.variables.get("doubled") == 84

    @pytest.mark.asyncio
    async def test_error_handling(self):
        """节点执行失败。"""
        wf = WorkflowDefinition(
            id="test-err",
            name="错误测试",
            nodes=[
                WorkflowNode(id="fail", type="code", config={"code": "raise ValueError('test error')"}),
            ],
            edges=[],
        )
        execution = await self.engine.run(wf)
        assert execution.node_results["fail"].status == "failed"
        assert "test error" in execution.node_results["fail"].error

    @pytest.mark.asyncio
    async def test_notification_node(self):
        wf = WorkflowDefinition(
            id="test-notify",
            name="通知测试",
            variables={"name": "Rocky"},
            nodes=[
                WorkflowNode(id="notify", type="notification", config={"message": "Hello {{name}}!"}),
            ],
            edges=[],
        )
        execution = await self.engine.run(wf)
        assert execution.status == "completed"


# ── WorkflowStore 测试 ────────────────────────────────────

class TestWorkflowStore:

    @pytest.fixture
    def tmp_db(self):
        fd, path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        yield path
        os.unlink(path)

    @pytest.mark.asyncio
    async def test_crud(self, tmp_db):
        store = WorkflowStore(tmp_db)
        wf = WorkflowDefinition(
            id="wf1", name="测试工作流",
            nodes=[WorkflowNode(id="n1", type="code", label="步骤1")],
            edges=[],
        )
        await store.save_workflow(wf)

        # 读取
        loaded = await store.get_workflow("wf1")
        assert loaded is not None
        assert loaded.name == "测试工作流"
        assert len(loaded.nodes) == 1

        # 列表
        wf_list = await store.list_workflows()
        assert len(wf_list) == 1

        # 删除
        await store.delete_workflow("wf1")
        assert await store.get_workflow("wf1") is None

    @pytest.mark.asyncio
    async def test_execution_record(self, tmp_db):
        store = WorkflowStore(tmp_db)
        wf = WorkflowDefinition(id="wf1", name="test")
        await store.save_workflow(wf)

        await store.save_execution(
            exec_id="e1", workflow_id="wf1", status="completed",
            node_results={"n1": {"status": "completed"}},
            variables={"x": 1}, started_at=1000, completed_at=1005,
        )

        execs = await store.get_executions("wf1")
        assert len(execs) == 1
        assert execs[0]["status"] == "completed"
