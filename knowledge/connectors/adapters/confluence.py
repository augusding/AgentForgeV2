"""
ConfluenceAdapter：Confluence 知识库连接器

支持 Cloud 和 Server。认证：API Token / Basic Auth。
cursor：ISO 8601 时间戳，只拉取 lastModified > cursor 的页面。
"""
from __future__ import annotations

import hashlib
import logging
import re
from datetime import datetime, timezone
from typing import AsyncIterator

import aiohttp

from knowledge.connectors.base import BaseAdapter, RawDoc

logger = logging.getLogger(__name__)

_TIMEOUT = aiohttp.ClientTimeout(total=30)
_PAGE_LIMIT = 50


class ConfluenceAdapter(BaseAdapter):
    connector_type = "confluence"

    def __init__(self, cid: str, config: dict):
        super().__init__(cid, config)
        self._base_url = config.get("base_url", "").rstrip("/")
        self._email = config.get("email", "")
        self._api_token = config.get("api_token", "")
        self._space_keys: list[str] = config.get("space_keys", [])

    def get_config_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "base_url": {"type": "string", "title": "Confluence 地址",
                             "description": "如 https://yourcompany.atlassian.net"},
                "email": {"type": "string", "title": "账号邮箱",
                           "description": "Cloud 填邮箱，Server 填用户名"},
                "api_token": {"type": "string", "title": "API Token / 密码",
                               "description": "Cloud: API Token；Server: 密码"},
                "space_keys": {"type": "array", "title": "Space Key 列表",
                                "items": {"type": "string"},
                                "description": "留空则同步所有空间"},
            },
            "required": ["base_url", "email", "api_token"],
        }

    def _auth(self) -> aiohttp.BasicAuth:
        return aiohttp.BasicAuth(self._email, self._api_token)

    async def validate(self) -> tuple[bool, str]:
        if not self._base_url or not self._email or not self._api_token:
            return False, "base_url / email / api_token 均为必填"
        url = f"{self._base_url}/rest/api/space"
        try:
            async with aiohttp.ClientSession(auth=self._auth()) as s:
                async with s.get(url, params={"limit": 1},
                                  timeout=aiohttp.ClientTimeout(total=10), ssl=True) as r:
                    if r.status == 401:
                        return False, "认证失败，请检查邮箱和 API Token"
                    if r.status == 403:
                        return False, "权限不足"
                    if r.status >= 400:
                        return False, f"HTTP {r.status}"
                    data = await r.json()
                    total = data.get("size", 0)
                    scope = f"指定空间: {self._space_keys}" if self._space_keys else f"全部 {total} 个空间"
                    return True, f"连接成功，{scope}"
        except Exception as e:
            return False, f"连接失败: {e}"

    async def extract(self, cursor: str | None) -> AsyncIterator[RawDoc]:
        spaces = self._space_keys or await self._list_all_spaces()
        logger.info("ConfluenceAdapter: %d 个空间，cursor=%s", len(spaces), cursor)
        import asyncio
        for space_key in spaces:
            async for doc in self._extract_space(space_key, cursor):
                yield doc
            await asyncio.sleep(0.3)

    async def _list_all_spaces(self) -> list[str]:
        url = f"{self._base_url}/rest/api/space"
        keys: list[str] = []
        start = 0
        async with aiohttp.ClientSession(auth=self._auth()) as s:
            while True:
                async with s.get(url, params={"limit": 50, "start": start},
                                  timeout=_TIMEOUT, ssl=True) as r:
                    if r.status >= 400:
                        break
                    data = await r.json()
                    keys.extend(sp["key"] for sp in data.get("results", []))
                    if not data.get("_links", {}).get("next"):
                        break
                    start += 50
        return keys

    async def _extract_space(self, space_key: str, cursor: str | None) -> AsyncIterator[RawDoc]:
        url = f"{self._base_url}/rest/api/content"
        params: dict = {"spaceKey": space_key, "type": "page", "status": "current",
                        "expand": "body.storage,version,history.lastUpdated",
                        "limit": _PAGE_LIMIT, "start": 0}
        import asyncio
        async with aiohttp.ClientSession(auth=self._auth()) as s:
            while True:
                async with s.get(url, params=params, timeout=_TIMEOUT, ssl=True) as r:
                    if r.status >= 400:
                        break
                    data = await r.json()
                for page in data.get("results", []):
                    doc = self._page_to_doc(page, space_key, cursor)
                    if doc:
                        yield doc
                if not data.get("_links", {}).get("next"):
                    break
                params["start"] = params["start"] + _PAGE_LIMIT
                await asyncio.sleep(0.2)

    def _page_to_doc(self, page: dict, space_key: str, cursor: str | None) -> RawDoc | None:
        try:
            page_id = page.get("id", "")
            title = page.get("title", "")
            last_updated = page.get("history", {}).get("lastUpdated", {}).get("when", "")
            if cursor and last_updated:
                try:
                    lu_ts = datetime.fromisoformat(last_updated.replace("Z", "+00:00")).timestamp()
                    cursor_ts = datetime.fromisoformat(cursor.replace("Z", "+00:00")).timestamp()
                    if lu_ts <= cursor_ts:
                        return None
                except Exception:
                    pass
            storage = page.get("body", {}).get("storage", {}).get("value", "")
            content = self._storage_to_text(storage)
            if not content.strip():
                return None
            url = f"{self._base_url}/wiki/spaces/{space_key}/pages/{page_id}"
            now_iso = datetime.now(timezone.utc).isoformat()
            return RawDoc(
                doc_id=f"confluence_{hashlib.md5(page_id.encode()).hexdigest()[:16]}",
                content=content, title=title, source_url=url, source_type="confluence",
                content_hash=hashlib.md5(content.encode()).hexdigest(),
                extra_meta={"page_id": page_id, "space_key": space_key,
                            "last_updated": last_updated, "cursor": now_iso},
            )
        except Exception as e:
            logger.warning("页面转换失败: %s", e)
            return None

    @staticmethod
    def _storage_to_text(storage: str) -> str:
        text = re.sub(r"<ac:[^>]+>.*?</ac:[^>]+>", " ", storage, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<ac:[^/]*/?>", " ", text, flags=re.IGNORECASE)
        text = re.sub(r"<[^>]+>", " ", text)
        text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&nbsp;", " ").replace("&quot;", '"')
        return re.sub(r"\s+", " ", text).strip()
