"""
AgentForge V2 — 系统配置路由

GET/POST /api/v1/config — 读取/保存系统配置（LLM tiers 等）
POST /api/v1/llm/test-key — 测试 LLM 连接
"""

import json
import logging
import os

from aiohttp import web

logger = logging.getLogger(__name__)


def _json(data, status=200):
    return web.Response(
        text=json.dumps(data, ensure_ascii=False, default=str),
        content_type="application/json", status=status,
    )


async def handle_config_get(request):
    """GET /api/v1/config — 系统配置（admin 返回完整 LLM 配置）"""
    engine = request.app["engine"]
    cfg = engine.config
    user = request.get("user") or {}
    role = user.get("role", "") if isinstance(user, dict) else ""
    is_admin = role in ("admin", "superadmin")

    result = {
        "name": cfg.name if cfg else "AgentForge",
        "version": cfg.version if cfg else "2.0.0",
        "language": cfg.language if cfg else "zh-CN",
    }

    # Admin: 返回完整 LLM 配置
    if is_admin and cfg:
        llm_cfg = cfg.llm or {} if hasattr(cfg, 'llm') else {}
        if isinstance(llm_cfg, dict):
            tiers = {}
            for tk in ["tier1", "tier2", "tier3"]:
                t = llm_cfg.get("tiers", {}).get(tk)
                if t:
                    tiers[tk] = {
                        "provider": t.get("provider", ""),
                        "model": t.get("model", ""),
                        "api_key_env": t.get("api_key_env", ""),
                        "has_key": bool(os.environ.get(t.get("api_key_env", ""), "")),
                        "enabled": t.get("enabled", tk == "tier1"),
                    }
            result["llm"] = {
                "tiers": tiers,
                "cooldown_seconds": llm_cfg.get("cooldown_seconds", 300),
                "providers": [
                    {"id": "deepseek", "name": "DeepSeek", "models": [
                        {"id": "deepseek-chat", "name": "DeepSeek Chat"},
                        {"id": "deepseek-reasoner", "name": "DeepSeek Reasoner"},
                    ]},
                    {"id": "anthropic", "name": "Anthropic", "models": [
                        {"id": "claude-sonnet-4-5-20250929", "name": "Claude Sonnet 4.5"},
                        {"id": "claude-haiku-4-5-20251001", "name": "Claude Haiku 4.5"},
                    ]},
                    {"id": "openai", "name": "OpenAI", "models": [
                        {"id": "gpt-4o", "name": "GPT-4o"},
                        {"id": "gpt-4o-mini", "name": "GPT-4o Mini"},
                    ]},
                    {"id": "qwen", "name": "通义千问", "models": [
                        {"id": "qwen-plus", "name": "Qwen Plus"},
                        {"id": "qwen-turbo", "name": "Qwen Turbo"},
                    ]},
                ],
            }

    return _json(result)


async def handle_config_save(request):
    """POST /api/v1/config — 保存系统配置（仅 admin）"""
    user = request.get("user") or {}
    role = user.get("role", "") if isinstance(user, dict) else ""
    if role not in ("admin", "superadmin"):
        return _json({"error": "无权操作"}, 403)

    engine = request.app["engine"]
    body = await request.json()

    llm_update = body.get("llm", {})
    if llm_update and llm_update.get("tiers"):
        import yaml
        config_path = engine.root_dir / "forge.yaml"
        try:
            raw = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
        except Exception:
            raw = {}
        if "llm" not in raw:
            raw["llm"] = {}
        if "tiers" not in raw["llm"]:
            raw["llm"]["tiers"] = {}

        for tk, tv in llm_update["tiers"].items():
            tier = raw["llm"]["tiers"].setdefault(tk, {})
            if tv.get("provider"):
                tier["provider"] = tv["provider"]
            if tv.get("model"):
                tier["model"] = tv["model"]
            if tv.get("api_key_env"):
                tier["api_key_env"] = tv["api_key_env"]
            if tk != "tier1":
                tier["enabled"] = tv.get("enabled", False)
            if tv.get("api_key"):
                env_name = tv.get("api_key_env", f"{tv.get('provider', 'UNKNOWN').upper()}_API_KEY")
                os.environ[env_name] = tv["api_key"]
                tier["api_key_env"] = env_name

        config_path.write_text(
            yaml.dump(raw, allow_unicode=True, default_flow_style=False),
            encoding="utf-8",
        )
        if hasattr(engine.config, 'llm'):
            engine.config.llm = raw.get("llm", {})

    return _json({"status": "saved"})


async def handle_llm_test(request):
    """POST /api/v1/llm/test-key — 测试 LLM 连接"""
    body = await request.json()
    provider = body.get("provider", "")
    model = body.get("model", "")
    api_key = body.get("api_key", "")

    if not provider or not model:
        return _json({"error": "provider 和 model 必填"}, 400)

    if not api_key:
        env_map = {
            "deepseek": "DEEPSEEK_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY",
            "openai": "OPENAI_API_KEY",
            "qwen": "DASHSCOPE_API_KEY",
        }
        api_key = os.environ.get(env_map.get(provider, ""), "")

    if not api_key:
        return _json({"error": "未找到 API Key"}, 400)

    try:
        if provider == "anthropic":
            import anthropic
            c = anthropic.AsyncAnthropic(api_key=api_key)
            await c.messages.create(
                model=model, max_tokens=10,
                messages=[{"role": "user", "content": "hi"}],
            )
        else:
            import aiohttp
            base_urls = {
                "deepseek": "https://api.deepseek.com/v1",
                "openai": "https://api.openai.com/v1",
                "qwen": "https://dashscope.aliyuncs.com/compatible-mode/v1",
            }
            base = base_urls.get(provider, f"https://api.{provider}.com/v1")
            async with aiohttp.ClientSession() as sess:
                async with sess.post(
                    f"{base}/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={"model": model, "messages": [{"role": "user", "content": "hi"}], "max_tokens": 10},
                    timeout=aiohttp.ClientTimeout(total=15),
                ) as r:
                    if r.status >= 400:
                        text = await r.text()
                        return _json({"error": f"HTTP {r.status}: {text[:100]}"}, 400)

        return _json({"status": "ok", "message": f"{provider}/{model} 连接成功"})
    except Exception as e:
        return _json({"error": str(e)[:200]}, 400)


def register(app: web.Application) -> None:
    r = app.router
    r.add_get("/api/v1/config", handle_config_get)
    r.add_post("/api/v1/config", handle_config_save)
    r.add_patch("/api/v1/config", handle_config_save)
    r.add_post("/api/v1/llm/test-key", handle_llm_test)
