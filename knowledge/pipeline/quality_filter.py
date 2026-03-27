"""
QualityFilter：数据质量检测与过滤

检测顺序：
  1. 内容过短（< 50 字符）→ 丢弃
  2. 乱码检测（非可打印字符占比 > 30%）→ 尝试修复，失败则丢弃
  3. HTML 噪音（web 来源，标签/总字符 > 30%）→ 剥离后再判
  4. 内容 hash 去重（MD5）→ 跳过（skipped=True）
  5. 语言检测 → 写入 RawDoc.lang
  6. 质量评分（0.0-1.0）→ 写入 RawDoc.quality_score
"""
from __future__ import annotations

import hashlib
import logging
import re
import unicodedata
from dataclasses import replace

from knowledge.connectors.base import RawDoc

logger = logging.getLogger(__name__)

MIN_CHARS = 50
MIN_SCORE = 0.2
HTML_NOISE_RATIO = 0.3
GARBAGE_RATIO = 0.3


class FilterResult:
    __slots__ = ("doc", "reason", "skipped")

    def __init__(self, doc: "RawDoc | None", reason: str, skipped: bool = False):
        self.doc = doc
        self.reason = reason
        self.skipped = skipped


class QualityFilter:

    def __init__(self, known_hashes: set[str] | None = None):
        self._known: set[str] = known_hashes or set()

    def filter(self, doc: RawDoc) -> FilterResult:
        content = doc.content or ""

        if len(content.strip()) < MIN_CHARS:
            return FilterResult(None, f"too_short:{len(content)}")

        gr = self._garbage_ratio(content)
        if gr > GARBAGE_RATIO:
            content = self._clean_garbage(content)
            if self._garbage_ratio(content) > GARBAGE_RATIO:
                return FilterResult(None, f"garbage:{gr:.2f}")

        if doc.source_type == "web" and self._html_noisy(content):
            content = self._strip_html(content)
            if len(content.strip()) < MIN_CHARS:
                return FilterResult(None, "html_stripped_too_short")

        h = hashlib.md5(content.encode()).hexdigest()
        if h in self._known:
            return FilterResult(None, "unchanged", skipped=True)

        lang = self._detect_lang(content)
        score = self._score(content, gr)
        if score < MIN_SCORE:
            return FilterResult(None, f"low_quality:{score:.2f}")

        self._known.add(h)
        updated = replace(doc, content=content, content_hash=h,
                          lang=lang, quality_score=round(score, 3))
        return FilterResult(updated, "ok")

    def add_known(self, h: str) -> None:
        self._known.add(h)

    @staticmethod
    def _garbage_ratio(text: str) -> float:
        if not text:
            return 1.0
        bad = sum(1 for c in text
                  if unicodedata.category(c) in ("Cc", "Cs", "Co", "Cn")
                  and c not in "\n\t\r")
        return bad / len(text)

    @staticmethod
    def _clean_garbage(text: str) -> str:
        return "".join(c for c in text
                       if unicodedata.category(c) not in ("Cc", "Cs", "Co", "Cn")
                       or c in "\n\t")

    @staticmethod
    def _html_noisy(text: str) -> bool:
        tags = len(re.findall(r"<[^>]+>", text))
        return len(text) > 0 and tags / len(text) > HTML_NOISE_RATIO

    @staticmethod
    def _strip_html(text: str) -> str:
        text = re.sub(r"<(script|style|nav|footer|header)[^>]*>.*?</\1>",
                      "", text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<[^>]+>", " ", text)
        return re.sub(r"\s+", " ", text).strip()

    @staticmethod
    def _detect_lang(text: str) -> str:
        """精准语言检测：优先 langdetect，回退字符统计。"""
        sample = text[:1000].strip()
        if not sample:
            return ""
        try:
            from langdetect import detect
            lang = detect(sample)
            return "zh" if lang in ("zh-cn", "zh-tw", "zh") else lang
        except Exception:
            pass
        zh = sum(1 for c in sample if "\u4e00" <= c <= "\u9fff")
        if zh / len(sample) > 0.15:
            return "zh"
        en = sum(1 for c in sample if c.isascii() and c.isalpha())
        return "en" if en / len(sample) > 0.4 else ""

    @staticmethod
    def _score(text: str, gr: float) -> float:
        s = 1.0 - gr * 2
        if len(text) < 200:
            s -= 0.2
        words = text.split()
        if words and len(set(words)) / len(words) < 0.2:
            s -= 0.3
        return max(0.0, min(1.0, s))
