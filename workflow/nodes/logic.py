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


_SAFE_MODULES = {"json", "re", "math", "datetime", "hashlib", "base64", "collections",
    "itertools", "functools", "random", "string", "time", "urllib.parse", "decimal",
    "fractions", "statistics", "textwrap", "difflib", "copy", "pprint", "operator"}

def _safe_import(name, *args, **kwargs):
    if name.split(".")[0] not in _SAFE_MODULES:
        raise ImportError(f"模块 '{name}' 不在安全白名单中")
    return __import__(name, *args, **kwargs)

async def _code_executor(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    """Python 代码执行：安全 import 白名单 + exec。"""
    code = node.config.get("code", "")
    if not code.strip():
        return NodeResult(node_id=node.id, status="completed", output={})
    import builtins as _bi
    _sb = {k: getattr(_bi, k) for k in ["abs","all","any","bool","bytes","chr","dict","enumerate",
        "filter","float","format","getattr","hasattr","hash","hex","int","isinstance","iter","len",
        "list","map","max","min","next","oct","ord","pow","print","range","repr","reversed","round",
        "set","slice","sorted","str","sum","tuple","type","zip","ValueError","TypeError","KeyError",
        "IndexError","AttributeError","RuntimeError","Exception","StopIteration","True","False","None"]
        if hasattr(_bi, k)}
    _sb["__import__"] = _safe_import
    sandbox = {
        "__builtins__": _sb,
        "input_data": ctx.get("_last_output", {}),
        "variables": dict(variables),
        "items": ctx.get("_last_output", {}),
        **variables,
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
