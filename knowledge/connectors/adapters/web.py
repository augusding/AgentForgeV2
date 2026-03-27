"""WebAdapter：静态网页抓取。cursor = 已完成 URL 集合 JSON。强制 SSL。"""
from __future__ import annotations

import hashlib
import json
import logging
import re
from typing import AsyncIterator

import aiohttp

from knowledge.connectors.base import BaseAdapter, RawDoc

logger = logging.getLogger(__name__)

_UA = {"User-Agent": "Mozilla/5.0 (compatible; AgentForge/2.0)"}
_TIMEOUT = aiohttp.ClientTimeout(total=15)


class WebAdapter(BaseAdapter):
    connector_type = "web"

    def __init__(self, cid: str, config: dict):
        super().__init__(cid, config)
        self._urls: list[str] = config.get("urls", [])
        self._extra: dict = config.get("extra_headers", {})

    def get_config_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "urls": {"type": "array", "title": "URL 列表", "items": {"type": "string"},
                         "description": "需要抓取的页面 URL"},
                "extra_headers": {"type": "object", "title": "自定义请求头",
                                  "description": "如需认证 Cookie 等"},
            },
            "required": ["urls"],
        }

    async def validate(self) -> tuple[bool, str]:
        if not self._urls:
            return False, "urls 列表为空"
        try:
            async with aiohttp.ClientSession(headers=_UA) as s:
                async with s.get(self._urls[0], timeout=aiohttp.ClientTimeout(total=8), ssl=True) as r:
                    if r.status < 400:
                        return True, f"HTTP {r.status}，共 {len(self._urls)} 个 URL"
                    return False, f"HTTP {r.status}: {self._urls[0]}"
        except Exception as e:
            return False, str(e)

    async def extract(self, cursor: str | None) -> AsyncIterator[RawDoc]:
        done: set[str] = set()
        if cursor:
            try:
                done = set(json.loads(cursor))
            except Exception:
                pass
        pending = [u for u in self._urls if u not in done]
        logger.info("WebAdapter: %d 个 URL 待抓取（已完成 %d）", len(pending), len(done))
        import asyncio
        hdrs = {**_UA, **self._extra}
        async with aiohttp.ClientSession(headers=hdrs) as sess:
            batch: list[str] = []
            for url in pending:
                batch.append(url)
                if len(batch) >= 10:
                    async for doc in self._do_batch(sess, batch, done):
                        yield doc
                    batch = []
                    await asyncio.sleep(0.3)
            if batch:
                async for doc in self._do_batch(sess, batch, done):
                    yield doc

    async def _do_batch(self, sess, urls: list[str], done: set[str]) -> AsyncIterator[RawDoc]:
        for url in urls:
            try:
                doc = await self._fetch(sess, url)
                if doc:
                    done.add(url)
                    doc.extra_meta["cursor"] = json.dumps(list(done))
                    yield doc
            except Exception as e:
                logger.warning("抓取失败: %s — %s", url, e)

    async def _fetch(self, sess: aiohttp.ClientSession, url: str) -> RawDoc | None:
        async with sess.get(url, timeout=_TIMEOUT, ssl=True, allow_redirects=True) as r:
            if r.status >= 400:
                return None
            html = await r.text(errors="replace")
        text = self._to_text(html)
        if len(text.strip()) < 50:
            return None
        return RawDoc(
            doc_id=f"web_{hashlib.md5(url.encode()).hexdigest()[:16]}",
            content=text, title=self._title(html) or url,
            source_url=url, source_type="web",
            content_hash=hashlib.md5(text.encode()).hexdigest(),
            extra_meta={"url": url},
        )

    @staticmethod
    def _to_text(html: str) -> str:
        t = re.sub(r"<(script|style|nav|footer|header)[^>]*>.*?</\1>",
                   "", html, flags=re.DOTALL | re.IGNORECASE)
        t = re.sub(r"<[^>]+>", " ", t)
        return re.sub(r"\s+", " ", t).strip()

    @staticmethod
    def _title(html: str) -> str:
        m = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
        return m.group(1).strip() if m else ""
