"""
AgentForge V2 — 核心模型测试
"""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.models import (
    ForgeConfig, Mission, MissionResult, PositionConfig,
    ProfileBundle, UnifiedMessage, ContextResult, LLMResponse, StepResult,
)


def test_forge_config_defaults():
    cfg = ForgeConfig()
    assert cfg.name == "AgentForge"
    assert cfg.version == "2.0.0"
    assert cfg.language == "zh-CN"


def test_position_config():
    pos = PositionConfig(
        position_id="test-pm",
        display_name="测试产品经理",
        tools=["calculator", "web_search"],
    )
    assert pos.position_id == "test-pm"
    assert len(pos.tools) == 2
    assert pos.default_model == "sonnet"


def test_mission_creation():
    m = Mission(id="test-123", instruction="帮我分析数据")
    assert m.id == "test-123"
    assert m.mode == "chat"
    assert m.constraints == {}


def test_mission_result():
    r = MissionResult(mission_id="test-123", content="分析完成", tokens_used=500)
    assert r.status == "completed"
    assert r.tokens_used == 500


def test_unified_message():
    msg = UnifiedMessage(content="你好", user_id="u1", position_id="pm")
    assert msg.channel == "api"
    assert msg.position_id == "pm"


def test_profile_bundle():
    bundle = ProfileBundle(name="test")
    assert bundle.positions == {}
    assert bundle.workflows == {}


def test_llm_response():
    resp = LLMResponse(content="回答", model="test", provider="test", total_tokens=100)
    assert resp.total_tokens == 100
    assert resp.tool_calls == []


def test_context_result():
    ctx = ContextResult(system_prompt="你是助手", complexity="simple")
    assert ctx.token_count == 0
    assert ctx.messages == []
