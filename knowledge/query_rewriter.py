"""
AgentForgeV2 — 查询改写

将模糊查询（"上次的方案"、"那个文档"）改写为适合向量检索的具体查询。
结合对话历史提取关键词，去除指代词。

仅在检测到模糊查询时触发，避免不必要的 LLM 调用。
"""

from __future__ import annotations

import asyncio
import logging
import re

logger = logging.getLogger(__name__)

# 模糊指代词
_VAGUE_INDICATORS = [
    "这个", "那个", "上次", "之前", "刚才", "刚刚",
    "它", "他们", "这些", "那些", "前面", "上面",
    "我们讨论的", "你说的", "提到的",
]

# 过短的查询也可能需要改写
_MIN_SPECIFIC_LENGTH = 6


def needs_rewrite(query: str) -> bool:
    """判断查询是否需要改写。"""
    q = query.strip()
    # 过短
    if len(q) < _MIN_SPECIFIC_LENGTH:
        return True
    # 包含模糊指代词
    for indicator in _VAGUE_INDICATORS:
        if indicator in q:
            return True
    return False


async def rewrite_query(
    original_query: str,
    history: list[dict],
    llm_client,
) -> str:
    """
    用 LLM 改写模糊查询为具体的检索关键词。

    参数：
        original_query: 用户的原始消息
        history: 对话历史（LLM 格式的 messages）
        llm_client: LLMClient 实例

    返回：
        改写后的查询字符串（如果不需要改写或改写失败，返回原始查询）

    示例：
        "上次说的那个方案" + 历史["讨论了Q2广告优化方案"]
        → "Q2广告优化方案"
    """
    if not needs_rewrite(original_query):
        return original_query

    if not history:
        return original_query

    # 取最近 3 轮对话（6 条消息）作为上下文
    recent = history[-6:] if len(history) > 6 else history
    context_lines = []
    for m in recent:
        role = "用户" if m.get("role") == "user" else "助手"
        content = m.get("content", "")
        if isinstance(content, str):
            context_lines.append(f"{role}: {content[:120]}")
        elif isinstance(content, list):
            # multimodal 格式
            text_parts = [c.get("text", "") for c in content if c.get("type") == "text"]
            context_lines.append(f"{role}: {''.join(text_parts)[:120]}")

    if not context_lines:
        return original_query

    context_text = "\n".join(context_lines)

    prompt = (
        f"根据对话上下文，将用户最新问题改写为适合知识库检索的查询。\n"
        f"要求：提取核心关键词，去除指代词（这个/那个/上次），保留专有名词。\n"
        f"只输出改写后的查询，不解释。如果无法改写，原样返回。\n\n"
        f"对话上下文：\n{context_text}\n\n"
        f"用户最新问题：{original_query}\n\n"
        f"改写后的检索查询："
    )

    try:
        response = await asyncio.wait_for(
            llm_client.chat(
                system="你是一个查询改写器。只输出改写后的查询，不解释。",
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                max_tokens=80,
                model_override="qwen-plus",  # 用最便宜的模型
            ),
            timeout=5,  # 最多 5 秒
        )
        rewritten = response.content.strip().strip('"').strip("'")
        if rewritten and len(rewritten) > 1:
            logger.info("Query 改写: '%s' → '%s'", original_query[:30], rewritten[:30])
            return rewritten
        return original_query
    except asyncio.TimeoutError:
        logger.warning("Query 改写超时，使用原始查询")
        return original_query
    except Exception as e:
        logger.warning("Query 改写失败: %s，使用原始查询", e)
        return original_query
