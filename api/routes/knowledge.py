"""
AgentForge V2 — 知识库路由

知识库查询、文档上传、统计。
"""

from __future__ import annotations

import json
import logging

from aiohttp import web

logger = logging.getLogger(__name__)


def _json(data, status: int = 200) -> web.Response:
    return web.Response(
        text=json.dumps(data, ensure_ascii=False, default=str),
        content_type="application/json", status=status,
    )


async def _get_kb(request):
    """获取或创建 KnowledgeBase。"""
    if "knowledge_base" not in request.app:
        from knowledge.rag import KnowledgeBase
        engine = request.app["engine"]
        kb = KnowledgeBase(data_dir=str(engine.root_dir / "data"))
        await kb.init()
        request.app["knowledge_base"] = kb
    return request.app["knowledge_base"]


async def handle_knowledge_search(request: web.Request) -> web.Response:
    """POST /api/v1/knowledge/search  Body: {"query": "...", "top_k": 3}"""
    kb = await _get_kb(request)
    body = await request.json()
    query = body.get("query", "")
    top_k = body.get("top_k", 3)
    if not query:
        return _json({"error": "query 不能为空"}, status=400)

    results = kb.search(query, top_k=top_k)
    return _json({"results": results})


async def handle_knowledge_add(request: web.Request) -> web.Response:
    """POST /api/v1/knowledge/add  Body: {"doc_id": "...", "content": "...", "metadata": {}}"""
    kb = await _get_kb(request)
    body = await request.json()
    doc_id = body.get("doc_id", "")
    content = body.get("content", "")
    if not doc_id or not content:
        return _json({"error": "doc_id 和 content 不能为空"}, status=400)

    chunks = kb.add_document(
        doc_id=doc_id, content=content,
        metadata=body.get("metadata", {}),
        is_markdown=body.get("is_markdown", False),
    )
    return _json({"doc_id": doc_id, "chunks": chunks})


async def handle_knowledge_delete(request: web.Request) -> web.Response:
    """DELETE /api/v1/knowledge/{doc_id}"""
    kb = await _get_kb(request)
    doc_id = request.match_info["doc_id"]
    kb.delete_document(doc_id)
    return _json({"status": "deleted"})


async def handle_knowledge_stats(request: web.Request) -> web.Response:
    """GET /api/v1/knowledge/stats"""
    kb = await _get_kb(request)
    return _json(kb.get_stats())


def register(app: web.Application) -> None:
    app.router.add_post("/api/v1/knowledge/search", handle_knowledge_search)
    app.router.add_post("/api/v1/knowledge/add", handle_knowledge_add)
    app.router.add_delete("/api/v1/knowledge/{doc_id}", handle_knowledge_delete)
    app.router.add_get("/api/v1/knowledge/stats", handle_knowledge_stats)
