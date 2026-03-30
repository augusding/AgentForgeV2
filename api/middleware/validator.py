"""
AgentForge V2 — 轻量输入校验

不依赖 pydantic/marshmallow，用 dict schema 定义必填字段和类型。
"""

import json
import logging
from functools import wraps
from aiohttp import web

logger = logging.getLogger(__name__)


def validate_json(schema: dict):
    """
    JSON Body 校验装饰器。

    schema 格式:
        {"field_name": {"required": True, "type": "string", "min_length": 1, "max_length": 500}}

    支持的 type: string, int, float, bool, list, dict
    支持的约束: required, min_length, max_length, min_value, max_value, choices
    """
    def decorator(handler):
        @wraps(handler)
        async def wrapper(request: web.Request):
            try:
                body = await request.json()
            except (json.JSONDecodeError, Exception):
                return web.json_response({"error": "请求体不是合法 JSON"}, status=400)

            errors = []
            for field, rules in schema.items():
                value = body.get(field)
                required = rules.get("required", False)
                expected_type = rules.get("type")

                if required and (value is None or (isinstance(value, str) and not value.strip())):
                    errors.append(f"'{field}' 为必填项")
                    continue
                if value is None:
                    continue

                type_map = {"string": str, "int": int, "float": (int, float), "bool": bool, "list": list, "dict": dict}
                if expected_type and expected_type in type_map:
                    if not isinstance(value, type_map[expected_type]):
                        errors.append(f"'{field}' 应为 {expected_type} 类型")
                        continue

                if isinstance(value, str):
                    if "min_length" in rules and len(value.strip()) < rules["min_length"]:
                        errors.append(f"'{field}' 长度不能少于 {rules['min_length']}")
                    if "max_length" in rules and len(value) > rules["max_length"]:
                        errors.append(f"'{field}' 长度不能超过 {rules['max_length']}")

                if isinstance(value, (int, float)):
                    if "min_value" in rules and value < rules["min_value"]:
                        errors.append(f"'{field}' 不能小于 {rules['min_value']}")
                    if "max_value" in rules and value > rules["max_value"]:
                        errors.append(f"'{field}' 不能大于 {rules['max_value']}")

                if "choices" in rules and value not in rules["choices"]:
                    errors.append(f"'{field}' 值无效，允许: {rules['choices']}")

            if errors:
                return web.json_response({"error": "参数校验失败", "details": errors}, status=400)

            request["_validated_body"] = body
            return await handler(request)
        return wrapper
    return decorator


def get_body(request: web.Request) -> dict:
    """从 request 获取已校验的 body。"""
    return request.get("_validated_body") or {}
