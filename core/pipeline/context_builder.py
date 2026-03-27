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
            system_parts.append(f"\n## 领域知识（仅在用户咨询专业问题时参考，日常指令无需使用）\n{position.context}")

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
        """构建身份层 prompt — 轻量身份 + 专业能力备注。"""
        parts = []
        if position.role:
            parts.append(position.role.strip())
        if position.goal:
            parts.append(f"\n你的专业领域: {position.goal.strip()}")
            parts.append("注意：只在用户主动咨询专业问题时才发挥专业能力，日常指令简明回复。")
        return "\n".join(parts) if parts else "你是一个AI助手，简明高效地帮助用户完成任务。"

    def _build_output_guide(self, position: PositionConfig) -> str:
        """构建响应校准指南。"""
        return (
            "\n## 响应原则\n"
            "\n### 核心规则：匹配用户意图深度\n"
            "**L1 执行型**（明确指令：创建/查看/删除/发送/安排/记录/转换/搜索）\n"
            "→ 直接执行 + 1-2 句确认。不要额外发挥。\n"
            "例：'明天上午开会' → 创建日程 + '已安排。需要我帮你准备什么吗？'\n"
            "例：'你好' → 简短问候\n\n"
            "**L2 辅助型**（帮我整理/处理一下/看看这个）\n"
            "→ 执行任务 + 简要说明结果（3-5 句）\n\n"
            "**L3 建议型**（怎么做/应该/建议/推荐/你觉得）\n"
            "→ 结合专业视角给 1-2 段建议\n\n"
            "**L4 分析型**（分析/评估/制定方案/设计/规划/全面梳理）\n"
            "→ 发挥专业能力，完整分析\n\n"
            "### 关键约束\n"
            "- 用户没问的不要主动回答。'创建会议'≠'准备会议内容'\n"
            "- 信息不足时简短追问，不要自己假设然后长篇输出\n"
            "- 工具执行后 1 句话确认结果，不重复描述工具做了什么\n"
            "- 中文回复，必要时用 Markdown\n\n"
            "### 工具使用原则\n"
            "1. 查询待办/日程/跟进时，必须调用工具获取真实数据\n"
            "2. 创建/修改/删除时，必须调用工具执行\n"
            "3. 公司/业务问题先搜索知识库\n"
            "4. 实时信息用 web_search\n"
            "5. 文件格式转换（如 PDF 转 Word）使用 document_converter\n"
            "6. 生成文件时，根据目标格式选择对应工具：\n"
            "   - Word/报告/方案/邮件/纪要 → word_processor(content=内容)\n"
            "   - Excel/表格/数据 → excel_processor(action=create)\n"
            "   - PPT/演示文稿 → document_converter(target_format=pptx)\n"
            "   - 如果用户没指定格式，默认生成 Word\n"
            "7. 任何用户要求'生成/创建/写入文件'的操作，都必须调用工具创建真实文件\n"
            "8. 严禁用文字描述代替工具执行，不允许假装已创建文件\n"
            "9. 工具执行后简要确认即可\n"
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
            path = att.get("path", "")
            header = f"[附件: {name}]"
            if path:
                header += f"\n  工具调用路径: {path}"
            if text:
                parts.append(f"{header}\n{text[:3000]}")
            else:
                parts.append(f"{header}（无法提取文本内容）")
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
