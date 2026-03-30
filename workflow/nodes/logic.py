"""逻辑节点：set（设置变量）, code（Python 代码执行）"""

import asyncio
import json
import logging
import os

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

_CODE_TIMEOUT = int(os.environ.get("CODE_NODE_TIMEOUT", "10"))
_CODE_MAX_OUTPUT = 1024 * 1024

_SAFE_BUILTINS_NAMES = [
    "abs", "all", "any", "bool", "bytes", "chr", "dict", "enumerate",
    "filter", "float", "format", "hash", "hex", "int", "isinstance",
    "iter", "len", "list", "map", "max", "min", "next", "oct", "ord",
    "pow", "print", "range", "repr", "reversed", "round", "set",
    "slice", "sorted", "str", "sum", "tuple", "zip",
    "ValueError", "TypeError", "KeyError", "IndexError",
    "AttributeError", "RuntimeError", "Exception", "StopIteration",
    "True", "False", "None",
]


def _run_code_sandboxed(code: str, input_data: dict, variables: dict) -> dict:
    """在受限环境中执行代码。"""
    import builtins as _bi
    _sb = {k: getattr(_bi, k) for k in _SAFE_BUILTINS_NAMES if hasattr(_bi, k)}
    _sb["__import__"] = _safe_import
    sandbox = {
        "__builtins__": _sb,
        "input_data": input_data,
        "variables": dict(variables),
        "items": input_data,
        **variables,
    }
    code_obj = compile(code, "<workflow_code>", "exec")
    for const in code_obj.co_consts:
        if isinstance(const, str) and any(d in const for d in (
                "__class__", "__bases__", "__subclasses__", "__globals__", "__code__", "__builtins__")):
            raise SecurityError(f"代码包含禁止的属性访问: {const}")
    exec(code_obj, sandbox)
    result = sandbox.get("result", {})
    if not isinstance(result, dict):
        result = {"result": result}
    output_str = json.dumps(result, default=str, ensure_ascii=False)
    if len(output_str) > _CODE_MAX_OUTPUT:
        raise ValueError(f"输出过大 ({len(output_str)} bytes > {_CODE_MAX_OUTPUT})")
    return result


class SecurityError(Exception):
    pass


async def _code_executor(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    """Python 代码执行：超时控制 + 安全沙箱。"""
    code = node.config.get("code", "")
    if not code.strip():
        return NodeResult(node_id=node.id, status="completed", output={})
    input_data = ctx.get("_last_output", {})
    loop = asyncio.get_event_loop()
    try:
        result = await asyncio.wait_for(
            loop.run_in_executor(None, _run_code_sandboxed, code, input_data, variables),
            timeout=_CODE_TIMEOUT,
        )
        return NodeResult(node_id=node.id, status="completed", output=result)
    except asyncio.TimeoutError:
        logger.warning("代码节点超时: %s (%ds)", node.id, _CODE_TIMEOUT)
        return NodeResult(node_id=node.id, status="failed", error=f"代码执行超时（{_CODE_TIMEOUT}秒）")
    except SecurityError as e:
        logger.warning("代码节点安全拦截: %s — %s", node.id, e)
        return NodeResult(node_id=node.id, status="failed", error=f"安全检查未通过: {e}")
    except Exception as e:
        return NodeResult(node_id=node.id, status="failed", error=f"代码执行错误: {e}")


async def _condition_executor(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    """条件节点：安全表达式求值（禁止属性访问和函数调用）。"""
    import ast as _ast
    expression = node.config.get("expression", "True")
    try:
        tree = _ast.parse(expression, mode="eval")
        for n in _ast.walk(tree):
            if isinstance(n, (_ast.Attribute, _ast.Call)):
                return NodeResult(node_id=node.id, status="failed",
                    error=f"表达式不允许属性访问或函数调用: {expression}")
        safe_vars = {**variables}
        inp = ctx.get("_last_output", {})
        if isinstance(inp, dict):
            safe_vars.update(inp)
        result = bool(eval(compile(tree, "<condition>", "eval"), {"__builtins__": {}}, safe_vars))
        return NodeResult(node_id=node.id, status="completed", output={"condition_result": result})
    except Exception as e:
        return NodeResult(node_id=node.id, status="failed", error=f"条件表达式错误: {e}")


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
