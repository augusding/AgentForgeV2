"""AgentForgeV2 — LLM 检索结果重排序（向量检索 top-5 → LLM 打分 → top-3）"""
from __future__ import annotations
import logging
import time

logger = logging.getLogger(__name__)


async def rerank(query: str, chunks: list[dict], llm_client, top_k: int = 3) -> list[dict]:
    """用 LLM 对检索结果按相关性重排序。失败时返回原始 top-K。"""
    if len(chunks) <= top_k:
        return chunks
    candidates = chunks[:8]
    chunks_text = "\n---\n".join(f"[{i+1}] {c.get('content', '')[:200]}" for i, c in enumerate(candidates))
    prompt = (f"用户问题：{query}\n\n以下是 {len(candidates)} 个文档片段，"
              f"请判断哪些能帮助回答问题。\n只返回相关片段编号，从最相关到最不相关，逗号分隔。\n"
              f"无相关片段返回「无」。只返回编号。\n\n{chunks_text}\n\n相关片段编号：")
    t0 = time.time()
    try:
        resp = await llm_client.chat(
            system="你是文档相关性评估器。只返回编号或「无」。",
            messages=[{"role": "user", "content": prompt}],
            temperature=0, max_tokens=50)
        content = resp.content.strip()
        logger.info("Reranker %.0fms: q=%s → %s", (time.time()-t0)*1000, query[:30], content)
        if "无" in content: return []
        nums = []
        for p in content.replace("，", ",").split(","):
            p = p.strip().rstrip(".")
            if p.isdigit():
                idx = int(p) - 1
                if 0 <= idx < len(candidates) and idx not in nums: nums.append(idx)
        if not nums:
            logger.warning("Reranker 解析失败: '%s'", content)
            return chunks[:top_k]
        return [candidates[i] for i in nums[:top_k]]
    except Exception as e:
        logger.warning("Reranker 异常: %s", e)
        return chunks[:top_k]
