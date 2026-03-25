"""条件节点：if（二路分支）, switch（多路分发）"""

import json
import logging
import operator

from workflow.registry import NodeRegistry, NodeTypeInfo
from workflow.expression import ExprContext
from workflow.types import WorkflowNode, NodeResult

logger = logging.getLogger(__name__)

_OPS = {
    "equals": operator.eq, "not_equals": operator.ne,
    "gt": operator.gt, "gte": operator.ge, "lt": operator.lt, "lte": operator.le,
    "contains": lambda a, b: str(b) in str(a), "not_contains": lambda a, b: str(b) not in str(a),
    "starts_with": lambda a, b: str(a).startswith(str(b)), "ends_with": lambda a, b: str(a).endswith(str(b)),
    "is_empty": lambda a, _: not a, "is_not_empty": lambda a, _: bool(a), "exists": lambda a, _: a is not None,
}


def _evaluate_rules(cfg, variables: dict, input_data) -> bool:
    if isinstance(cfg, str):
        try: cfg = json.loads(cfg)
        except json.JSONDecodeError: return bool(cfg)
    if not isinstance(cfg, dict): return bool(cfg)
    combine = cfg.get("combineMode", "AND")
    rules = cfg.get("rules", [])
    if not rules: return True
    data = {**variables, **(input_data if isinstance(input_data, dict) else {})}
    results = []
    for r in rules:
        actual = data.get(r.get("field", ""))
        value = r.get("value", "")
        try:
            if isinstance(actual, (int, float)) and isinstance(value, str):
                value = float(value) if "." in value else int(value)
        except (ValueError, TypeError): pass
        try: results.append(_OPS.get(r.get("operator", "equals"), operator.eq)(actual, value))
        except Exception: results.append(False)
    return any(results) if combine == "OR" else all(results)


async def _if_executor(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    mode = node.config.get("mode", "rules")
    inp = ctx.get("_last_output", {})
    if mode == "expression":
        expr = node.config.get("expression", "True")
        expr_ctx = ExprContext(input_data=inp, variables=variables, parameters=node.config)
        result = bool(expr_ctx.resolve(f"{{{{ {expr} }}}}"))
    else:
        result = _evaluate_rules(node.config.get("conditions", "{}"), variables, inp)
    return NodeResult(node_id=node.id, status="completed",
        output={"condition_result": result, "_output_index": 0 if result else 1})


async def _switch_executor(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    inp = ctx.get("_last_output", {})
    data = {**variables, **(inp if isinstance(inp, dict) else {})}
    mode = node.config.get("mode", "value")
    if mode == "value":
        field = node.config.get("routeField", "")
        actual = str(data.get(field, ""))
        values = [v.strip() for v in node.config.get("routeValues", "").split(",") if v.strip()]
        for i, val in enumerate(values):
            if actual == val:
                return NodeResult(node_id=node.id, status="completed",
                    output={"matched_route": i, "matched_value": val, "_output_index": i})
        return NodeResult(node_id=node.id, status="completed",
            output={"matched_route": len(values), "matched_value": None, "_output_index": len(values)})
    routes = node.config.get("routes", [])
    expr_ctx = ExprContext(input_data=inp, variables=variables)
    for i, route in enumerate(routes):
        if bool(expr_ctx.resolve(f"{{{{ {route.get('expression', 'False')} }}}}")):
            return NodeResult(node_id=node.id, status="completed", output={"matched_route": i, "_output_index": i})
    return NodeResult(node_id=node.id, status="completed", output={"matched_route": -1, "_output_index": len(routes)})


def register_conditions(registry: NodeRegistry) -> None:
    registry.register(NodeTypeInfo(
        name="if", display_name="条件判断", group="logic", icon="git-branch",
        description="根据条件分支。输出 0=true, 1=false", inputs=1, outputs=2, output_names=["true", "false"],
        parameters=[
            {"name": "mode", "type": "options", "displayName": "模式", "default": "rules",
             "options": [{"name": "规则", "value": "rules"}, {"name": "表达式", "value": "expression"}]},
            {"name": "conditions", "type": "filter", "displayName": "条件规则", "default": "{}",
             "displayOptions": {"show": {"mode": ["rules"]}}},
            {"name": "expression", "type": "string", "displayName": "条件表达式", "default": "True",
             "displayOptions": {"show": {"mode": ["expression"]}}},
        ], executor=_if_executor))
    registry.register(NodeTypeInfo(
        name="switch", display_name="多路分发", group="logic", icon="split",
        description="按值或表达式路由到不同分支", inputs=1, outputs=4, output_names=["route_0", "route_1", "route_2", "fallback"],
        parameters=[
            {"name": "mode", "type": "options", "displayName": "模式", "default": "value",
             "options": [{"name": "按值", "value": "value"}, {"name": "按表达式", "value": "expression"}]},
            {"name": "routeField", "type": "string", "displayName": "路由字段", "default": ""},
            {"name": "routeValues", "type": "string", "displayName": "路由值", "default": ""},
        ], executor=_switch_executor))
