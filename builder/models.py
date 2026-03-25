"""
AgentForge V2 — Builder 数据模型
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class IntakeData:
    """采集到的业务信息。"""
    company_name: str = ""
    industry: str = ""
    team_size: str = ""
    positions: list[dict] = field(default_factory=list)     # [{name, department, responsibilities}]
    tools_needed: list[str] = field(default_factory=list)
    knowledge_areas: list[str] = field(default_factory=list)
    workflows: list[str] = field(default_factory=list)
    custom_notes: str = ""


@dataclass
class BuildSession:
    """构建会话。"""
    id: str
    phase: str = "intake"           # "intake" | "generating" | "review" | "deployed"
    intake: IntakeData = field(default_factory=IntakeData)
    conversation: list[dict] = field(default_factory=list)
    generated_profiles: list[dict] = field(default_factory=list)
    current_round: int = 1
    max_rounds: int = 3
    created_at: float = 0.0
    updated_at: float = 0.0
