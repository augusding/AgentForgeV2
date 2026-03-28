"""
WebAdapter：网页抓取连接器（双引擎）

fetch_mode=static  — aiohttp 直接 GET（默认，快速，静态页面）
fetch_mode=browser — playwright 无头浏览器（JS 渲染、登录墙）

cursor：已完成 URL 集合 JSON，跳过已成功 URL。
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
from typing import AsyncIterator

import aiohttp

from knowledge.connectors.base import BaseAdapter, RawDoc

logger = logging.getLogger(__name__)

_UA = "Mozilla/5.0 (compatible; AgentForge/2.0)"
_STATIC_HEADERS = {"User-Agent": _UA}
_STATIC_TIMEOUT = aiohttp.ClientTimeout(total=15)


class WebAdapter(BaseAdapter):
    connector_type = "web"

    def __init__(self, connector_id: str, config: dict):
        super().__init__(connector_id, config)
        raw_urls = config.get("urls", [])
        if isinstance(raw_urls, str):
            self._urls = [u.strip() for u in raw_urls.splitlines() if u.strip()]
        elif isinstance(raw_urls, list):
            self._urls = [u for u in raw_urls if u]
        else:
            self._urls = []
        self._extra_headers: dict = config.get("extra_headers", {})
        self._fetch_mode: str = config.get("fetch_mode", "static")
        self._wait_selector: str = config.get("wait_selector", "body")
        self._cookies: dict = config.get("cookies", {})
        self._page_timeout: int = int(config.get("page_timeout_ms", 15000))

    def get_config_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "urls": {"type": "array", "title": "URL 列表", "items": {"type": "string"},
                         "description": "需要抓取的页面 URL"},
                "fetch_mode": {"type": "string", "title": "抓取模式", "default": "static",
                               "description": "static（快速）/ browser（JS渲染）"},
                "extra_headers": {"type": "object", "title": "自定义请求头",
                                  "description": "Cookie、Authorization 等（static 模式）"},
                "wait_selector": {"type": "string", "title": "等待选择器（browser）",
                                  "default": "body", "description": "等待此 CSS 选择器出现"},
                "cookies": {"type": "object", "title": "注入 Cookies（browser）",
                             "description": "名称→值，用于跳过登录"},
                "page_timeout_ms": {"type": "number", "title": "页面超时 ms（browser）", "default": 15000},
            },
            "required": ["urls"],
        }

    async def validate(self) -> tuple[bool, str]:
        if not self._urls:
            return False, "urls 列表为空"
        if self._fetch_mode == "browser":
            return await self._validate_browser()
        try:
            headers = {**_STATIC_HEADERS, **self._extra_headers}
            async with aiohttp.ClientSession(headers=headers) as s:
                async with s.get(self._urls[0], timeout=aiohttp.ClientTimeout(total=8), ssl=True) as r:
                    if r.status < 400:
                        return True, f"静态模式 HTTP {r.status}，共 {len(self._urls)} 个 URL"
                    return False, f"HTTP {r.status}"
        except Exception as e:
            return False, str(e)

    async def _validate_browser(self) -> tuple[bool, str]:
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            return False, "browser 模式需要: pip install playwright && playwright install chromium"
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page(user_agent=_UA)
                await page.goto(self._urls[0], timeout=self._page_timeout, wait_until="domcontentloaded")
                title = await page.title()
                await browser.close()
                return True, f"浏览器模式成功，标题: {title}，共 {len(self._urls)} 个 URL"
        except Exception as e:
            return False, f"浏览器模式失败: {e}"

    async def extract(self, cursor: str | None) -> AsyncIterator[RawDoc]:
        done: set[str] = set()
        if cursor:
            try: done = set(json.loads(cursor))
            except Exception: pass
        pending = [u for u in self._urls if u not in done]
        logger.info("WebAdapter(%s): %d 待处理（已完成 %d）", self._fetch_mode, len(pending), len(done))
        if self._fetch_mode == "browser":
            async for doc in self._extract_browser(pending, done):
                yield doc
        else:
            async for doc in self._extract_static(pending, done):
                yield doc

    # ── static 模式 ─────────────────────────────────────────

    async def _extract_static(self, urls: list[str], done: set[str]) -> AsyncIterator[RawDoc]:
        import asyncio
        headers = {**_STATIC_HEADERS, **self._extra_headers}
        async with aiohttp.ClientSession(headers=headers) as sess:
            batch: list[str] = []
            for url in urls:
                batch.append(url)
                if len(batch) >= 10:
                    async for doc in self._static_batch(sess, batch, done):
                        yield doc
                    batch = []
                    await asyncio.sleep(0.3)
            if batch:
                async for doc in self._static_batch(sess, batch, done):
                    yield doc

    async def _static_batch(self, sess, urls: list[str], done: set[str]) -> AsyncIterator[RawDoc]:
        for url in urls:
            try:
                async with sess.get(url, timeout=_STATIC_TIMEOUT, ssl=True, allow_redirects=True) as r:
                    if r.status >= 400: continue
                    html = await r.text(errors="replace")
                text = self._html_to_text(html)
                if len(text.strip()) < 50: continue
                doc = self._make_doc(url, text, self._extract_title(html))
                done.add(url)
                doc.extra_meta["cursor"] = json.dumps(list(done))
                yield doc
            except Exception as e:
                logger.warning("静态抓取失败: %s — %s", url, e)

    # ── browser 模式 ────────────────────────────────────────

    async def _extract_browser(self, urls: list[str], done: set[str]) -> AsyncIterator[RawDoc]:
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            logger.error("playwright 未安装")
            return
        import asyncio
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(user_agent=_UA, ignore_https_errors=True)
            if self._cookies:
                from urllib.parse import urlparse
                domain = urlparse(urls[0]).netloc
                await context.add_cookies([{"name": k, "value": v, "domain": domain, "path": "/"} for k, v in self._cookies.items()])
            for url in urls:
                try:
                    page = await context.new_page()
                    await page.goto(url, timeout=self._page_timeout, wait_until="domcontentloaded")
                    if self._wait_selector and self._wait_selector != "body":
                        try: await page.wait_for_selector(self._wait_selector, timeout=5000)
                        except Exception: pass
                    title = await page.title()
                    content = await page.inner_text("body")
                    await page.close()
                    if len(content.strip()) < 50: continue
                    doc = self._make_doc(url, content.strip(), title)
                    done.add(url)
                    doc.extra_meta["cursor"] = json.dumps(list(done))
                    yield doc
                    await asyncio.sleep(0.5)
                except Exception as e:
                    logger.warning("browser 抓取失败: %s — %s", url, e)
            await browser.close()

    # ── 工具方法 ────────────────────────────────────────────

    def _make_doc(self, url: str, text: str, title: str = "") -> RawDoc:
        return RawDoc(doc_id=f"web_{hashlib.md5(url.encode()).hexdigest()[:16]}",
                      content=text, title=title or url, source_url=url, source_type="web",
                      content_hash=hashlib.md5(text.encode()).hexdigest(),
                      extra_meta={"url": url, "fetch_mode": self._fetch_mode})

    @staticmethod
    def _html_to_text(html: str) -> str:
        t = re.sub(r"<(script|style|nav|footer|header)[^>]*>.*?</\1>", "", html, flags=re.DOTALL | re.IGNORECASE)
        t = re.sub(r"<[^>]+>", " ", t)
        return re.sub(r"\s+", " ", t).strip()

    @staticmethod
    def _extract_title(html: str) -> str:
        m = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
        return m.group(1).strip() if m else ""
