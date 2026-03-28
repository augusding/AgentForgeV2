"""
AgentForge V2 — 会话分析器

触发时机：1. pending_count >= 10  2. 用户 👎  3. 每日 03:05 兜底
分析结果写入 SignalStore（岗位共性）+ UserProfileStore（用户个人）。
"""
from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from core.engine import ForgeEngine

logger = logging.getLogger(__name__)

_ANALYZER_SYSTEM = "你是一个对话质量分析助手。输出严格 JSON，不要输出其他内容。"

_ANALYZER_PROMPT = """分析以下对话，识别两类信息：

【A. 对话质量信号】
1. 追问：AI 回答后用户继续追问同一问题（回答不够具体）
2. 纠正：用户明确否定或修正了 AI 的回答
3. 放弃：用户没得到想要的答案（"好吧"/"算了"/换话题）

【B. 用户个人信息】
- team_rule：团队特殊规范
- personal_context：正在做的具体工作
- preferred_style：沟通偏好

岗位：{position_id}
对话记录：
{conversation}

输出 JSON：
{{"signals": [{{"type": "追问|纠正|放弃", "turn": 2, "user_need": "一句话", "scope": "shared|personal", "suggest_field": "context|behavior|identity|values", "suggest_change": "建议修改（一句话）"}}], "personal_updates": [{{"category": "team_rule|personal_context|preferred_style", "content": "一句话"}}]}}

没有信号返回空数组。"""


def _format_conversation(messages: list[dict]) -> str:
    lines = []
    for i, m in enumerate(messages, 1):
        role = "用户" if m.get("role") == "user" else "AI"
        content = m.get("content", "").strip()
        if content:
            lines.append(f"[{i}] {role}：{content[:500]}")
    return "\n".join(lines)


async def analyze_session(engine: "ForgeEngine", session_id: str,
                          user_id: str, org_id: str, position_id: str,
                          reason: str = "batch") -> dict:
    """分析单个会话，提取信号。"""
    if not engine.session_store or not engine.signal_store:
        return {"skipped": True, "reason": "store_not_ready"}
    messages = await engine.session_store.get_history(session_id, limit=20)
    if len(messages) < 2:
        return {"skipped": True, "reason": "too_short"}
    try:
        resp = await engine._llm.chat(
            system=_ANALYZER_SYSTEM,
            messages=[{"role": "user", "content": _ANALYZER_PROMPT.format(
                position_id=position_id, conversation=_format_conversation(messages))}],
            temperature=0.2, max_tokens=1024)
        raw = resp.content.strip()
    except Exception as e:
        logger.warning("分析 LLM 失败 session=%s: %s", session_id, e)
        return {"skipped": True, "reason": str(e)}
    try:
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"): raw = raw[4:]
        result = json.loads(raw.strip())
    except json.JSONDecodeError as e:
        logger.warning("分析 JSON 解析失败: %s", raw[:200])
        return {"skipped": True, "reason": f"json_error: {e}"}

    sig_count = 0
    for sig in result.get("signals", []):
        if not sig.get("type"): continue
        await engine.signal_store.add_signal(
            user_id=user_id, org_id=org_id, position_id=position_id,
            signal_type=sig["type"],
            content=json.dumps({k: sig.get(k, "") for k in
                ("session_id", "turn", "user_need", "scope", "suggest_field", "suggest_change")},
                ensure_ascii=False),
            source=f"session_analyzer:{reason}")
        sig_count += 1

    prof_count = 0
    ups = getattr(engine, "_user_profile_store", None)
    for upd in result.get("personal_updates", []):
        cat, content = upd.get("category", ""), upd.get("content", "").strip()
        if cat and content and ups:
            await ups.upsert(user_id, org_id, position_id, cat, content)
            prof_count += 1

    logger.info("分析完成 session=%s reason=%s signals=%d profiles=%d",
                session_id, reason, sig_count, prof_count)
    return {"signals": sig_count, "personal_updates": prof_count, "skipped": False}


async def analyze_pending_sessions(engine: "ForgeEngine", org_id: str,
                                    position_id: str, user_id: str) -> dict:
    """批量分析积压会话，完成后重置计数。"""
    if not engine.session_store or not engine.signal_store:
        return {"skipped": True}
    sessions = await engine.session_store.list_sessions(
        user_id=user_id, org_id=org_id, position_id=position_id, limit=10)
    if not sessions:
        await engine.signal_store.reset_pending(org_id, position_id, user_id)
        return {"skipped": True, "reason": "no_sessions"}
    total_s, total_p = 0, 0
    for sess in sessions:
        sid = sess.get("id", "")
        if not sid: continue
        r = await analyze_session(engine, sid, user_id, org_id, position_id, "batch")
        if not r.get("skipped"):
            total_s += r.get("signals", 0)
            total_p += r.get("personal_updates", 0)
    await engine.signal_store.reset_pending(org_id, position_id, user_id)
    return {"sessions": len(sessions), "signals": total_s, "personal_updates": total_p}


async def run_daily_scan(engine: "ForgeEngine") -> None:
    """每日兜底扫描：pending_count >= 10 或超过 3 天的条目。"""
    if not engine.signal_store: return
    pending = await engine.signal_store.get_pending_list(min_count=10, stale_days=3.0, limit=50)
    if not pending:
        logger.info("定时扫描：无待分析条目"); return
    logger.info("定时扫描：%d 个待分析条目", len(pending))
    for item in pending:
        try:
            await analyze_pending_sessions(engine, item.get("org_id", ""),
                                            item["position_id"], item["user_id"])
        except Exception as e:
            logger.warning("定时扫描失败 %s: %s", item.get("id"), e)
