"""
AgentForge V2 — 工作流数据结构

工作流的定义、节点、执行状态等 dataclass。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class WorkflowNode:
    """工作流节点。"""
    id: str
    type: str                               # "ai" | "code" | "condition" | "http" | "transform" | "approval" | "notification"
    label: str = ""
    config: dict = field(default_factory=dict)
    inputs: dict = field(default_factory=dict)
    outputs: dict = field(default_factory=dict)
    next_nodes: list[str] = field(default_factory=list)  # 后续节点 ID
    position: dict = field(default_factory=dict)         # UI 位置 {x, y}
    disabled: bool = False
    retry_count: int = 0        # 失败重试次数（0=不重试）
    retry_delay: float = 2.0   # 重试间隔秒数


@dataclass
class WorkflowDefinition:
    """工作流定义。"""
    id: str
    name: str
    description: str = ""
    org_id: str = ""
    position_id: str = ""
    nodes: list[WorkflowNode] = field(default_factory=list)
    edges: list[dict] = field(default_factory=list)       # [{source, target, condition?}]
    trigger: dict = field(default_factory=dict)           # {type: "cron"|"webhook"|"manual", config: {...}}
    variables: dict = field(default_factory=dict)         # 全局变量
    version: int = 1
    enabled: bool = True
    timeout_seconds: int = 300


@dataclass
class NodeResult:
    """节点执行结果。"""
    node_id: str
    status: str = "completed"   # "completed" | "failed" | "skipped" | "waiting_approval"
    output: Any = None
    error: str = ""
    duration: float = 0.0


@dataclass
class WorkflowExecution:
    """工作流执行实例。"""
    id: str
    workflow_id: str
    status: str = "running"     # "running" | "completed" | "failed" | "paused" | "timeout" | "interrupted"
    trigger_type: str = "manual"
    trigger_data: dict = field(default_factory=dict)
    node_results: dict[str, NodeResult] = field(default_factory=dict)
    variables: dict = field(default_factory=dict)
    started_at: float = 0.0
    completed_at: float = 0.0
    error: str = ""
    paused_at_node: str = ""
