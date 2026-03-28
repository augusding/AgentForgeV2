"""
AgentForge V2 — 上下文构建器（六层专家模型 + 分层注入）

注入策略：
  永远注入（~300 tokens）：身份层 + 价值观层 + 行为层 + 输出规范
  按需注入（L3/L4）：知识层 context（专业知识、方法论）
  实时检索注入：RAG 结果、记忆、工作状态

兼容旧配置：identity/values/behavior 为空时降级使用 role/goal
"""
from __future__ import annotations

import logging

from core.models import ContextResult, Mission, PositionConfig

logger = logging.getLogger(__name__)

_COMPLEX_KEYWORDS = {"战略", "架构", "重构", "规划", "分析", "制定方案", "对比", "评估",
                     "设计", "梳理", "研究", "方案", "建议", "如何", "怎么"}
_SIMPLE_MAX_CHARS = 100
_PERSONA_MAX_CHARS = 900


class ContextBuilder:
    """构建 LLM 上下文，实现六层专家模型的分层注入。"""

    def build(
        self, position: PositionConfig, mission: Mission,
        history: list[dict] | None = None, rag_results: list[dict] | None = None,
        memories: list[str] | None = None, tool_descriptions: str = "",
        daily_context: str = "",
    ) -> ContextResult:
        complexity = self._assess_complexity(mission.instruction)
        system_parts: list[str] = []

        # 人格骨架（永远注入）
        persona = self._build_persona(position)
        system_parts.append(persona)

        # 专业知识（L3/L4 才注入）
        if complexity in ("standard", "complex") and position.context:
            system_parts.append(
                "\n## 专业知识\n"
                "（仅在用户咨询专业问题时参考，日常执行指令无需使用）\n"
                f"{position.context}"
            )

        if rag_results:
            rag_text = self._format_rag(rag_results)
            if rag_text:
                system_parts.append(f"\n## 参考资料\n{rag_text}")
        if memories:
            system_parts.append("\n## 历史记忆\n" + "\n".join(f"- {m}" for m in memories[:5]))
        if daily_context:
            system_parts.append(f"\n## 当前工作状态\n{daily_context}")
        if tool_descriptions:
            system_parts.append(f"\n## 可用工具\n{tool_descriptions}")

        system_parts.append(self._build_output_guide())
        system_prompt = "\n".join(system_parts)

        messages: list[dict] = []
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": mission.instruction})
        if mission.attachments:
            att_text = self._format_attachments(mission.attachments)
            if att_text:
                messages[-1]["content"] += f"\n\n{att_text}"

        return ContextResult(
            system_prompt=system_prompt, messages=messages,
            complexity=complexity,
            token_count=self._estimate_tokens(system_prompt, messages),
            rag_context=self._format_rag(rag_results) if rag_results else "",
            memory_context="\n".join(memories) if memories else "",
        )

    def _build_persona(self, position: PositionConfig) -> str:
        """构建永远注入的人格骨架。优先六层字段，降级旧字段。"""
        parts: list[str] = []
        if position.identity:
            parts.append(position.identity.strip())
        elif position.role:
            t = position.role.strip()
            if position.goal:
                t += f"\n目标：{position.goal.strip()}"
            parts.append(t)
        else:
            parts.append("你是一个AI助手，简明高效地帮助用户完成任务。")
        if position.values:
            parts.append(f"\n## 判断原则\n{position.values.strip()}")
        if position.behavior:
            parts.append(f"\n## 行为规范\n{position.behavior.strip()}")
        persona = "\n".join(parts)
        if len(persona) > _PERSONA_MAX_CHARS:
            logger.warning("岗位 %s 人格骨架过长 (%d > %d)，建议精炼", position.position_id, len(persona), _PERSONA_MAX_CHARS)
        return persona

    @staticmethod
    def _build_output_guide() -> str:
        return (
            "\n## 响应原则\n"
            "根据用户意图深度匹配回复深度：\n"
            "**L1 执行型**（创建/查看/删除/发送/安排）→ 直接执行 + 1-2 句确认\n"
            "**L2 辅助型**（帮我整理/处理一下）→ 执行 + 简要说明结果\n"
            "**L3 建议型**（怎么做/应该/建议）→ 结合专业视角给建议\n"
            "**L4 分析型**（分析/评估/制定方案/规划）→ 完整专业分析\n\n"
            "关键约束：先结论后理由 · 用数字不用模糊词 · "
            "信息不足时只问最关键的一个问题 · 中文回复"
        )

    def _format_rag(self, results: list[dict] | None) -> str:
        if not results:
            return ""
        parts = []
        for i, r in enumerate(results[:5], 1):
            score = r.get("score", 0)
            if score and score < 0.5:
                continue
            parts.append(f"[{i}] {r.get('title', f'文档{i}')}\n{r.get('content', '')[:500]}")
        return "\n\n".join(parts)

    def _format_attachments(self, attachments: list[dict]) -> str:
        parts = []
        for att in attachments:
            name = att.get("filename", "附件")
            path = att.get("path", "")
            header = f"[附件: {name}]"
            if path:
                header += f"\n  路径: {path}"
            text = att.get("extracted_text", "")
            parts.append(f"{header}\n{text[:3000]}" if text else f"{header}（无法提取文本）")
        return "\n\n".join(parts)

    @staticmethod
    def _assess_complexity(instruction: str) -> str:
        s = instruction.strip()
        if len(s) <= _SIMPLE_MAX_CHARS and not any(k in s for k in _COMPLEX_KEYWORDS):
            return "simple"
        if any(k in s for k in _COMPLEX_KEYWORDS):
            return "complex"
        return "standard"

    @staticmethod
    def _estimate_tokens(system: str, messages: list[dict]) -> int:
        total = len(system)
        for m in messages:
            total += len(m.get("content", ""))
        return int(total / 1.5)
