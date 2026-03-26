"""
AgentForge V2 — 上下文构建器

将 Position 配置 + RAG 结果 + 对话历史 + 记忆 组装成 LLM 可用的上下文。
这是管线的核心步骤：决定 LLM 看到什么。
"""

from __future__ import annotations

import logging
from typing import Any

from core.models import ContextResult, Mission, PositionConfig

logger = logging.getLogger(__name__)

# 复杂度判定关键词
_COMPLEX_KEYWORDS = {"战略", "架构", "重构", "规划", "分析", "制定方案", "对比", "评估"}
_SIMPLE_MAX_CHARS = 100


class ContextBuilder:
    """
    构建 LLM 上下文。

    用法:
        builder = ContextBuilder()
        ctx = builder.build(position, mission, history, rag_results, memories)
    """

    def build(
        self,
        position: PositionConfig,
        mission: Mission,
        history: list[dict] | None = None,
        rag_results: list[dict] | None = None,
        memories: list[str] | None = None,
        tool_descriptions: str = "",
        daily_context: str = "",
    ) -> ContextResult:
        """构建完整上下文。"""
        complexity = self._assess_complexity(mission.instruction)

        # 1. 构建 system prompt
        system_parts = [self._build_identity(position)]

        if position.context:
            system_parts.append(f"\n## 领域知识\n{position.context}")

        if rag_results:
            rag_text = self._format_rag(rag_results)
            if rag_text:
                system_parts.append(f"\n## 参考资料\n{rag_text}")

        if memories:
            mem_text = "\n".join(f"- {m}" for m in memories[:5])
            system_parts.append(f"\n## 历史记忆\n{mem_text}")

        if daily_context:
            system_parts.append(f"\n## 用户当前工作状态\n{daily_context}")

        if tool_descriptions:
            system_parts.append(f"\n## 可用工具\n{tool_descriptions}")

        system_parts.append(self._build_output_guide(position))

        system_prompt = "\n".join(system_parts)

        # 2. 构建消息列表
        messages = []
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": mission.instruction})

        # 3. 附件处理
        if mission.attachments:
            attachment_text = self._format_attachments(mission.attachments)
            if attachment_text:
                messages[-1]["content"] += f"\n\n{attachment_text}"

        return ContextResult(
            system_prompt=system_prompt,
            messages=messages,
            complexity=complexity,
            token_count=self._estimate_tokens(system_prompt, messages),
            rag_context=self._format_rag(rag_results) if rag_results else "",
            memory_context="\n".join(memories) if memories else "",
        )

    def _build_identity(self, position: PositionConfig) -> str:
        """构建身份层 prompt。"""
        parts = []
        if position.role:
            parts.append(position.role.strip())
        if position.goal:
            parts.append(f"\n你的目标: {position.goal.strip()}")
        return "\n".join(parts) if parts else "你是一个AI助手。"

    def _build_output_guide(self, position: PositionConfig) -> str:
        """构建输出格式指南。"""
        return (
            "\n## 输出要求\n"
            "请用中文回答。结构化输出时使用 Markdown 格式。"
            "如果任务涉及数据，请给出具体数字和依据。"
            "\n\n## 工具使用原则\n"
            "1. 用户查询待办/任务/日程/跟进时，必须调用对应工具获取真实数据\n"
            "2. 用户要求创建/修改/删除数据时，必须调用工具执行，不要只用文字回复\n"
            "3. 用户问关于公司/业务的问题时，先用 search_knowledge 搜索知识库\n"
            "4. 需要实时信息时使用 web_search，需要计算时使用 calculator\n"
            "5. 如果不确定用哪个工具，优先选择只读工具（list/search）\n"
        )

    def _format_rag(self, results: list[dict] | None) -> str:
        """格式化 RAG 检索结果。"""
        if not results:
            return ""
        parts = []
        for i, r in enumerate(results[:5], 1):
            title = r.get("title", f"文档{i}")
            content = r.get("content", "")[:500]
            parts.append(f"[{i}] {title}\n{content}")
        return "\n\n".join(parts)

    def _format_attachments(self, attachments: list[dict]) -> str:
        """格式化附件信息。"""
        parts = []
        for att in attachments:
            text = att.get("extracted_text", "")
            name = att.get("filename", "附件")
            if text:
                parts.append(f"[附件: {name}]\n{text[:3000]}")
            else:
                parts.append(f"[附件: {name}]（无法提取文本内容）")
        return "\n\n".join(parts)

    @staticmethod
    def _assess_complexity(instruction: str) -> str:
        """评估任务复杂度。"""
        if len(instruction) <= _SIMPLE_MAX_CHARS and not any(k in instruction for k in _COMPLEX_KEYWORDS):
            return "simple"
        if any(k in instruction for k in _COMPLEX_KEYWORDS):
            return "complex"
        return "standard"

    @staticmethod
    def _estimate_tokens(system: str, messages: list[dict]) -> int:
        """粗略估算 token 数 (中文约 1.5 字符/token)。"""
        total = len(system)
        for m in messages:
            total += len(m.get("content", ""))
        return int(total / 1.5)
