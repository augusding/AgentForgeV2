"""逻辑节点：set（设置变量）, code（Python 代码执行）"""

import json
import logging

from workflow.registry import NodeRegistry, NodeTypeInfo
from workflow.expression import ExprContext
from workflow.types import WorkflowNode, NodeResult

logger = logging.getLogger(__name__)


async def _set_executor(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    """设置变量：支持 {{ 表达式 }}。"""
    expr_ctx = ExprContext(
        input_data=ctx.get("_last_output"), node_outputs=ctx.get("_node_outputs", {}),
        variables=variables, parameters=node.config)

    assignments = node.config.get("assignments", {})
    if isinstance(assignments, str):
        try: assignments = json.loads(assignments)
        except json.JSONDecodeError: assignments = {}

    output = {}
    for key, value in assignments.items():
        output[key] = expr_ctx.resolve(value) if isinstance(value, str) else value
    # also resolve top-level config keys (simple key=value)
    for key, value in node.config.items():
        if key != "assignments":
            output[key] = expr_ctx.resolve(value) if isinstance(value, str) else value

    return NodeResult(node_id=node.id, status="completed", output=output)


async def _code_executor(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    """Python 代码执行：exec，捕获 result 变量。"""
    code = node.config.get("code", "")
    if not code.strip():
        return NodeResult(node_id=node.id, status="completed", output={})

    sandbox = {
        "__builtins__": {
            "print": print, "len": len, "str": str, "int": int, "float": float,
            "bool": bool, "list": list, "dict": dict, "tuple": tuple, "set": set,
            "range": range, "enumerate": enumerate, "zip": zip, "map": map,
            "filter": filter, "sorted": sorted, "max": max, "min": min, "sum": sum,
            "abs": abs, "round": round, "isinstance": isinstance, "type": type,
            "hasattr": hasattr, "getattr": getattr,
            "ValueError": ValueError, "TypeError": TypeError, "KeyError": KeyError,
            "Exception": Exception, "RuntimeError": RuntimeError,
            "json": __import__("json"), "datetime": __import__("datetime"),
            "re": __import__("re"), "math": __import__("math"),
        },
        "input_data": ctx.get("_last_output", {}),
        "variables": dict(variables),
        "items": ctx.get("_last_output", {}),
        **variables,  # expose variables as top-level names
    }

    try:
        exec(code, sandbox)
        result = sandbox.get("result", {})
        if not isinstance(result, dict):
            result = {"result": result}
        return NodeResult(node_id=node.id, status="completed", output=result)
    except Exception as e:
        return NodeResult(node_id=node.id, status="failed", error=f"代码执行错误: {e}")


async def _condition_executor(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    """条件节点：评估表达式。"""
    expression = node.config.get("expression", "True")
    try:
        result = bool(eval(expression, {"__builtins__": {}}, variables))
        return NodeResult(node_id=node.id, status="completed", output={"condition_result": result})
    except Exception as e:
        return NodeResult(node_id=node.id, status="failed", error=str(e))


def register_logic(registry: NodeRegistry) -> None:
    registry.register(NodeTypeInfo(
        name="set", display_name="设置变量", group="data", icon="edit-3",
        description="设置或修改工作流变量，支持表达式",
        parameters=[{"name": "assignments", "type": "json", "displayName": "变量赋值", "default": "{}"}],
        executor=_set_executor))
    registry.register(NodeTypeInfo(
        name="code", display_name="代码执行", group="logic", icon="code",
        description="执行 Python 代码。设置 result 变量作为输出",
        parameters=[{"name": "code", "type": "code", "displayName": "Python 代码", "default": "result = {'hello': 'world'}"}],
        executor=_code_executor))
    registry.register(NodeTypeInfo(
        name="condition", display_name="条件判断", group="logic", icon="git-branch",
        description="评估条件表达式，输出布尔结果", outputs=2,
        output_names=["true", "false"],
        parameters=[{"name": "expression", "type": "string", "displayName": "条件表达式", "default": "True"}],
        executor=_condition_executor))
