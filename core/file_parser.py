"""AgentForge V2 — 文件解析器，从上传文件中提取文本。"""

from __future__ import annotations

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_MAX_TEXT = 50000


async def extract_text(file_path: str) -> str:
    """从文件提取文本内容。返回提取到的文本，失败返回空字符串。"""
    path = Path(file_path)
    if not path.is_file():
        return ""

    suffix = path.suffix.lower()
    try:
        if suffix in (".txt", ".md", ".csv", ".log"):
            return path.read_text(encoding="utf-8", errors="replace")[:_MAX_TEXT]
        elif suffix == ".json":
            data = json.loads(path.read_text(encoding="utf-8"))
            return json.dumps(data, ensure_ascii=False, indent=2)[:_MAX_TEXT]
        elif suffix == ".pdf":
            return _extract_pdf(path)
        elif suffix == ".docx":
            return _extract_docx(path)
        else:
            logger.debug("不支持的文件类型: %s", suffix)
            return ""
    except Exception as e:
        logger.warning("文件解析失败 [%s]: %s", file_path, e)
        return ""


def _extract_pdf(path: Path) -> str:
    try:
        import pdfplumber
        texts = []
        with pdfplumber.open(str(path)) as pdf:
            for page in pdf.pages[:100]:
                t = page.extract_text() or ""
                if t.strip():
                    texts.append(t)
        return "\n\n".join(texts)[:_MAX_TEXT]
    except ImportError:
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(str(path))
            texts = [page.extract_text() or "" for page in reader.pages[:100]]
            return "\n\n".join(t for t in texts if t.strip())[:_MAX_TEXT]
        except ImportError:
            return ""


def _extract_docx(path: Path) -> str:
    try:
        from docx import Document
        doc = Document(str(path))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())[:_MAX_TEXT]
    except ImportError:
        return ""
