"""
AgentForge V2 — 核心数据模型

所有模块共用的数据结构。使用 dataclass 保持轻量，
模块间通过这些结构传递数据，避免传递 Engine 实例。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


# ── 配置 ──────────────────────────────────────────────────

@dataclass
class ForgeConfig:
    """全局配置，从 config/forge.yaml 加载。"""
    name: str = "AgentForge"
    version: str = "2.0.0"
    owner: str = ""
    language: str = "zh-CN"
    llm: dict = field(default_factory=dict)
    memory: dict = field(default_factory=dict)
    knowledge: dict = field(default_factory=dict)
    reasoning: dict = field(default_factory=dict)
    guardrails: dict = field(default_factory=dict)
    tools: dict = field(default_factory=dict)
    channels: dict = field(default_factory=dict)
    observability: dict = field(default_factory=dict)


@dataclass
class PositionConfig:
    """
    岗位配置，从 profiles/<industry>/positions/<id>.yaml 加载。
    V2 核心概念：每个岗位 = 角色 + 工具 + 知识 + 工作流。
    """
    position_id: str
    display_name: str = ""
    icon: str = "bot"
    color: str = "#3B82F6"
    department: str = ""
    domain: str = ""
    description: str = ""

    # 核心三要素
    role: str = ""          # 角色描述 (system prompt 核心)
    goal: str = ""          # 目标描述
    context: str = ""       # 领域知识上下文

    # 资源声明
    default_model: str = "sonnet"
    complex_model: str = "opus"
    tools: list[str] = field(default_factory=list)
    knowledge_scope: list[str] = field(default_factory=list)
    skills: list[dict] = field(default_factory=list)

    # UI 配置
    dashboard: dict = field(default_factory=dict)
    onboarding: dict = field(default_factory=dict)


@dataclass
class ProfileBundle:
    """一个行业 Profile 的完整包：所有岗位 + 工作流。"""
    name: str
    positions: dict[str, PositionConfig] = field(default_factory=dict)
    workflows: dict[str, dict] = field(default_factory=dict)
    base_config: dict = field(default_factory=dict)


# ── 运行时 ────────────────────────────────────────────────

@dataclass
class Mission:
    """一次任务实例。"""
    id: str
    instruction: str
    position_id: str = ""
    user_id: str = ""
    org_id: str = ""
    session_id: str = ""
    mode: str = "chat"                                  # "chat" | "plan"
    context: dict = field(default_factory=dict)         # 附加上下文 (RAG结果、历史等)
    attachments: list[dict] = field(default_factory=list)
    constraints: dict = field(default_factory=dict)     # max_tokens, timeout
    force_model: str | None = None


@dataclass
class StepResult:
    """单步执行结果。"""
    step_id: str
    content: str
    tokens_used: int = 0
    model: str = ""
    duration: float = 0.0
    tool_calls: list[dict] = field(default_factory=list)


@dataclass
class MissionResult:
    """任务最终结果。"""
    mission_id: str
    status: str = "completed"       # "completed" | "failed" | "aborted"
    content: str = ""
    steps: list[StepResult] = field(default_factory=list)
    tokens_used: int = 0
    cost: float = 0.0
    duration: float = 0.0
    model_used: str = ""


# ── LLM ───────────────────────────────────────────────────

@dataclass
class LLMResponse:
    """LLM 调用结果。"""
    content: str
    model: str
    provider: str
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    finish_reason: str = ""
    duration: float = 0.0
    tool_calls: list[dict] = field(default_factory=list)


# ── 消息 ──────────────────────────────────────────────────

@dataclass
class UnifiedMessage:
    """统一消息格式，所有渠道的消息转换为此格式。"""
    content: str
    user_id: str = ""
    org_id: str = ""
    session_id: str = ""
    position_id: str = ""
    channel: str = "api"            # "api" | "cli" | "feishu" | "wecom"
    attachments: list[dict] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)


@dataclass
class Attachment:
    """消息附件。"""
    filename: str
    content_type: str
    size: int = 0
    path: str = ""
    url: str = ""
    extracted_text: str = ""


# ── 上下文 ────────────────────────────────────────────────

@dataclass
class ContextResult:
    """上下文构建结果，传递给 LLM。"""
    system_prompt: str
    messages: list[dict] = field(default_factory=list)
    complexity: str = "simple"      # "simple" | "standard" | "complex"
    token_count: int = 0
    rag_context: str = ""
    memory_context: str = ""
