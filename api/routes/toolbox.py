"""AgentForge V2 — 工具箱 API，从 YAML 动态加载工具定义。"""

import json
import logging
from pathlib import Path

import yaml
from aiohttp import web

logger = logging.getLogger(__name__)


def _json(data, status=200):
    return web.Response(text=json.dumps(data, ensure_ascii=False, default=str),
                        content_type="application/json", status=status)


def _load_toolbox(root_dir: Path) -> dict:
    """加载 tools/toolbox/ 下所有 YAML 定义。"""
    toolbox_dir = root_dir / "tools" / "toolbox"
    if not toolbox_dir.is_dir():
        return {"categories": [], "tools": []}

    categories: list[dict] = []
    cat_file = toolbox_dir / "_categories.yaml"
    if cat_file.is_file():
        data = yaml.safe_load(cat_file.read_text(encoding="utf-8"))
        categories = data.get("categories", [])

    tools: list[dict] = []
    for f in sorted(toolbox_dir.glob("*.yaml")):
        if f.name.startswith("_"):
            continue
        try:
            tool = yaml.safe_load(f.read_text(encoding="utf-8"))
            if tool and isinstance(tool, dict) and tool.get("id"):
                tools.append(tool)
        except Exception as e:
            logger.warning("加载工具定义失败 [%s]: %s", f.name, e)

    tools.sort(key=lambda t: (t.get("category", "z"), t.get("sort", 99)))
    return {"categories": categories, "tools": tools}


_cache: dict | None = None


async def handle_toolbox_list(request: web.Request) -> web.Response:
    """GET /api/v1/toolbox/tools — 获取所有工具定义"""
    global _cache
    if _cache is None:
        _cache = _load_toolbox(request.app["engine"].root_dir)
    return _json(_cache)


async def handle_toolbox_reload(request: web.Request) -> web.Response:
    """POST /api/v1/toolbox/reload — 重新加载工具定义"""
    global _cache
    _cache = _load_toolbox(request.app["engine"].root_dir)
    return _json({"status": "reloaded", "tools": len(_cache["tools"]),
                  "categories": len(_cache["categories"])})


def register(app: web.Application) -> None:
    app.router.add_get("/api/v1/toolbox/tools", handle_toolbox_list)
    app.router.add_post("/api/v1/toolbox/reload", handle_toolbox_reload)
