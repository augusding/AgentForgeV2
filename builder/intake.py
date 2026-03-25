"""
AgentForge V2 — 业务信息采集器

通过 3 轮对话采集业务信息，使用 LLM 提取结构化数据。
"""

from __future__ import annotations

import json
import logging
from typing import Any

from builder.models import BuildSession, IntakeData

logger = logging.getLogger(__name__)

_INTERVIEWER_SYSTEM = """你是一名资深业务分析师，正在帮助客户将业务知识转化为 AI Agent 配置。

采集策略（3 轮快速采集）：
- 第1轮：了解公司概况、行业、团队规模、AI 需求
- 第2轮：了解核心岗位和主要业务流程
- 第3轮：了解知识资产、业务规则和沟通偏好

原则：每轮只问一个综合性问题，让客户自由描述。2-3 句话以内，用中文。"""

_ROUND_QUESTIONS = [
    "请介绍一下你的公司：行业是什么？团队大概多少人？你希望 AI 助手帮你解决什么问题？",
    "你的团队有哪些核心岗位？每个岗位的主要工作内容是什么？有哪些关键的业务流程？",
    "你们日常使用什么工具和系统？有哪些知识文档或规范？对 AI 的输出有什么特殊要求？",
]

_EXTRACT_PROMPT = """根据以下对话内容，提取结构化业务信息。只输出 JSON，不要有其他内容。

对话内容：
{conversation}

输出格式：
{{
    "company_name": "公司名称",
    "industry": "行业",
    "team_size": "团队规模描述",
    "positions": [
        {{"name": "岗位名", "department": "部门", "responsibilities": "职责描述"}}
    ],
    "tools_needed": ["工具1", "工具2"],
    "knowledge_areas": ["知识领域1"],
    "workflows": ["流程1"],
    "custom_notes": "其他备注"
}}"""


class IntakeCollector:
    """对话式业务信息采集器。"""

    def __init__(self, llm_client):
        self._llm = llm_client

    def get_next_question(self, session: BuildSession) -> str | None:
        """获取下一轮的问题。"""
        idx = session.current_round - 1
        if idx < len(_ROUND_QUESTIONS):
            return _ROUND_QUESTIONS[idx]
        return None

    async def process_answer(self, session: BuildSession, user_input: str) -> str:
        """
        处理用户回答，推进采集。
        返回下一个问题或采集完成提示。
        """
        session.conversation.append({"role": "user", "content": user_input})

        if session.current_round >= session.max_rounds:
            # 采集完成，提取结构化数据
            session.intake = await self._extract_data(session.conversation)
            session.phase = "generating"
            return "信息采集完成！正在为你生成 AI 助手配置..."

        session.current_round += 1
        # 用 LLM 生成自然的过渡 + 下一个问题
        next_q = self.get_next_question(session)
        try:
            resp = await self._llm.chat(
                system=_INTERVIEWER_SYSTEM,
                messages=session.conversation + [
                    {"role": "user", "content": f"(内部指令：根据客户回答自然过渡，然后问这个问题：{next_q})"}
                ],
                temperature=0.7, max_tokens=300,
            )
            reply = resp.content.strip()
        except Exception:
            reply = f"收到！{next_q}"

        session.conversation.append({"role": "assistant", "content": reply})
        return reply

    async def _extract_data(self, conversation: list[dict]) -> IntakeData:
        """从对话中提取结构化数据。"""
        conv_text = "\n".join(f"{m['role']}: {m['content']}" for m in conversation)
        prompt = _EXTRACT_PROMPT.format(conversation=conv_text)

        try:
            resp = await self._llm.chat(
                system="你是数据提取专家。只输出 JSON，不要有任何其他内容。",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1, max_tokens=2000,
            )
            text = resp.content.strip()
            # 清理可能的 markdown 包裹
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            data = json.loads(text)
            return IntakeData(**{k: v for k, v in data.items() if k in IntakeData.__dataclass_fields__})
        except Exception as e:
            logger.error("数据提取失败: %s", e)
            return IntakeData(custom_notes=conv_text[:500])
