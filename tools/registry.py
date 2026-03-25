"""
AgentForge V2 — 工具注册表

统一管理所有工具的注册、查找、过滤。
工具定义使用 Anthropic tool format。
"""

from __future__ import annotations

import logging
from typing import Any, Callable, Awaitable

logger = logging.getLogger(__name__)

# 工具处理函数签名: (arguments: dict) -> str
ToolHandler = Callable[[dict], Awaitable[str]]


class ToolDefinition:
    """工具定义。"""

    def __init__(
        self,
        name: str,
        description: str,
        input_schema: dict,
        handler: ToolHandler,
        category: str = "general",
    ):
        self.name = name
        self.description = description
        self.input_schema = input_schema
        self.handler = handler
        self.category = category

    def to_llm_format(self) -> dict:
        """转换为 Anthropic tool format。"""
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema,
        }


class ToolRegistry:
    """
    工具注册表。

    用法:
        registry = ToolRegistry()
        registry.register(tool_def)
        tools = registry.get_tools_for_position(["web_search", "calculator"])
    """

    def __init__(self):
        self._tools: dict[str, ToolDefinition] = {}

    def register(self, tool: ToolDefinition) -> None:
        """注册工具。"""
        if tool.name in self._tools:
            logger.warning("工具重复注册，覆盖: %s", tool.name)
        self._tools[tool.name] = tool
        logger.debug("工具注册: %s (%s)", tool.name, tool.category)

    def get(self, name: str) -> ToolDefinition | None:
        """按名称获取工具。"""
        return self._tools.get(name)

    def get_handler(self, name: str) -> ToolHandler | None:
        """获取工具的处理函数。"""
        tool = self._tools.get(name)
        return tool.handler if tool else None

    def get_tools_for_position(self, tool_names: list[str]) -> list[dict]:
        """获取指定岗位的工具列表 (LLM format)。"""
        result = []
        for name in tool_names:
            tool = self._tools.get(name)
            if tool:
                result.append(tool.to_llm_format())
            else:
                logger.warning("岗位引用的工具不存在: %s", name)
        return result

    def get_all_tool_names(self) -> list[str]:
        """获取所有已注册的工具名。"""
        return list(self._tools.keys())

    def get_all_tools_for_llm(self) -> list[dict]:
        """获取所有工具的 LLM format。"""
        return [t.to_llm_format() for t in self._tools.values()]

    @property
    def count(self) -> int:
        return len(self._tools)
