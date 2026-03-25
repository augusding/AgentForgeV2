"""
AgentForge V2 — 工作流节点注册表

管理所有节点类型：元数据（给前端）+ 执行器（给引擎）。
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Awaitable

from workflow.types import WorkflowNode, NodeResult

logger = logging.getLogger(__name__)

NodeExecutor = Callable[[WorkflowNode, dict, dict], Awaitable[NodeResult]]


@dataclass
class NodeTypeInfo:
    """节点类型描述。"""
    name: str
    display_name: str
    description: str = ""
    group: str = "action"
    icon: str = ""
    inputs: int = 1
    outputs: int = 1
    output_names: list[str] = field(default_factory=lambda: ["output"])
    parameters: list[dict] = field(default_factory=list)
    executor: NodeExecutor | None = None

    def to_catalog_dict(self) -> dict:
        return {
            "name": self.name, "displayName": self.display_name,
            "description": self.description, "group": self.group, "icon": self.icon,
            "inputs": self.inputs, "outputs": self.outputs,
            "outputNames": self.output_names, "parameters": self.parameters,
        }


class NodeRegistry:
    """节点类型注册表。"""

    def __init__(self):
        self._types: dict[str, NodeTypeInfo] = {}

    def register(self, info: NodeTypeInfo) -> None:
        self._types[info.name] = info

    def get(self, name: str) -> NodeTypeInfo | None:
        return self._types.get(name)

    def get_executor(self, name: str) -> NodeExecutor | None:
        info = self._types.get(name)
        return info.executor if info else None

    def get_catalog(self) -> list[dict]:
        return [i.to_catalog_dict() for i in self._types.values()]

    @property
    def type_names(self) -> list[str]:
        return list(self._types.keys())

    def __len__(self) -> int:
        return len(self._types)
