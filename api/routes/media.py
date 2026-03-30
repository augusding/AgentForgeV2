"""
AgentForge V2 — 多媒体处理路由（独立于 chat，不走 LLM tier）

POST /api/v1/media/process      处理图片/音频
GET  /api/v1/media/capabilities  查询可用能力
"""

import json
import logging
from pathlib import Path

from aiohttp import web

logger = logging.getLogger(__name__)


def _json(data, status=200):
    return web.Response(
        text=json.dumps(data, ensure_ascii=False, default=str),
        content_type="application/json", status=status)


async def handle_process(request: web.Request) -> web.Response:
    """POST /api/v1/media/process  Body: { "file_id", "mode": "ocr|vision|stt", "prompt"? }"""
    from core.media_processor import is_image, is_audio, ocr_extract, vision_understand, stt_transcribe

    engine = request.app["engine"]
    try:
        body = await request.json()
    except Exception:
        return _json({"error": "请求体不是合法 JSON"}, 400)

    file_id = body.get("file_id", "").strip()
    mode = body.get("mode", "").strip()
    prompt = body.get("prompt", "").strip() or "请详细描述这张图片的内容"

    if not file_id:
        return _json({"error": "file_id 不能为空"}, 400)
    if mode not in ("ocr", "vision", "stt"):
        return _json({"error": "mode 必须是 ocr / vision / stt"}, 400)

    user = request.get("user") or {}
    u_id = user.get("sub", "anonymous") if isinstance(user, dict) else "anonymous"
    o_id = user.get("org_id", "_default") if isinstance(user, dict) else "_default"
    dirs = [engine.root_dir / "data" / "uploads" / (o_id or "_default") / u_id,
            engine.root_dir / "data" / "uploads"]

    found = None
    for d in dirs:
        if not d.is_dir():
            continue
        exact = d / file_id
        if exact.is_file():
            found = exact; break
        matches = list(d.glob(f"{file_id}*"))
        if matches:
            found = matches[0]; break

    if not found:
        return _json({"error": f"文件不存在: {file_id}"}, 404)

    fp = Path(str(found))

    if mode == "ocr":
        if not is_image(fp):
            return _json({"error": "OCR 仅支持图片文件"}, 400)
        result = await ocr_extract(fp)
    elif mode == "vision":
        if not is_image(fp):
            return _json({"error": "AI 看图仅支持图片文件"}, 400)
        result = await vision_understand(fp, prompt)
    elif mode == "stt":
        if not is_audio(fp):
            return _json({"error": "语音转录仅支持音频文件"}, 400)
        result = await stt_transcribe(fp)
    else:
        return _json({"error": "未知模式"}, 400)

    return _json(result)


async def handle_capabilities(request: web.Request) -> web.Response:
    """GET /api/v1/media/capabilities"""
    from core.media_processor import get_capabilities
    return _json(get_capabilities())


def register(app: web.Application):
    app.router.add_post("/api/v1/media/process", handle_process)
    app.router.add_get("/api/v1/media/capabilities", handle_capabilities)
