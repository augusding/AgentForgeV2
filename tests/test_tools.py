"""
AgentForge V2 — 工具系统测试
"""

import asyncio
import json
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from tools.registry import ToolRegistry, ToolDefinition
from tools.builtin.core_tools import register_all, calculator, datetime_tool


@pytest.fixture
def registry():
    reg = ToolRegistry()
    register_all(reg)
    return reg


def test_register_all(registry):
    assert registry.count >= 7
    assert "calculator" in registry.get_all_tool_names()
    assert "code_executor" in registry.get_all_tool_names()


def test_get_tool(registry):
    calc = registry.get("calculator")
    assert calc is not None
    assert calc.name == "calculator"
    assert calc.category == "utility"


def test_get_nonexistent(registry):
    assert registry.get("nonexistent") is None
    assert registry.get_handler("nonexistent") is None


def test_to_llm_format(registry):
    calc = registry.get("calculator")
    fmt = calc.to_llm_format()
    assert fmt["name"] == "calculator"
    assert "input_schema" in fmt
    assert "description" in fmt


def test_get_tools_for_position(registry):
    tools = registry.get_tools_for_position(["calculator", "datetime"])
    assert len(tools) == 2
    names = [t["name"] for t in tools]
    assert "calculator" in names


def test_position_tools_missing(registry):
    tools = registry.get_tools_for_position(["calculator", "nonexistent"])
    assert len(tools) == 1  # only calculator found


@pytest.mark.asyncio
async def test_calculator_handler():
    result = await calculator.handler({"expression": "2 ** 10"})
    data = json.loads(result)
    assert data["result"] == 1024


@pytest.mark.asyncio
async def test_calculator_error():
    result = await calculator.handler({"expression": "1/0"})
    data = json.loads(result)
    assert "error" in data


@pytest.mark.asyncio
async def test_datetime_handler():
    result = await datetime_tool.handler({})
    data = json.loads(result)
    assert "datetime" in data
    assert "weekday" in data


def test_custom_tool_registration():
    reg = ToolRegistry()

    async def my_handler(args):
        return "ok"

    tool = ToolDefinition(
        name="my_tool",
        description="test",
        input_schema={"type": "object", "properties": {}},
        handler=my_handler,
    )
    reg.register(tool)
    assert reg.count == 1
    assert reg.get("my_tool") is not None
