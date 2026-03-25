"""
AgentForge V2 — 文档分块器

将文档拆分为适合 embedding 的块。
支持 Markdown 结构感知 + 中文友好的分割。
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class Chunk:
    """文档块。"""
    content: str
    metadata: dict = field(default_factory=dict)
    index: int = 0


class DocumentChunker:
    """
    结构感知文档分块器。

    优先按标题 / 段落边界分割，回退到字符数分割。
    """

    def __init__(self, chunk_size: int = 500, overlap: int = 100):
        self.chunk_size = chunk_size
        self.overlap = overlap

    def chunk_text(self, text: str, metadata: dict | None = None) -> list[Chunk]:
        """将纯文本分块。"""
        if not text.strip():
            return []

        meta = metadata or {}
        # 先按段落分割
        paragraphs = self._split_paragraphs(text)
        chunks = self._merge_paragraphs(paragraphs)

        result = []
        for i, content in enumerate(chunks):
            result.append(Chunk(content=content, metadata={**meta, "chunk_index": i}, index=i))
        return result

    def chunk_markdown(self, text: str, metadata: dict | None = None) -> list[Chunk]:
        """按 Markdown 标题结构分块。"""
        if not text.strip():
            return []

        meta = metadata or {}
        sections = self._split_by_headers(text)

        result = []
        for i, (header, content) in enumerate(sections):
            full_text = f"{header}\n{content}" if header else content
            if len(full_text) <= self.chunk_size:
                result.append(Chunk(
                    content=full_text,
                    metadata={**meta, "section": header, "chunk_index": i},
                    index=i,
                ))
            else:
                # 超长 section 再按段落拆分
                sub_chunks = self.chunk_text(full_text, meta)
                for sc in sub_chunks:
                    sc.metadata["section"] = header
                    sc.index = len(result)
                    result.append(sc)
        return result

    def _split_paragraphs(self, text: str) -> list[str]:
        """按空行分割段落。"""
        paragraphs = re.split(r'\n\s*\n', text)
        return [p.strip() for p in paragraphs if p.strip()]

    def _merge_paragraphs(self, paragraphs: list[str]) -> list[str]:
        """将小段落合并到 chunk_size 以内。"""
        chunks = []
        current = ""

        for para in paragraphs:
            if len(current) + len(para) + 1 <= self.chunk_size:
                current = f"{current}\n{para}" if current else para
            else:
                if current:
                    chunks.append(current)
                if len(para) > self.chunk_size:
                    # 超长段落强制切分
                    for sub in self._force_split(para):
                        chunks.append(sub)
                    current = ""
                else:
                    current = para

        if current:
            chunks.append(current)
        return chunks

    def _force_split(self, text: str) -> list[str]:
        """强制按字符数切分（带 overlap）。"""
        chunks = []
        start = 0
        while start < len(text):
            end = start + self.chunk_size
            chunk = text[start:end]
            # 尝试在句号/换行处断开
            for sep in ['。', '！', '？', '\n', '；', '.', '!', '?']:
                last = chunk.rfind(sep)
                if last > self.chunk_size // 2:
                    chunk = chunk[:last + 1]
                    end = start + last + 1
                    break
            chunks.append(chunk)
            start = end - self.overlap
        return chunks

    @staticmethod
    def _split_by_headers(text: str) -> list[tuple[str, str]]:
        """按 Markdown 标题分割。返回 [(header, content), ...]。"""
        lines = text.split('\n')
        sections: list[tuple[str, str]] = []
        current_header = ""
        current_lines: list[str] = []

        for line in lines:
            if re.match(r'^#{1,4}\s+', line):
                if current_lines or current_header:
                    sections.append((current_header, '\n'.join(current_lines).strip()))
                current_header = line.strip()
                current_lines = []
            else:
                current_lines.append(line)

        if current_lines or current_header:
            sections.append((current_header, '\n'.join(current_lines).strip()))

        return sections
