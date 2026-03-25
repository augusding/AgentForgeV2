"""
AgentForge V2 — WebSocket 网关

用于推送通知事件（工位更新、审批提醒等），不用于聊天。
通过 aiohttp 的 WebSocket 支持实现，与 HTTP 共用同一端口。
"""

from __future__ import annotations

import json
import logging
import time

from aiohttp import web, WSMsgType

logger = logging.getLogger(__name__)


class WebSocketGateway:
    """WebSocket 推送网关。"""

    def __init__(self):
        self._clients: dict[str, set[web.WebSocketResponse]] = {}
        self._all_clients: set[web.WebSocketResponse] = set()

    async def handle_ws(self, request: web.Request) -> web.WebSocketResponse:
        """GET /ws — WebSocket 连接入口"""
        ws = web.WebSocketResponse(heartbeat=30)
        await ws.prepare(request)

        user_id = ""
        self._all_clients.add(ws)
        logger.info("WS 客户端连接: %s", request.remote)

        try:
            async for msg in ws:
                if msg.type == WSMsgType.TEXT:
                    try:
                        data = json.loads(msg.data)
                    except json.JSONDecodeError:
                        await ws.send_json({"type": "error", "message": "无效 JSON"})
                        continue

                    msg_type = data.get("type", "")

                    if msg_type == "auth":
                        user_id = data.get("user_id", "")
                        if user_id:
                            self._clients.setdefault(user_id, set()).add(ws)
                            await ws.send_json({"type": "auth_ok", "user_id": user_id})

                    elif msg_type in ("heartbeat", "ping"):
                        await ws.send_json({"type": "pong", "ts": time.time()})

                elif msg.type in (WSMsgType.ERROR, WSMsgType.CLOSE):
                    break

        except Exception as e:
            if "close" not in type(e).__name__.lower():
                logger.error("WS 异常: %s", e)
        finally:
            self._all_clients.discard(ws)
            if user_id and user_id in self._clients:
                self._clients[user_id].discard(ws)
                if not self._clients[user_id]:
                    del self._clients[user_id]
            logger.info("WS 客户端断开: %s (user=%s)", request.remote, user_id)

        return ws

    async def push_to_user(self, user_id: str, event: dict) -> int:
        """向指定用户推送事件。返回送达数。"""
        clients = self._clients.get(user_id, set())
        sent = 0
        dead = []
        for ws in clients:
            try:
                await ws.send_json(event)
                sent += 1
            except Exception:
                dead.append(ws)
        for ws in dead:
            clients.discard(ws)
        return sent

    async def broadcast(self, event: dict) -> int:
        """广播事件给所有连接。"""
        sent = 0
        dead = []
        for ws in self._all_clients:
            try:
                await ws.send_json(event)
                sent += 1
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._all_clients.discard(ws)
        return sent

    @property
    def connection_count(self) -> int:
        return len(self._all_clients)
