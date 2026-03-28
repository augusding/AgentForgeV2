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
    """DELETE /api/v1/knowledge/{doc_id} — 删除 ChromaDB 条目 + 物理文件"""
    try:
        engine = request.app["engine"]
        kb = engine.knowledge_base
        doc_id = request.match_info["doc_id"]
        user = request.get("user") or {}
        u_id = user.get("sub", "anonymous") if isinstance(user, dict) else "anonymous"
        o_id = _org_id(request) or "_default"

        deleted_db = False
        deleted_file = False

        if kb:
            try:
                kb.delete_document(doc_id, org_id=o_id)
                deleted_db = True
            except Exception as e:
                logger.warning("ChromaDB 删除失败: %s", e)

        for base in ("data/knowledge", "data/uploads"):
            d = engine.root_dir / base / o_id / u_id
            if not d.is_dir():
                continue
            for f in d.iterdir():
                if f.is_file() and (f.stem == doc_id or f.name.startswith(doc_id)):
                    try:
                        f.unlink()
                        deleted_file = True
                    except Exception as e:
                        logger.warning("文件删除失败: %s", e)

        if deleted_db or deleted_file:
            return _json({"status": "deleted", "doc_id": doc_id})
        return _json({"error": f"未找到文档: {doc_id}"}, status=404)
    except Exception as e:
        traceback.print_exc()
        return _json({"error": str(e)}, status=500)


async def handle_knowledge_stats(request: web.Request) -> web.Response:
    """GET /api/v1/knowledge/stats — 真实统计"""
    try:
        engine = request.app["engine"]
        kb = engine.knowledge_base
        user = request.get("user") or {}
        u_id = user.get("sub", "anonymous") if isinstance(user, dict) else "anonymous"
        o_id = _org_id(request) or "_default"

        total_files = 0
        total_chunks = 0
        total_size = 0

        if kb and kb._collection:
            try:
                result = kb._collection.get(
                    where={"org_id": o_id} if o_id != "_default" else None,
                    include=["metadatas"],
                )
                metadatas = result.get("metadatas") or []
                total_chunks = len(metadatas)
                doc_ids = {m.get("doc_id", "") for m in metadatas if m.get("doc_id")}
                total_files = len(doc_ids)
            except Exception:
                traceback.print_exc()

        for base in ("data/knowledge", "data/uploads"):
            d = engine.root_dir / base / o_id / u_id
            if d.is_dir():
                for f in d.iterdir():
                    if f.is_file():
                        total_size += f.stat().st_size

        return _json({
            "status": "ok",
            "total_files": total_files,
            "total_chunks": total_chunks,
            "total_size": total_size,
        })
    except Exception as e:
        traceback.print_exc()
        return _json({"error": str(e)}, status=500)


async def handle_knowledge_files(request: web.Request) -> web.Response:
    """GET /api/v1/knowledge/files — 从 ChromaDB 获取知识库文档列表"""
    try:
        engine = request.app["engine"]
        kb = engine.knowledge_base
        user = request.get("user") or {}
        u_id = user.get("sub", "anonymous") if isinstance(user, dict) else "anonymous"
        o_id = _org_id(request) or "_default"

        files: list[dict] = []
        if kb and kb._collection:
            try:
                result = kb._collection.get(
                    where={"org_id": o_id} if o_id != "_default" else None,
                    include=["metadatas"],
                )
            except Exception:
                result = kb._collection.get(include=["metadatas"])
            seen: dict[str, dict] = {}
            for meta in (result.get("metadatas") or []):
                doc_id = meta.get("doc_id", "")
                if doc_id and doc_id not in seen:
                    seen[doc_id] = {
                        "doc_id": doc_id,
                        "file_id": doc_id,
                        "filename": meta.get("filename") or meta.get("title") or doc_id,
                        "title": meta.get("title", ""),
                        "source": meta.get("source", ""),
                        "source_type": meta.get("source_type", "upload"),
                        "source_url": meta.get("source_url") or meta.get("source", ""),
                        "lang": meta.get("lang", ""),
                        "quality_score": meta.get("quality_score", 1.0),
                        "deleted": meta.get("deleted", False),
                        "size": 0,
                        "modified": 0,
                    }

            for doc_id, info in seen.items():
                for base in ("data/knowledge", "data/uploads"):
                    d = engine.root_dir / base / o_id / u_id
                    if not d.is_dir():
                        continue
                    for f in d.iterdir():
                        if f.is_file() and (f.stem == doc_id or f.name == info["filename"]):
                            info["size"] = f.stat().st_size
                            info["modified"] = f.stat().st_mtime
                            break
                    if info["size"]:
                        break
                files.append(info)

        files.sort(key=lambda x: x.get("modified", 0), reverse=True)
        return _json({"files": files})
    except Exception as e:
        traceback.print_exc()
        return _json({"error": str(e), "files": []}, status=500)


async def handle_knowledge_clear(request: web.Request) -> web.Response:
    """POST /api/v1/knowledge/clear — 清空知识库"""
    try:
        engine = request.app["engine"]
        kb = engine.knowledge_base
        user = request.get("user") or {}
        u_id = user.get("sub", "anonymous") if isinstance(user, dict) else "anonymous"
        o_id = _org_id(request) or "_default"

        chunks = kb.clear_all(org_id=o_id if o_id != "_default" else "") if kb else 0
        files_deleted = 0
        for base in ("data/knowledge", "data/uploads"):
            d = engine.root_dir / base / o_id / u_id
            if d.is_dir():
                for f in d.iterdir():
                    if f.is_file():
                        f.unlink()
                        files_deleted += 1
        return _json({"status": "cleared", "chunks_deleted": chunks, "files_deleted": files_deleted})
    except Exception as e:
        traceback.print_exc()
        return _json({"error": str(e)}, status=500)


def register(app: web.Application) -> None:
    app.router.add_post("/api/v1/knowledge/search", handle_knowledge_search)
    app.router.add_post("/api/v1/knowledge/add", handle_knowledge_add)
    app.router.add_delete("/api/v1/knowledge/{doc_id}", handle_knowledge_delete)
    app.router.add_get("/api/v1/knowledge/stats", handle_knowledge_stats)
    app.router.add_get("/api/v1/knowledge/files", handle_knowledge_files)
    app.router.add_post("/api/v1/knowledge/clear", handle_knowledge_clear)
