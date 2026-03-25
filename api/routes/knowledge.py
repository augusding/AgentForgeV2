"""AgentForge V2 — 知识库路由：查询、文档管理、统计。"""

from __future__ import annotations

import json
import logging
import traceback

from aiohttp import web

logger = logging.getLogger(__name__)


def _json(data, status: int = 200) -> web.Response:
    return web.Response(
        text=json.dumps(data, ensure_ascii=False, default=str),
        content_type="application/json", status=status,
    )


def _org_id(request) -> str:
    user = request.get("user") or {}
    return user.get("org_id", "") if isinstance(user, dict) else ""


async def handle_knowledge_search(request: web.Request) -> web.Response:
    """POST /api/v1/knowledge/search  Body: {"query": "...", "top_k": 3}"""
    try:
        kb = request.app["engine"].knowledge_base
        if not kb:
            return _json({"error": "知识库未初始化"}, status=503)
        body = await request.json()
        query = body.get("query", "")
        if not query:
            return _json({"error": "query 不能为空"}, status=400)
        results = kb.search(query, top_k=body.get("top_k", 3), org_id=_org_id(request))
        return _json({"results": results})
    except Exception as e:
        traceback.print_exc()
        return _json({"error": str(e)}, status=500)


async def handle_knowledge_add(request: web.Request) -> web.Response:
    """POST /api/v1/knowledge/add  Body: {"doc_id": "...", "content": "...", "metadata": {}}"""
    try:
        kb = request.app["engine"].knowledge_base
        if not kb:
            return _json({"error": "知识库未初始化"}, status=503)
        body = await request.json()
        doc_id = body.get("doc_id", "")
        content = body.get("content", "")
        if not doc_id or not content:
            return _json({"error": "doc_id 和 content 不能为空"}, status=400)
        chunks = kb.add_document(
            doc_id=doc_id, content=content,
            metadata=body.get("metadata", {}),
            is_markdown=body.get("is_markdown", False),
            org_id=_org_id(request),
        )
        return _json({"doc_id": doc_id, "chunks": chunks})
    except Exception as e:
        traceback.print_exc()
        return _json({"error": str(e)}, status=500)


async def handle_knowledge_delete(request: web.Request) -> web.Response:
    """DELETE /api/v1/knowledge/{doc_id}"""
    try:
        kb = request.app["engine"].knowledge_base
        if not kb:
            return _json({"error": "知识库未初始化"}, status=503)
        doc_id = request.match_info["doc_id"]
        kb.delete_document(doc_id, org_id=_org_id(request))
        return _json({"status": "deleted"})
    except Exception as e:
        traceback.print_exc()
        return _json({"error": str(e)}, status=500)


async def handle_knowledge_stats(request: web.Request) -> web.Response:
    """GET /api/v1/knowledge/stats"""
    try:
        kb = request.app["engine"].knowledge_base
        if not kb:
            return _json({"error": "知识库未初始化"}, status=503)
        return _json(kb.get_stats())
    except Exception as e:
        traceback.print_exc()
        return _json({"error": str(e)}, status=500)


def register(app: web.Application) -> None:
    app.router.add_post("/api/v1/knowledge/search", handle_knowledge_search)
    app.router.add_post("/api/v1/knowledge/add", handle_knowledge_add)
    app.router.add_delete("/api/v1/knowledge/{doc_id}", handle_knowledge_delete)
    app.router.add_get("/api/v1/knowledge/stats", handle_knowledge_stats)
