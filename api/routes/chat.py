"""AgentForge V2 — 对话路由：发送消息、SSE 流式响应。"""
from __future__ import annotations
import json
import logging
import time

from aiohttp import web

from core.models import UnifiedMessage

logger = logging.getLogger(__name__)


def _json(data: dict, status: int = 200) -> web.Response:
    return web.Response(
        text=json.dumps(data, ensure_ascii=False, default=str),
        content_type="application/json", status=status,
    )


def _get_log(request):
    """从 engine 获取 log_collector（可能为 None）。"""
    engine = request.app.get("engine")
    return getattr(engine, "_log_collector", None) if engine else None


def _get_user_field(request, body, field, default=""):
    """从 body 或 JWT 用户信息中提取字段。"""
    key = "sub" if field == "user_id" else field
    user = request.get("user") or {}
    return body.get(field) or (user.get(key, default) if isinstance(user, dict) else default)


async def _resolve_position_id(engine, body) -> str:
    """从 body 获取 position_id，如缺失则从 session 恢复。"""
    position_id = body.get("position_id", "")
    session_id = body.get("session_id", "")
    if not position_id and session_id and engine.session_store:
        session = await engine.session_store.get_session(session_id)
        if session:
            position_id = session.get("position_id", "")
    return position_id


async def _resolve_attachments(engine, request, body) -> list[dict]:
    """从 file_ids 解析附件内容。"""
    file_ids = body.get("file_ids", [])
    if not file_ids:
        return []
    from core.file_parser import extract_text
    user = request.get("user") or {}
    u_id = user.get("sub", "anonymous") if isinstance(user, dict) else "anonymous"
    o_id = user.get("org_id", "_default") if isinstance(user, dict) else "_default"
    # 按隔离目录查找，fallback 到全局
    dirs = [engine.root_dir / "data" / "uploads" / (o_id or "_default") / u_id,
            engine.root_dir / "data" / "uploads"]
    attachments = []
    for fid in file_ids[:5]:
        found = None
        for d in dirs:
            if not d.is_dir():
                continue
            exact = d / fid
            if exact.is_file():
                found = exact; break
            matches = list(d.glob(f"{fid}*"))
            if matches:
                found = matches[0]; break
        if found:
            try:
                text = await extract_text(str(found))
                attachments.append({"file_id": fid, "filename": found.name, "extracted_text": text[:5000] if text else ""})
            except Exception as e:
                attachments.append({"file_id": fid, "filename": found.name, "extracted_text": f"[解析失败: {e}]"})
    return attachments


async def handle_chat(request: web.Request) -> web.Response:
    """POST /api/v1/chat — 非流式对话"""
    engine = request.app["engine"]
    body = await request.json()

    content = body.get("content", "").strip()
    if not content:
        return _json({"error": "content 不能为空"}, status=400)

    attachments = await _resolve_attachments(engine, request, body)
    position_id = await _resolve_position_id(engine, body)

    msg = UnifiedMessage(
        content=content,
        user_id=_get_user_field(request, body, "user_id", "anonymous"),
        org_id=_get_user_field(request, body, "org_id"),
        session_id=body.get("session_id", ""),
        position_id=position_id,
        channel="api",
        attachments=attachments,
    )

    result = await engine.handle_message(msg)
    return _json(result)


async def handle_chat_stream(request: web.Request) -> web.StreamResponse:
    """POST /api/v1/chat/stream — SSE 流式对话"""
    engine = request.app["engine"]
    body = await request.json()

    content = body.get("content", "").strip()
    if not content:
        resp = web.StreamResponse(status=400)
        await resp.prepare(request)
        return resp

    position_id = await _resolve_position_id(engine, body)

    # ── 附件处理 ──
    attachments = await _resolve_attachments(engine, request, body)

    msg = UnifiedMessage(
        content=content,
        user_id=_get_user_field(request, body, "user_id", "anonymous"),
        org_id=_get_user_field(request, body, "org_id"),
        session_id=body.get("session_id", ""),
        position_id=position_id,
        channel="api",
        attachments=attachments,
        metadata={"web_search": body.get("web_search", False),
                  "tool_hint": (body.get("command_metadata") or {}).get("tool_hint", "")},
    )

    resp = web.StreamResponse(headers={
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
    })
    await resp.prepare(request)

    async def send_sse(event: str, data: dict) -> None:
        payload = f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
        await resp.write(payload.encode("utf-8"))

    lc = _get_log(request)
    if lc:
        lc.info("pipeline", "request_received", f"SSE 请求: {content[:60]}",
                data={"position_id": position_id, "has_files": bool(body.get("file_ids"))},
                user_id=msg.user_id, session_id=msg.session_id or "")
    try:
        position = engine._resolve_position(msg)
        await send_sse("thinking", {
            "agent_id": msg.position_id,
            "agent_name": position.display_name if position else msg.position_id,
            "model": "",
        })

        mission_id, tokens_used, model_used = "", 0, ""
        start_time = time.time()

        async for chunk in engine.handle_message_stream(msg):
            chunk_type = chunk.get("type", "")
            if chunk_type == "text":
                await send_sse("delta", {"content": chunk.get("text", "")})
            elif chunk_type == "tool_start":
                await send_sse("tool_start", {
                    "tool": chunk.get("name", ""),
                    "input": chunk.get("arguments", {}),
                })
            elif chunk_type == "tool_result":
                await send_sse("tool_result", {
                    "tool": chunk.get("name", ""),
                    "result": chunk.get("result", "")[:1000],
                })
            elif chunk_type == "done":
                mission_id = chunk.get("mission_id", "")
                tokens_used = chunk.get("tokens_used", 0)
                model_used = chunk.get("model", "")
                stream_session_id = chunk.get("session_id", "")

        duration_ms = int((time.time() - start_time) * 1000)
        if lc:
            lc.info("pipeline", "response_complete", "SSE 响应完成",
                    data={"mission_id": mission_id, "tokens_used": tokens_used,
                          "model": model_used, "duration_ms": duration_ms},
                    user_id=msg.user_id, session_id=stream_session_id or "",
                    duration=duration_ms / 1000)
        await send_sse("done", {
            "mission_id": mission_id,
            "session_id": stream_session_id,
            "agent_id": msg.position_id,
            "agent_name": position.display_name if position else "",
            "model": model_used,
            "tokens_used": tokens_used,
            "duration_ms": duration_ms,
        })

    except ConnectionResetError:
        pass
    except Exception as e:
        await send_sse("error", {"content": str(e)})

    return resp


def register(app: web.Application) -> None:
    app.router.add_post("/api/v1/chat", handle_chat)
    app.router.add_post("/api/v1/chat/stream", handle_chat_stream)
