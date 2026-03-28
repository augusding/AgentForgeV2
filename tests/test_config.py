"""
AgentForge V2 — 配置加载器测试
"""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.config.loader import ConfigLoader


@pytest.fixture
def loader():
    root = Path(__file__).parent.parent
    return ConfigLoader(root)


def test_load_forge_config(loader):
    cfg = loader.load_forge_config()
    assert cfg.name == "AgentForge"
    assert cfg.version == "2.0.0"
    assert "tiers" in cfg.llm


def test_list_profiles(loader):
    profiles = loader.list_profiles()
    assert isinstance(profiles, list)
    assert "ad-monetization" in profiles


def test_load_profile(loader):
    bundle = loader.load_profile("ad-monetization")
    assert bundle.name == "ad-monetization"
    assert len(bundle.positions) > 0
    # 检查至少一个岗位有 role
    for pos in bundle.positions.values():
        assert pos.position_id
        assert pos.display_name
        break


def test_position_fields(loader):
    bundle = loader.load_profile("ad-monetization")
    for pos in bundle.positions.values():
        assert pos.position_id
        assert pos.display_name
        break


def test_load_nonexistent_profile(loader):
    bundle = loader.load_profile("nonexistent")
    assert bundle.name == "nonexistent"
    assert len(bundle.positions) == 0


def test_env_resolve():
    import os
    os.environ["_TEST_KEY"] = "test_value"
    assert ConfigLoader.resolve_env("_TEST_KEY") == "test_value"
    assert ConfigLoader.resolve_env("_NONEXISTENT") == ""
    del os.environ["_TEST_KEY"]
