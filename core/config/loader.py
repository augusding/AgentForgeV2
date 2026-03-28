"""
AgentForge V2 — 配置加载器

从 YAML 文件加载配置，解析环境变量，返回类型化的 dataclass。
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv

from core.models import ForgeConfig, PositionConfig, ProfileBundle

logger = logging.getLogger(__name__)


class ConfigLoader:
    """
    统一配置加载器。

    用法:
        loader = ConfigLoader(root_dir)
        forge_cfg = loader.load_forge_config()
        bundle = loader.load_profile("ad-monetization")
    """

    def __init__(self, root_dir: str | Path | None = None):
        self.root_dir = Path(root_dir) if root_dir else Path(__file__).resolve().parent.parent.parent
        self._load_env()

    def _load_env(self) -> None:
        env_path = self.root_dir / ".env"
        if env_path.exists():
            load_dotenv(env_path)

    @staticmethod
    def resolve_env(key: str) -> str:
        """解析环境变量。"""
        return os.environ.get(key, "")

    @staticmethod
    def _read_yaml(path: Path) -> dict:
        """读取 YAML 文件，返回 dict。"""
        if not path.exists():
            logger.warning("YAML 不存在: %s", path)
            return {}
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
            return data if isinstance(data, dict) else {}
        except yaml.YAMLError as e:
            logger.error("YAML 解析失败 [%s]: %s", path, e)
            return {}

    # ── 全局配置 ──────────────────────────────────────────

    def load_forge_config(self) -> ForgeConfig:
        """加载 config/forge.yaml。"""
        raw = self._read_yaml(self.root_dir / "config" / "forge.yaml")
        forge = raw.get("forge", {})
        return ForgeConfig(
            name=forge.get("name", "AgentForge"),
            version=forge.get("version", "2.0.0"),
            owner=forge.get("owner", ""),
            language=forge.get("language", "zh-CN"),
            llm=raw.get("llm", {}),
            memory=raw.get("memory", {}),
            knowledge=raw.get("knowledge", {}),
            reasoning=raw.get("reasoning", {}),
            guardrails=raw.get("guardrails", {}),
            tools=raw.get("tools", {}),
            channels=raw.get("channels", {}),
            observability=raw.get("observability", {}),
        )

    # ── Profile 加载 ──────────────────────────────────────

    def load_profile(self, profile_name: str) -> ProfileBundle:
        """
        加载行业 Profile：positions/*.yaml + workflows/*.yaml。
        合并 _base.yaml 默认值。
        """
        profile_dir = self.root_dir / "profiles" / profile_name
        if not profile_dir.exists():
            profile_dir = self.root_dir / "data" / "profiles" / profile_name
        if not profile_dir.exists():
            logger.error("Profile 不存在: %s", profile_name)
            return ProfileBundle(name=profile_name)

        base = self._read_yaml(self.root_dir / "profiles" / "_base.yaml")
        base_config = base.get("base", {})

        # 加载岗位
        positions: dict[str, PositionConfig] = {}
        pos_dir = profile_dir / "positions"
        if pos_dir.exists():
            for yaml_file in sorted(pos_dir.glob("*.yaml")):
                raw = self._read_yaml(yaml_file)
                if not raw.get("position_id"):
                    continue
                pos = self._parse_position(raw, base_config)
                positions[pos.position_id] = pos

        # 加载工作流
        workflows: dict[str, dict] = {}
        wf_dir = profile_dir / "workflows"
        if wf_dir.exists():
            for yaml_file in sorted(wf_dir.glob("*.yaml")):
                raw = self._read_yaml(yaml_file)
                wf_id = raw.get("id", yaml_file.stem)
                workflows[wf_id] = raw

        logger.info(
            "Profile 加载完成: %s (%d 岗位, %d 工作流)",
            profile_name, len(positions), len(workflows),
        )
        return ProfileBundle(
            name=profile_name,
            positions=positions,
            workflows=workflows,
            base_config=base_config,
        )

    def _parse_position(self, raw: dict, base: dict) -> PositionConfig:
        """解析岗位配置，合并 base 默认值。"""
        defaults = base.get("default_llm", {})
        return PositionConfig(
            position_id=raw["position_id"],
            display_name=raw.get("display_name", raw["position_id"]),
            icon=raw.get("icon", "bot"),
            color=raw.get("color", "#3B82F6"),
            department=raw.get("department", ""),
            domain=raw.get("domain", ""),
            description=raw.get("description", ""),
            role=raw.get("role", ""),
            goal=raw.get("goal", ""),
            context=raw.get("context", ""),
            identity=raw.get("identity", ""),
            values=raw.get("values", ""),
            behavior=raw.get("behavior", ""),
            default_model=raw.get("default_model", defaults.get("default_model", "sonnet")),
            complex_model=raw.get("complex_model", defaults.get("complex_model", "opus")),
            dashboard=raw.get("dashboard", {}),
            onboarding=raw.get("onboarding", {}),
        )

    def list_profiles(self) -> list[str]:
        """列出所有可用的 Profile 名（profiles/ + data/profiles/）。"""
        result = set()
        for base in [self.root_dir / "profiles", self.root_dir / "data" / "profiles"]:
            if base.exists():
                for d in base.iterdir():
                    if d.is_dir() and not d.name.startswith("_"):
                        result.add(d.name)
        return sorted(result)
