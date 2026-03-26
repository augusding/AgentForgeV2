"""AgentForge V2 — 文件上传路由"""

import json
import logging
import os
from uuid import uuid4

from aiohttp import web

logger = logging.getLogger(__name__)

_MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB


def _json(data, status=200):
    return web.Response(
        text=json.dumps(data, ensure_ascii=False, default=str),
        content_type="application/json", status=status,
    )


async def handle_upload(request: web.Request) -> web.Response:
    """
    POST /api/v1/files/upload (multipart/form-data)
    字段: file (文件), target ("knowledge" | "chat"), doc_id (可选)
    """
    engine = request.app["engine"]
    user = request.get("user") or {}
    u_id = user.get("sub", "anonymous") if isinstance(user, dict) else "anonymous"
    o_id = user.get("org_id", "_default") if isinstance(user, dict) else "_default"
    upload_dir = engine.root_dir / "data" / "uploads" / (o_id or "_default") / u_id
    upload_dir.mkdir(parents=True, exist_ok=True)

    reader = await request.multipart()
    file_field = None
    file_path = None
    target = "chat"
    doc_id = ""

    async for field in reader:
        if field.name == "file":
            file_field = field
            filename = field.filename or f"upload_{uuid4().hex[:8]}"
            filename = filename.replace("/", "_").replace("\\", "_").replace("..", "_")
            file_path = upload_dir / f"{uuid4().hex[:8]}_{filename}"
            size = 0
            with open(file_path, "wb") as f:
                while True:
                    chunk = await field.read_chunk()
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > _MAX_FILE_SIZE:
                        os.unlink(file_path)
                        return _json({"error": f"文件超过大小限制 ({_MAX_FILE_SIZE // 1024 // 1024}MB)"}, 413)
                    f.write(chunk)
        elif field.name == "target":
            target = (await field.read()).decode("utf-8", errors="replace")
        elif field.name == "doc_id":
            doc_id = (await field.read()).decode("utf-8", errors="replace")

    if not file_field or not file_path or not file_path.exists():
        return _json({"error": "未收到文件"}, status=400)

    from core.file_parser import extract_text
    extracted = await extract_text(str(file_path))

    result = {
        "file_id": file_path.name,
        "filename": file_field.filename,
        "size": file_path.stat().st_size,
        "path": str(file_path),
        "extracted_length": len(extracted),
    }

    if target == "knowledge" and extracted and engine.knowledge_base:
        final_doc_id = doc_id or file_path.stem
        chunks = engine.knowledge_base.add_document(
            doc_id=final_doc_id,
            content=extracted,
            metadata={"source": "upload", "filename": file_field.filename},
            is_markdown=file_path.suffix.lower() == ".md",
        )
        result["knowledge"] = {"doc_id": final_doc_id, "chunks": chunks}

    if target == "chat":
        result["extracted_text"] = extracted[:3000]

    return _json(result)


async def handle_list_files(request: web.Request) -> web.Response:
    """GET /api/v1/files — 列出已上传的文件"""
    engine = request.app["engine"]
    user = request.get("user") or {}
    u_id = user.get("sub", "anonymous") if isinstance(user, dict) else "anonymous"
    o_id = user.get("org_id", "_default") if isinstance(user, dict) else "_default"
    upload_dir = engine.root_dir / "data" / "uploads" / (o_id or "_default") / u_id
    if not upload_dir.exists():
        return _json({"files": []})

    files = []
    for f in sorted(upload_dir.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if f.is_file():
            files.append({
                "file_id": f.stem,
                "filename": f.name,
                "size": f.stat().st_size,
                "modified": f.stat().st_mtime,
            })
    return _json({"files": files[:100]})


def register(app: web.Application) -> None:
    app.router.add_post("/api/v1/files/upload", handle_upload)
    app.router.add_get("/api/v1/files", handle_list_files)
