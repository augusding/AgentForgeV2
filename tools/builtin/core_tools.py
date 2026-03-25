"""
AgentForge V2 — 内置工具集

核心工具（精简版），每个工具 = definition + handler。
"""

from __future__ import annotations

import asyncio
import json
import logging
import subprocess
import urllib.request
from datetime import datetime
from typing import Any

from tools.registry import ToolDefinition

logger = logging.getLogger(__name__)


# ── 计算器 ────────────────────────────────────────────────

async def _calculator_handler(args: dict) -> str:
    expression = args.get("expression", "")
    try:
        # 安全的数学计算 (禁止 __import__ 等)
        allowed = {"__builtins__": {}}
        import math
        allowed["math"] = math
        result = eval(expression, allowed)
        return json.dumps({"result": result}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)

calculator = ToolDefinition(
    name="calculator",
    description="执行数学计算。支持四则运算、math 模块函数。",
    input_schema={
        "type": "object",
        "properties": {
            "expression": {"type": "string", "description": "数学表达式，如 '2**10' 或 'math.sqrt(144)'"}
        },
        "required": ["expression"],
    },
    handler=_calculator_handler,
    category="utility",
)


# ── 日期时间 ──────────────────────────────────────────────

async def _datetime_handler(args: dict) -> str:
    fmt = args.get("format", "%Y-%m-%d %H:%M:%S")
    now = datetime.now()
    return json.dumps({
        "datetime": now.strftime(fmt),
        "timestamp": now.timestamp(),
        "weekday": ["周一", "周二", "周三", "周四", "周五", "周六", "周日"][now.weekday()],
    }, ensure_ascii=False)

datetime_tool = ToolDefinition(
    name="datetime",
    description="获取当前日期和时间。",
    input_schema={
        "type": "object",
        "properties": {
            "format": {"type": "string", "description": "时间格式 (strftime)，默认 %Y-%m-%d %H:%M:%S"}
        },
    },
    handler=_datetime_handler,
    category="utility",
)


# ── 代码执行 ──────────────────────────────────────────────

async def _code_executor_handler(args: dict) -> str:
    code = args.get("code", "")
    language = args.get("language", "python")
    if language != "python":
        return json.dumps({"error": f"不支持的语言: {language}"}, ensure_ascii=False)
    try:
        proc = await asyncio.create_subprocess_exec(
            "python3", "-c", code,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
        return json.dumps({
            "stdout": stdout.decode("utf-8", errors="replace")[:5000],
            "stderr": stderr.decode("utf-8", errors="replace")[:2000],
            "return_code": proc.returncode,
        }, ensure_ascii=False)
    except asyncio.TimeoutError:
        return json.dumps({"error": "代码执行超时 (30s)"}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)

code_executor = ToolDefinition(
    name="code_executor",
    description="执行 Python 代码片段并返回输出。适用于数据处理、计算、文件操作。",
    input_schema={
        "type": "object",
        "properties": {
            "code": {"type": "string", "description": "要执行的 Python 代码"},
            "language": {"type": "string", "description": "编程语言，目前只支持 python", "default": "python"},
        },
        "required": ["code"],
    },
    handler=_code_executor_handler,
    category="execution",
)


# ── Shell 执行 ────────────────────────────────────────────

async def _shell_handler(args: dict) -> str:
    command = args.get("command", "")
    try:
        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
        return json.dumps({
            "stdout": stdout.decode("utf-8", errors="replace")[:5000],
            "stderr": stderr.decode("utf-8", errors="replace")[:2000],
            "return_code": proc.returncode,
        }, ensure_ascii=False)
    except asyncio.TimeoutError:
        return json.dumps({"error": "命令执行超时 (30s)"}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)

shell_executor = ToolDefinition(
    name="shell_executor",
    description="执行 Shell 命令。",
    input_schema={
        "type": "object",
        "properties": {
            "command": {"type": "string", "description": "要执行的 Shell 命令"},
        },
        "required": ["command"],
    },
    handler=_shell_handler,
    category="execution",
)


# ── Web 搜索 ─────────────────────────────────────────────

async def _web_search_handler(args: dict) -> str:
    query = args.get("query", "")
    # 占位实现 — 实际接入搜索 API
    return json.dumps({
        "query": query,
        "results": [],
        "note": "Web 搜索功能需要配置搜索 API (如 Tavily, SerpAPI)",
    }, ensure_ascii=False)

web_search = ToolDefinition(
    name="web_search",
    description="搜索互联网获取最新信息。",
    input_schema={
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "搜索关键词"},
        },
        "required": ["query"],
    },
    handler=_web_search_handler,
    category="search",
)


# ── 文本处理 ──────────────────────────────────────────────

async def _text_processor_handler(args: dict) -> str:
    text = args.get("text", "")
    operation = args.get("operation", "word_count")
    if operation == "word_count":
        char_count = len(text)
        word_count = len(text.split())
        return json.dumps({"char_count": char_count, "word_count": word_count}, ensure_ascii=False)
    elif operation == "summarize":
        return json.dumps({"summary": text[:200] + "..."}, ensure_ascii=False)
    else:
        return json.dumps({"error": f"未知操作: {operation}"}, ensure_ascii=False)

text_processor = ToolDefinition(
    name="text_processor",
    description="文本处理工具：字数统计、摘要等。",
    input_schema={
        "type": "object",
        "properties": {
            "text": {"type": "string", "description": "要处理的文本"},
            "operation": {"type": "string", "enum": ["word_count", "summarize"], "description": "操作类型"},
        },
        "required": ["text", "operation"],
    },
    handler=_text_processor_handler,
    category="utility",
)


# ── HTTP 请求 ─────────────────────────────────────────────

async def _http_request_handler(args: dict) -> str:
    url = args.get("url", "")
    method = args.get("method", "GET").upper()
    try:
        req = urllib.request.Request(url, method=method)
        req.add_header("User-Agent", "AgentForge/2.0")
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8", errors="replace")[:5000]
            return json.dumps({
                "status": resp.status,
                "body": body,
            }, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)

http_request = ToolDefinition(
    name="http_request",
    description="发送 HTTP 请求。",
    input_schema={
        "type": "object",
        "properties": {
            "url": {"type": "string", "description": "请求 URL"},
            "method": {"type": "string", "enum": ["GET", "POST"], "default": "GET"},
        },
        "required": ["url"],
    },
    handler=_http_request_handler,
    category="network",
)


# ── 注册所有核心工具 ──────────────────────────────────────

ALL_BUILTIN_TOOLS = [
    calculator,
    datetime_tool,
    code_executor,
    shell_executor,
    web_search,
    text_processor,
    http_request,
]


def register_all(registry) -> None:
    """将所有内置工具注册到 ToolRegistry。"""
    for tool in ALL_BUILTIN_TOOLS:
        registry.register(tool)

    # 数据工具
    from tools.builtin.data_tools import ALL_DATA_TOOLS
    for tool in ALL_DATA_TOOLS:
        registry.register(tool)

    # 文档工具
    from tools.builtin.document_tools import ALL_DOCUMENT_TOOLS
    for tool in ALL_DOCUMENT_TOOLS:
        registry.register(tool)

    # 扩展工具
    from tools.builtin.extra_tools import ALL_EXTRA_TOOLS
    for tool in ALL_EXTRA_TOOLS:
        registry.register(tool)

    logger.info("已注册 %d 个内置工具", registry.count)
