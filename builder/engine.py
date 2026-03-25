"""
AgentForge V2 — BuilderEngine: 构建流程主控

串联 Intake → Generate → Review → Deploy。
"""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from uuid import uuid4

import aiosqlite
import yaml

from builder.generator import ProfileGenerator
from builder.intake import IntakeCollector
from builder.models import BuildSession, IntakeData

logger = logging.getLogger(__name__)


class BuilderEngine:
    """Profile 构建流程主控。"""

    def __init__(self, llm_client, db_path: str = "data/builder.db"):
        self._llm = llm_client
        self._db_path = db_path
        self._intake = IntakeCollector(llm_client)
        self._generator = ProfileGenerator(llm_client)
        self._sessions: dict[str, BuildSession] = {}
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    async def create_session(self) -> dict:
        """创建新的构建会话。"""
        session = BuildSession(
            id=uuid4().hex[:12],
            created_at=time.time(),
            updated_at=time.time(),
        )
        self._sessions[session.id] = session
        first_q = self._intake.get_next_question(session)
        session.conversation.append({"role": "assistant", "content": first_q})
        return {
            "session_id": session.id,
            "phase": session.phase,
            "message": first_q,
        }

    async def chat(self, session_id: str, user_input: str) -> dict:
        """处理对话输入。"""
        session = self._sessions.get(session_id)
        if not session:
            return {"error": "会话不存在"}

        if session.phase == "intake":
            reply = await self._intake.process_answer(session, user_input)
            session.updated_at = time.time()

            if session.phase == "generating":
                # 自动开始生成
                profiles = await self._generator.generate(session.intake)
                session.generated_profiles = profiles
                session.phase = "review"
                return {
                    "session_id": session_id,
                    "phase": "review",
                    "message": f"已生成 {len(profiles)} 个岗位配置，请审核。",
                    "profiles": profiles,
                }
            return {
                "session_id": session_id,
                "phase": "intake",
                "message": reply,
                "round": f"{session.current_round}/{session.max_rounds}",
            }

        elif session.phase == "review":
            return {
                "session_id": session_id,
                "phase": "review",
                "message": "当前处于审核阶段。使用 /deploy 部署或继续修改。",
                "profiles": session.generated_profiles,
            }

        return {"error": f"未知阶段: {session.phase}"}

    async def deploy(self, session_id: str, output_dir: str) -> dict:
        """部署生成的配置到 profiles/ 目录。"""
        session = self._sessions.get(session_id)
        if not session or session.phase != "review":
            return {"error": "会话不存在或未处于审核阶段"}

        if not session.generated_profiles:
            return {"error": "没有可部署的配置"}

        out = Path(output_dir)
        positions_dir = out / "positions"
        positions_dir.mkdir(parents=True, exist_ok=True)

        deployed = []
        for profile in session.generated_profiles:
            pos_id = profile["position_id"]
            yaml_content = profile["yaml_content"]
            file_path = positions_dir / f"{pos_id}.yaml"
            file_path.write_text(yaml_content, encoding="utf-8")
            deployed.append(pos_id)
            logger.info("岗位配置已部署: %s → %s", pos_id, file_path)

        session.phase = "deployed"
        return {"status": "deployed", "positions": deployed, "output_dir": str(out)}

    def get_session(self, session_id: str) -> dict | None:
        """获取会话状态。"""
        session = self._sessions.get(session_id)
        if not session:
            return None
        return {
            "session_id": session.id,
            "phase": session.phase,
            "round": f"{session.current_round}/{session.max_rounds}",
            "profiles_count": len(session.generated_profiles),
            "intake": {
                "company": session.intake.company_name,
                "industry": session.intake.industry,
                "positions": len(session.intake.positions),
            },
        }
