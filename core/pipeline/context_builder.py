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

_PERSONA_MAX_CHARS = 900


class ContextBuilder:
    """构建 LLM 上下文，实现六层专家模型的分层注入。"""

    def build(
        self, position: PositionConfig, mission: Mission,
        history: list[dict] | None = None, rag_results: list[dict] | None = None,
        memories: list[str] | None = None, tool_descriptions: str = "",
        daily_context: str = "", user_profile: str = "",
    ) -> ContextResult:
        complexity = self._assess_complexity(mission.instruction)
        system_parts: list[str] = []

        # 人格骨架（永远注入）
        persona = self._build_persona(position)
        system_parts.append(persona)

        # 专业知识（L3/L4 才注入）
        if complexity == "standard" and position.context:
            system_parts.append(
                "\n## 专业知识\n"
                "（L3/L4 问题参考，L1/L2 指令忽略）\n"
                f"{position.context}"
            )

        if user_profile:
            system_parts.append(f"\n## 个人规范与偏好\n{user_profile}")
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
        # 构建 user message（支持图片 multimodal）
        image_blocks = [
            a["image_block"] for a in (mission.attachments or [])
            if a.get("type") == "image" and a.get("image_block")
        ]
        text_parts = [mission.instruction]
        if mission.attachments:
            att_text = self._format_attachments(mission.attachments)
            if att_text:
                text_parts.append(att_text)
        full_text = "\n\n".join(text_parts)
        if image_blocks:
            content_blocks = list(image_blocks) + [{"type": "text", "text": full_text}]
            messages.append({"role": "user", "content": content_blocks})
        else:
            messages.append({"role": "user", "content": full_text})

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
            "**L1 执行型**（创建/查看/删除/发送/安排）→ 工位数据（任务/日程/跟进）的创建使用 propose 动作返回确认卡片，其他直接执行 + 1-2 句确认\n"
            "**L2 辅助型**（帮我整理/处理一下）→ 执行 + 简要说明结果\n"
            "**L3 建议型**（怎么做/应该/建议）→ 结合专业视角给建议\n"
            "**L4 分析型**（分析/评估/制定方案/规划）→ 完整专业分析\n\n"
            "\n## 工位工具使用原则\n"
            "创建任务/日程/跟进时，**必须使用 action=propose**，让用户在确认卡片中预览和修改后再创建。"
            "只有当用户明确说'直接创建'或'不用确认'时，才使用 action=add 跳过确认。\n"
            "propose 时尽量从用户消息中提取完整信息（标题、时间、对象、优先级），减少反问。"
            "时间表达推断规则：'明天' → 次日日期, '下周一' → 下个周一日期, '3点' → 当天15:00, '下午' → 14:00。"
            "相对时间规则：'半小时后/一小时后/X分钟后/X小时后' → 当前时间 + 对应偏移量，计算出具体的 YYYY-MM-DD HH:MM。"
            "注意：当前时间已在上下文中提供，请据此计算。\n\n"
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

    def _format_attachments(self, attachments: list[dict] | None) -> str:
        if not attachments:
            return ""
        parts = []
        for att in attachments:
            att_type = att.get("type", "file")
            name = att.get("filename", "附件")
            text = att.get("extracted_text", "")
            if att_type == "image":
                if text and not text.startswith("[图片"):
                    parts.append(f"[图片 {name} — OCR 提取文字]\n{text[:3000]}")
            elif att_type == "audio":
                parts.append(f"[语音转录 — {name}]\n{text[:5000]}")
            else:
                header = f"[附件: {name}]"
                parts.append(f"{header}\n{text[:3000]}" if text else f"{header}（无法提取文本）")
        return "\n\n".join(parts)

    @staticmethod
    def _assess_complexity(instruction: str) -> str:
        """极短消息不预注入 context，其余一律注入让 LLM 自判断 L1-L4。"""
        if len(instruction.strip()) <= 15:
            return "simple"
        return "standard"

    @staticmethod
    def _estimate_tokens(system: str, messages: list[dict]) -> int:
        total = len(system)
        for m in messages:
            total += len(m.get("content", ""))
        return int(total / 1.5)
