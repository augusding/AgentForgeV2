"""
AgentForge V2 — Profile 配置生成器

将 IntakeData 转化为 PositionConfig YAML 配置。
"""

from __future__ import annotations

import json
import logging
from typing import Any

import yaml

from builder.models import IntakeData

logger = logging.getLogger(__name__)

_GENERATION_PROMPT = """根据以下业务信息，为每个岗位生成 AI 助手配置。

业务信息：
- 公司: {company_name}
- 行业: {industry}
- 团队规模: {team_size}
- 岗位列表: {positions}
- 需要工具: {tools}
- 知识领域: {knowledge}
- 业务流程: {workflows}
- 备注: {notes}

为每个岗位生成 YAML 配置，格式如下：

```yaml
position_id: "英文ID"
display_name: "中文名称"
icon: "图标名"
color: "#颜色"
department: "部门"
domain: "领域"
description: "一句话描述"

role: |
  角色描述（50-100字，说明 AI 助手的身份和职责）

goal: |
  目标描述（一句话）

context: |
  领域知识上下文（列出该岗位需要的专业知识要点）

default_model: "sonnet"
tools:
  - 工具1
  - 工具2

knowledge_scope:
  - 知识领域1

onboarding:
  tip: "一句话提示"
  prompts:
    - "示例问题1"
    - "示例问题2"
```

为每个岗位各生成一个配置。用 YAML 格式输出，每个岗位用 `---` 分隔。"""


class ProfileGenerator:
    """Profile 配置生成器。"""

    def __init__(self, llm_client):
        self._llm = llm_client

    async def generate(self, intake: IntakeData) -> list[dict]:
        """
        根据采集数据生成岗位配置。
        返回 [{position_id, yaml_content, ...}, ...]
        """
        prompt = _GENERATION_PROMPT.format(
            company_name=intake.company_name or "未知",
            industry=intake.industry or "未知",
            team_size=intake.team_size or "未知",
            positions=json.dumps(intake.positions, ensure_ascii=False) if intake.positions else "未提供",
            tools=", ".join(intake.tools_needed) if intake.tools_needed else "未提供",
            knowledge=", ".join(intake.knowledge_areas) if intake.knowledge_areas else "未提供",
            workflows=", ".join(intake.workflows) if intake.workflows else "未提供",
            notes=intake.custom_notes or "无",
        )

        try:
            resp = await self._llm.chat(
                system="你是 AI Agent 配置专家。根据业务信息生成高质量的岗位配置。",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3, max_tokens=4000,
            )
            return self._parse_yaml_outputs(resp.content)
        except Exception as e:
            logger.error("配置生成失败: %s", e)
            return []

    def _parse_yaml_outputs(self, text: str) -> list[dict]:
        """解析 LLM 输出的 YAML 配置。"""
        results = []
        # 移除 markdown 包裹
        text = text.replace("```yaml", "").replace("```", "")

        for doc in text.split("---"):
            doc = doc.strip()
            if not doc:
                continue
            try:
                data = yaml.safe_load(doc)
                if isinstance(data, dict) and data.get("position_id"):
                    results.append({
                        "position_id": data["position_id"],
                        "yaml_content": yaml.dump(data, allow_unicode=True, default_flow_style=False),
                        "data": data,
                    })
            except yaml.YAMLError:
                continue

        logger.info("生成了 %d 个岗位配置", len(results))
        return results
