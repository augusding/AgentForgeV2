"""AgentForge V2 — 每日工作上下文构建器，从 engine.py 抽取以控制文件行数。"""
from __future__ import annotations

import datetime
import time


async def build_daily_summary(
    work_item_store,
    wf_store,
    session_store,
    user_id: str,
    org_id: str,
    position_id: str,
) -> str:
    """获取完整的用户工作上下文，注入到 LLM system prompt。"""
    now = datetime.datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    weekday = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"][now.weekday()]
    parts = [f"当前时间: {now.strftime('%Y-%m-%d %H:%M')} {weekday}"]

    if work_item_store:
        try:
            pris = await work_item_store.get_priorities(user_id, org_id, position_id, status="active")
            if pris:
                items = []
                for p in pris[:5]:
                    s = f"[{p.get('priority', 'P1')}] {p['title']}"
                    if p.get("due_date"):
                        try:
                            dl = (datetime.datetime.strptime(p["due_date"], "%Y-%m-%d") - now).days
                            tag = "⚠️已逾期" if dl < 0 else "⚠️今天截止" if dl == 0 else f"还剩{dl}天" if dl <= 2 else ""
                            s += f"（截止: {p['due_date']}{', ' + tag if tag else ''}）"
                        except Exception:
                            s += f"（截止: {p['due_date']}）"
                    items.append(s)
                parts.append(f"待办事项（{len(pris)} 条）:\n  " + "\n  ".join(items))
        except Exception:
            pass

    if work_item_store:
        try:
            scheds = await work_item_store.get_schedules(user_id, org_id)
            today = [s for s in scheds if (s.get("scheduled_time") or "").startswith(today_str)]
            if today:
                items = [f"{(s.get('scheduled_time') or '').split(' ')[-1][:5]} {s['title']}"
                         + (f"（{s['duration_minutes']}分钟）" if s.get("duration_minutes") else "")
                         for s in today]
                parts.append(f"今日日程（{len(today)} 条）:\n  " + "\n  ".join(items))
        except Exception:
            pass

    if work_item_store:
        try:
            fups = await work_item_store.get_followups(user_id, org_id)
            pending = [f for f in fups if f.get("status") == "pending"]
            if pending:
                items = []
                for f in pending[:5]:
                    s = f["title"]
                    if f.get("target"):
                        s += f"（对象: {f['target']}）"
                    created = f.get("created_at", 0)
                    if created:
                        days = int((time.time() - created) / 86400)
                        if days > 0:
                            s += f" - {days}天前创建"
                    items.append(s)
                parts.append(f"待跟进（{len(pending)} 条）:\n  " + "\n  ".join(items))
        except Exception:
            pass

    if work_item_store:
        try:
            witems = await work_item_store.get_work_items(user_id, org_id, status="")
            active = [w for w in witems if w.get("status") in ("todo", "in_progress")]
            if active:
                items = [f"[{w.get('status', 'todo')}] {w['title']}" for w in active[:5]]
                parts.append(f"工作项（{len(active)} 条进行中）:\n  " + "\n  ".join(items))
        except Exception:
            pass

    if wf_store:
        try:
            wfs = await wf_store.list_workflows(org_id=org_id)
            wf_lines = []
            for wf in wfs[:5]:
                try:
                    execs = await wf_store.get_executions(wf["id"], limit=1)
                    if execs:
                        icon = "✅" if execs[0].get("status") == "completed" else "❌"
                        wf_lines.append(f"{icon} {wf.get('name', '')}（{execs[0].get('status', '')}）")
                except Exception:
                    pass
            if wf_lines:
                parts.append("工作流状态:\n  " + "\n  ".join(wf_lines))
        except Exception:
            pass

    if session_store:
        try:
            sess = await session_store.list_sessions(user_id, org_id, limit=3)
            titles = [s.get("title", "") for s in sess if s.get("title")]
            if titles:
                parts.append(f"最近对话: {'; '.join(titles[:3])}")
        except Exception:
            pass

    if len(parts) > 1:
        parts.append(
            "\n[指导] 基于以上工作上下文主动提供建议。"
            "用户提到相关事项时优先使用这些信息。"
            "发现紧急或逾期事项时主动提醒。"
        )

    return "\n".join(parts) if len(parts) > 1 else ""


async def collect_signals(signal_store, content: str, user_id: str, org_id: str, position_id: str) -> None:
    """从用户消息中用规则提取信号。"""
    if not signal_store or not content:
        return
    import re
    _pref_kw = ("以后", "每次", "总是", "不要", "记住", "偏好", "默认", "别再", "改成", "换成", "我喜欢", "我习惯", "请用", "风格", "语气")
    if any(kw in content for kw in _pref_kw) and len(content) < 500:
        await signal_store.add_signal(user_id, org_id, position_id, signal_type="preference", content=content[:200], source="chat")
    _stop = {"这个", "那个", "什么", "怎么", "为什么", "可以", "需要", "帮我", "一下", "请问", "如何", "是否"}
    if len(content) > 10:
        topics = [t for t in re.findall(r'[\u4e00-\u9fff]{2,8}', content) if t not in _stop]
        if topics:
            await signal_store.add_signal(user_id, org_id, position_id, signal_type="topic", content=max(topics, key=len), source="chat")
    _tasks = {"report": r"报告|汇报|总结|周报|月报", "analysis": r"分析|数据|对比|趋势",
              "planning": r"计划|规划|方案|策略", "communication": r"邮件|通知|发送|联系"}
    for ttype, pat in _tasks.items():
        if re.search(pat, content):
            await signal_store.add_signal(user_id, org_id, position_id, signal_type="behavior", content=ttype, source="chat")
            break


async def post_process_signals(signal_store, user_input: str, tool_calls: list[dict],
                                user_id: str, org_id: str, position_id: str) -> None:
    """对话完成后的异步后处理。"""
    if not signal_store:
        return
    try:
        if tool_calls:
            names = list(set(tc.get("name", "") for tc in tool_calls if tc.get("name")))
            if names:
                await signal_store.add_signal(user_id, org_id, position_id,
                    signal_type="behavior", content=f"tool_usage: {', '.join(names)}", source="tool")
        if len(user_input) > 500:
            await signal_store.add_signal(user_id, org_id, position_id,
                signal_type="behavior", content=f"complex_input: {len(user_input)} chars", source="chat")
    except Exception:
        pass
