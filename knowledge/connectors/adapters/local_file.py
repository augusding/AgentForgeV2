"""LocalFileAdapter：本地文件系统连接器。cursor = mtime 时间戳，增量只处理新文件。"""
from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import AsyncIterator

from knowledge.connectors.base import BaseAdapter, RawDoc

logger = logging.getLogger(__name__)

SUPPORTED = {".txt", ".md", ".pdf", ".docx", ".csv", ".json"}


class LocalFileAdapter(BaseAdapter):
    connector_type = "local_file"

    def __init__(self, connector_id: str, config: dict):
        super().__init__(connector_id, config)
        self._dir = config.get("directory", "")
        self._recursive = config.get("recursive", True)
        self._exts = set(config.get("extensions", list(SUPPORTED)))
        self._max_mb = config.get("max_file_size_mb", 50)

    def get_config_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "directory": {"type": "string", "title": "目录路径", "description": "本地文件夹绝对路径"},
                "recursive": {"type": "boolean", "title": "包含子目录", "default": True},
                "extensions": {"type": "array", "title": "文件类型", "items": {"type": "string"}, "default": list(SUPPORTED)},
                "max_file_size_mb": {"type": "number", "title": "最大文件大小（MB）", "default": 50},
            },
            "required": ["directory"],
        }

    async def validate(self) -> tuple[bool, str]:
        if not self._dir:
            return False, "directory 未配置"
        p = Path(self._dir)
        if not p.exists() or not p.is_dir():
            return False, f"目录不存在: {self._dir}"
        n = len(self._collect(None))
        return True, f"目录可访问，找到 {n} 个支持文件"

    async def extract(self, cursor: str | None) -> AsyncIterator[RawDoc]:
        since = float(cursor) if cursor else None
        files = self._collect(since)
        logger.info("LocalFile: %d 个文件待处理 (since=%s)", len(files), cursor)
        import asyncio
        batch: list[Path] = []
        for f in files:
            batch.append(f)
            if len(batch) >= 50:
                async for doc in self._process(batch):
                    yield doc
                batch = []
                await asyncio.sleep(0.3)
        if batch:
            async for doc in self._process(batch):
                yield doc

    def _collect(self, since: float | None) -> list[Path]:
        p = Path(self._dir)
        if not p.exists():
            return []
        glob = "**/*" if self._recursive else "*"
        result = []
        for f in p.glob(glob):
            if not f.is_file() or f.suffix.lower() not in self._exts:
                continue
            if f.stat().st_size / 1024 / 1024 > self._max_mb:
                continue
            if since and f.stat().st_mtime <= since:
                continue
            result.append(f)
        return sorted(result)

    async def _process(self, files: list[Path]) -> AsyncIterator[RawDoc]:
        for f in files:
            try:
                content = await self._extract_text(f)
                if not content:
                    continue
                sp = str(f)
                mtime = f.stat().st_mtime
                yield RawDoc(
                    doc_id=f"local_{hashlib.md5(sp.encode()).hexdigest()[:16]}",
                    content=content, title=f.name, source_url=sp,
                    source_type="local_file",
                    content_hash=hashlib.md5(content.encode()).hexdigest(),
                    extra_meta={"filename": f.name, "file_path": sp,
                                "mtime": mtime, "cursor": str(mtime)},
                )
            except Exception as e:
                logger.warning("文件处理失败: %s — %s", f, e)

    @staticmethod
    async def _extract_text(path: Path) -> str:
        try:
            from core.file_parser import extract_text
            return await extract_text(str(path))
        except Exception as e:
            logger.error("文本提取失败: %s — %s", path, e)
            return ""
