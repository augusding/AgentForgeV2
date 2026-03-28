"""AgentForge V2 — 岗位路由：列表、详情、更新。"""
from __future__ import annotations

import json
import logging
import traceback
from pathlib import Path

import yaml
from aiohttp import web

logger = logging.getLogger(__name__)


def _json(data, status: int = 200) -> web.Response:
    return web.Response(text=json.dumps(data, ensure_ascii=False, default=str),
                        content_type="application/json", status=status)


def _pos_to_dict(pos) -> dict:
    """将 PositionConfig 转为完整 API 响应。"""
    return {
        "position_id": pos.position_id,
        "display_name": pos.display_name,
        "icon": pos.icon, "color": pos.color,
        "department": pos.department, "domain": pos.domain,
        "description": pos.description,
        "identity": pos.identity, "values": pos.values, "behavior": pos.behavior,
        "context": pos.context, "role": pos.role, "goal": pos.goal,
        "default_model": pos.default_model, "complex_model": pos.complex_model,
        "onboarding": pos.onboarding, "dashboard": pos.dashboard,
    }


async def handle_positions_list(request: web.Request) -> web.Response:
    """GET /api/v1/positions"""
    engine = request.app["engine"]
    profile = request.query.get("profile", "")
    positions = engine.get_positions_list(profile)
    return _json({"positions": positions})


async def handle_position_detail(request: web.Request) -> web.Response:
    """GET /api/v1/positions/{position_id}"""
    engine = request.app["engine"]
    pid = request.match_info["position_id"]
    for bundle in engine._bundles.values():
        if pid in bundle.positions:
            return _json(_pos_to_dict(bundle.positions[pid]))
    return _json({"error": "岗位不存在"}, status=404)


async def handle_position_update(request: web.Request) -> web.Response:
    """PATCH /api/v1/positions/{position_id} — 更新岗位配置并写回 YAML"""
    engine = request.app["engine"]
    pid = request.match_info["position_id"]

    try:
        body = await request.json()
    except Exception:
        return _json({"error": "无效的 JSON"}, 400)

    # 找到岗位对应的 YAML 文件
    yaml_path = None
    for profile_dir in [engine.root_dir / "profiles", engine.root_dir / "data" / "profiles"]:
        if not profile_dir.is_dir():
            continue
        for pf in profile_dir.iterdir():
            pos_dir = pf / "positions"
            if not pos_dir.is_dir():
                continue
            candidate = pos_dir / f"{pid}.yaml"
            if candidate.is_file():
                yaml_path = candidate
                break
        if yaml_path:
            break

    if not yaml_path:
        return _json({"error": f"未找到岗位配置文件: {pid}.yaml"}, 404)

    try:
        with open(yaml_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}

        # 允许更新的字段
        editable = {"display_name", "description", "department", "domain",
                    "identity", "values", "behavior", "context",
                    "role", "goal", "default_model", "complex_model",
                    "icon", "color", "onboarding"}
        for k, v in body.items():
            if k in editable:
                data[k] = v

        with open(yaml_path, "w", encoding="utf-8") as f:
            yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

        # 重新加载 profiles
        await engine.reload_profiles()

        # 返回更新后的数据
        for bundle in engine._bundles.values():
            if pid in bundle.positions:
                return _json({"status": "updated", "position": _pos_to_dict(bundle.positions[pid])})

        return _json({"status": "updated", "position": data})
    except Exception as e:
        traceback.print_exc()
        return _json({"error": str(e)}, 500)


def register(app: web.Application) -> None:
    app.router.add_get("/api/v1/positions", handle_positions_list)
    app.router.add_get("/api/v1/positions/{position_id}", handle_position_detail)
    app.router.add_patch("/api/v1/positions/{position_id}", handle_position_update)
