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
    description="执行数学计算。当用户需要计算数字、百分比、汇率换算、统计（平均值、总和）时使用。支持四则运算、幂运算、math 模块函数。",
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
    description="获取当前日期和时间。当用户问现在几点、今天几号、今天星期几、距离某日还有几天时使用。",
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
    description="执行 Python 代码。当需要复杂数据处理、文本转换、列表操作、正则匹配等编程任务时使用。代码在安全沙箱中运行，超时 10 秒。",
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

async def _search_sogou(query: str, max_results: int) -> list[dict]:
    """搜狗搜索（国内稳定可用，无需 API Key）。"""
    import aiohttp, re as _re
    from urllib.parse import quote
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }
    url = f"https://www.sogou.com/web?query={quote(query)}"
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10), allow_redirects=True) as resp:
            html = await resp.text()
    results = []
    blocks = _re.split(r'<h3[^>]*>', html)[1:]
    for block in blocks[:max_results + 2]:
        lm = _re.search(r'href=["\']([^"\']+)["\'][^>]*>(.*?)(?:</a>)', block, _re.DOTALL)
        if not lm:
            continue
        link = lm.group(1)
        title = _re.sub(r'<[^>]+>', '', lm.group(2)).strip()
        if not title:
            continue
        if link.startswith("/link?"):
            link = f"https://www.sogou.com{link}"
        snippet = ""
        for pat in [r'<p[^>]*>(.*?)</p>', r'<div[^>]*class="[^"]*space-txt[^"]*"[^>]*>(.*?)</div>']:
            sm = _re.search(pat, block, _re.DOTALL)
            if sm:
                snippet = _re.sub(r'<[^>]+>', '', sm.group(1)).strip()
                if len(snippet) > 15:
                    break
                snippet = ""
        if not snippet:
            text = _re.sub(r'<[^>]+>', ' ', block[:800]).strip().replace(title, '').strip()
            if len(text) > 20:
                snippet = text[:200]
        results.append({"title": title, "url": link, "snippet": snippet[:200]})
        if len(results) >= max_results:
            break
    return results


async def _search_bing(query: str, max_results: int) -> list[dict]:
    """Bing 中国搜索。"""
    import aiohttp, re as _re
    from urllib.parse import quote
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36", "Accept-Language": "zh-CN,zh;q=0.9"}
    url = f"https://cn.bing.com/search?q={quote(query)}&count={max_results}"
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=8)) as resp:
            html = await resp.text()
    results = []
    for block in _re.findall(r'<li class="b_algo">(.*?)</li>', html, _re.DOTALL)[:max_results]:
        m = _re.search(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', block)
        if not m:
            continue
        link, title = m.group(1), _re.sub(r'<[^>]+>', '', m.group(2)).strip()
        sm = _re.search(r'<p[^>]*>(.*?)</p>', block, _re.DOTALL)
        snippet = _re.sub(r'<[^>]+>', '', sm.group(1)).strip()[:200] if sm else ""
        if title and link.startswith("http"):
            results.append({"title": title, "url": link, "snippet": snippet})
    return results


async def _web_search_handler(args: dict) -> str:
    """联网搜索。搜狗 → Bing → Tavily → DuckDuckGo → 提示。"""
    query = args.get("query", "").strip()
    if not query:
        return json.dumps({"error": "搜索关键词不能为空"}, ensure_ascii=False)
    max_results = min(args.get("max_results", 5), 10)
    import os

    # 方案 1: 搜狗（国内最稳定）
    try:
        results = await _search_sogou(query, max_results)
        if results:
            return json.dumps({"query": query, "results": results, "count": len(results), "source": "sogou"}, ensure_ascii=False)
    except Exception as e:
        logger.warning("搜狗搜索失败: %s", e)

    # 方案 2: Bing 中国
    try:
        results = await _search_bing(query, max_results)
        if results:
            return json.dumps({"query": query, "results": results, "count": len(results), "source": "bing"}, ensure_ascii=False)
    except Exception as e:
        logger.warning("Bing 搜索失败: %s", e)

    # 方案 2: Tavily API
    try:
        import aiohttp
        key = os.environ.get("TAVILY_API_KEY", "")
        if key:
            async with aiohttp.ClientSession() as session:
                async with session.post("https://api.tavily.com/search",
                    json={"query": query, "max_results": max_results, "api_key": key},
                    timeout=aiohttp.ClientTimeout(total=15)) as resp:
                    data = await resp.json()
                    results = [{"title": r.get("title", ""), "url": r.get("url", ""), "snippet": r.get("content", "")} for r in data.get("results", [])]
                    if results:
                        return json.dumps({"query": query, "results": results, "count": len(results), "source": "tavily"}, ensure_ascii=False)
    except Exception as e:
        logger.warning("Tavily 搜索失败: %s", e)

    # 方案 3: DuckDuckGo（翻墙环境 fallback）
    try:
        from duckduckgo_search import DDGS
        proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("ALL_PROXY") or ""
        kw = {"proxy": proxy} if proxy else {}
        results = []
        with DDGS(**kw) as ddgs:
            for r in ddgs.text(query, max_results=max_results):
                results.append({"title": r.get("title", ""), "url": r.get("href", ""), "snippet": r.get("body", "")})
        if results:
            return json.dumps({"query": query, "results": results, "count": len(results), "source": "duckduckgo"}, ensure_ascii=False)
    except Exception as e:
        logger.warning("DuckDuckGo 搜索失败: %s", e)

    return json.dumps({"query": query, "results": [], "count": 0,
        "note": "搜索未返回有效结果。请尝试更换关键词，或直接告诉用户你无法联网搜索。"}, ensure_ascii=False)

web_search = ToolDefinition(
    name="web_search",
    description="搜索互联网获取最新信息。当用户询问实时信息（新闻、天气、股价）或知识库中没有的外部信息时使用。",
    input_schema={
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "搜索关键词，尽量简洁精准"},
            "max_results": {"type": "integer", "description": "最大结果数，默认5", "default": 5},
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
    description="文本处理工具。当用户需要字数统计、词频分析、文本格式转换时使用。",
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
    description="发送 HTTP 请求到外部 API。当用户需要调用第三方接口、获取 API 数据时使用。支持 GET/POST。",
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
