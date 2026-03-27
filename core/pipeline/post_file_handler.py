"""
AgentForge V2 — 后处理文件生成器

LLM 输出完成后，根据用户原始意图判断是否需要将内容保存为文件。
如果需要，自动调用对应工具创建文件。

设计原则：LLM 负责内容质量，系统负责呈现形式。
"""

from __future__ import annotations

import logging
import re
import uuid
from pathlib import Path

logger = logging.getLogger(__name__)

_FILE_INTENT_PATTERNS = [
    (r"(写|撰写|起草|生成|创建|做).{0,10}(邮件|报告|周报|月报|方案|文档|纪要|通知|公告|总结|规范|制度)", "docx"),
    (r"(整理|汇总|输出).{0,10}(到|为|成).{0,5}(word|文档|docx)", "docx"),
    (r"(帮我写|请写|写一).{0,10}(封|份|个|篇)", "docx"),
    (r"(生成|创建|做).{0,10}(表格|excel|xlsx|数据表)", "xlsx"),
    (r"(整理|汇总|输出).{0,10}(到|为|成).{0,5}(excel|表格|xlsx)", "xlsx"),
    (r"(生成|创建|做).{0,10}(ppt|演示|幻灯片|pptx)", "pptx"),
    (r"(整理|汇总|输出).{0,10}(到|为|成).{0,5}(ppt|pptx)", "pptx"),
]


def detect_file_intent(user_instruction: str) -> str | None:
    """检测用户指令是否隐含文件生成意图。返回 'docx'/'xlsx'/'pptx'/None。"""
    text = user_instruction.strip()
    for pattern, fmt in _FILE_INTENT_PATTERNS:
        if re.search(pattern, text):
            return fmt
    return None


def _extract_title(instruction: str) -> str:
    """从用户指令中提取简短标题。"""
    text = re.sub(r"^(帮我|请|麻烦|你来)(写|撰写|起草|生成|创建|做|整理)", "", instruction)
    text = re.sub(r"(一封|一份|一个|一篇)", "", text)
    text = text.strip()[:20]
    text = re.sub(r"[，。！？、；：""''（）\s]+$", "", text)
    return text or "文档"


async def auto_create_file(
    content: str,
    target_format: str,
    user_instruction: str,
    tools_registry,
) -> dict | None:
    """将 LLM 输出的内容自动保存为文件。返回 {name, result} 或 None。"""
    if not content or not content.strip():
        return None

    title = _extract_title(user_instruction)
    safe = "".join(c for c in title if c.isalnum() or c in "-_ ")[:30].strip() or "文档"
    stem = f"{uuid.uuid4().hex[:8]}_{safe}"

    if target_format == "docx":
        handler = tools_registry.get_handler("word_processor") if tools_registry else None
        if handler:
            result = await handler({"action": "create", "content": content, "path": f"data/outputs/{stem}.docx"})
            return {"name": "word_processor", "result": result}

    elif target_format == "xlsx":
        handler = tools_registry.get_handler("excel_processor") if tools_registry else None
        if handler:
            result = await handler({"action": "create", "data": content, "path": f"data/outputs/{stem}.xlsx"})
            return {"name": "excel_processor", "result": result}

    elif target_format == "pptx":
        handler = tools_registry.get_handler("document_converter") if tools_registry else None
        if handler:
            result = await handler({"content": content, "target_format": "pptx", "output_path": f"data/outputs/{stem}.pptx"})
            return {"name": "document_converter", "result": result}

    return None
