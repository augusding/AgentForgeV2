"""
AgentForge V2 — 工作流表达式引擎

支持 {{ }} 模板表达式：
  {{ $input }}              — 上游节点输出
  {{ $input.fieldName }}    — 取字段
  {{ $node["id"].output }}  — 引用指定节点输出
  {{ $vars.myVar }}         — 工作流变量
  {{ $env.KEY }}            — 环境变量（白名单）
"""

from __future__ import annotations

import os
import re
import logging
from typing import Any

logger = logging.getLogger(__name__)

_EXPR_PATTERN = re.compile(r"\{\{(.+?)\}\}", re.DOTALL)
_DOT_ACCESS = re.compile(r'\$\w+(?:\.\w+)+')
_DOLLAR_VAR = re.compile(r'\$(\w+)')
_ENV_WHITELIST = ("AGENTFORGE_", "SMTP_", "WF_")


class ExprContext:
    """表达式求值上下文。"""

    def __init__(self, input_data: Any = None, node_outputs: dict[str, Any] | None = None,
                 variables: dict[str, Any] | None = None, parameters: dict[str, Any] | None = None):
        self.input_data = input_data
        self.node_outputs = node_outputs or {}
        self.variables = variables or {}
        self.parameters = parameters or {}

    def resolve(self, template: Any) -> Any:
        """解析模板。单个 {{ expr }} 返回原始类型，多个做字符串插值。"""
        if not isinstance(template, str):
            return template
        s = template.strip()
        if s.startswith("{{") and s.endswith("}}"):
            inner = s[2:-2].strip()
            if "{{" not in inner:
                return self._eval_expr(inner)
        return _EXPR_PATTERN.sub(lambda m: str(self._eval_expr(m.group(1).strip()) or ""), template)

    def resolve_dict(self, data: dict) -> dict:
        """递归解析 dict 中所有值的表达式。"""
        out = {}
        for k, v in data.items():
            if isinstance(v, str): out[k] = self.resolve(v)
            elif isinstance(v, dict): out[k] = self.resolve_dict(v)
            elif isinstance(v, list): out[k] = [self.resolve(i) if isinstance(i, str) else i for i in v]
            else: out[k] = v
        return out

    def _eval_expr(self, expr: str) -> Any:
        ns = self._build_namespace()
        try:
            transformed = _DOT_ACCESS.sub(_transform_dots, expr)
            transformed = _DOLLAR_VAR.sub(r'_\1', transformed)  # $xxx → _xxx
            return eval(transformed, {"__builtins__": {}}, ns)
        except Exception as e:
            logger.debug("表达式求值失败: %s — %s", expr, e)
            return None

    def _build_namespace(self) -> dict[str, Any]:
        ns: dict[str, Any] = {
            "_input": self.input_data if self.input_data is not None else {},
            "_node": self.node_outputs,
            "_vars": _DotDict(self.variables),
            "_parameter": _DotDict(self.parameters),
        }
        # $env (whitelisted)
        env = {}
        for key, val in os.environ.items():
            if any(key.startswith(p) for p in _ENV_WHITELIST):
                env[key] = val
        ns["_env"] = _DotDict(env)
        ns.update(self.variables)
        # safe builtins
        for fn in (len, str, int, float, bool, list, dict, max, min, sum, abs, round, sorted):
            ns[fn.__name__] = fn
        return ns


def _transform_dots(match: re.Match) -> str:
    parts = match.group(0).split(".")
    base = parts[0].replace("$", "_")  # $input → _input
    for p in parts[1:]:
        base += f'["{p}"]' if p.isidentifier() else f".{p}"
    return base


class _DotDict(dict):
    """支持点号访问的 dict。"""
    def __getattr__(self, key: str):
        try: return self[key]
        except KeyError: return None
