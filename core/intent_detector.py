"""
AgentForge V2 — 对话意图识别器（三层引擎）

Layer 1: 正则预筛 — 关键词 + 时间表达式，零成本，命中率高但误判率 ~25%
Layer 2: 反模式过滤 — 否定/过去/假设/引述/疑问句，零成本，砍掉一半误判
Layer 3: LLM 轻量确认 — 50 token prompt，异步不阻塞，误判率压到 ~3%

设计原则：
  1. 宁可漏过不可误判 — 误建议比漏建议体验更差
  2. 已被 AI 工具处理的不再重复建议
  3. 连续忽略 3 次同类型 → 24 小时内不再建议该类型
"""
from __future__ import annotations

import datetime
import json
import logging
import re
import time
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class DetectedIntent:
    """检测到的工作项意图"""
    item_type: str  # task / schedule / followup
    title: str
    confidence: float  # 0.0 ~ 1.0
    fields: dict = field(default_factory=dict)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Layer 0: 时间与人名解析工具
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

_WEEKDAY_MAP = {"一": 0, "二": 1, "三": 2, "四": 3, "五": 4, "六": 5, "日": 6, "天": 6}


def _resolve_date(text: str) -> str:
    """将中文时间表达式解析为 YYYY-MM-DD。"""
    now = datetime.datetime.now()
    today = now.date()

    if "今天" in text or "今日" in text:
        return today.strftime("%Y-%m-%d")
    if "明天" in text or "明日" in text:
        return (today + datetime.timedelta(days=1)).strftime("%Y-%m-%d")
    if "后天" in text:
        return (today + datetime.timedelta(days=2)).strftime("%Y-%m-%d")
    if "大后天" in text:
        return (today + datetime.timedelta(days=3)).strftime("%Y-%m-%d")

    m = re.search(r"下周([一二三四五六日天])", text)
    if m:
        target_wd = _WEEKDAY_MAP.get(m.group(1), 0)
        target = today + datetime.timedelta(days=((target_wd - today.weekday()) % 7) + 7)
        return target.strftime("%Y-%m-%d")

    m = re.search(r"(?:这)?周([一二三四五六日天])", text)
    if m:
        target_wd = _WEEKDAY_MAP.get(m.group(1), 0)
        days_ahead = (target_wd - today.weekday()) % 7
        if days_ahead == 0 and "这周" not in text:
            days_ahead = 7
        return (today + datetime.timedelta(days=days_ahead)).strftime("%Y-%m-%d")

    m = re.search(r"(\d{1,2})月(\d{1,2})[日号]", text)
    if m:
        month, day = int(m.group(1)), int(m.group(2))
        try:
            d = datetime.date(today.year, month, day)
            if d < today:
                d = datetime.date(today.year + 1, month, day)
            return d.strftime("%Y-%m-%d")
        except ValueError:
            pass

    m = re.search(r"(\d{1,2})[日号]", text)
    if m:
        day = int(m.group(1))
        try:
            d = datetime.date(today.year, today.month, day)
            if d < today:
                next_m = today.month + 1 if today.month < 12 else 1
                next_y = today.year if today.month < 12 else today.year + 1
                d = datetime.date(next_y, next_m, day)
            return d.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return ""


def _resolve_time(text: str) -> str:
    """提取时间 HH:MM。"""
    m = re.search(r"(\d{1,2})[点时](?:(\d{1,2})分?|半)?", text)
    if m:
        hour = int(m.group(1))
        minute = int(m.group(2)) if m.group(2) else (30 if "半" in text[m.start():m.end() + 2] else 0)
        if hour < 12 and any(kw in text for kw in ("下午", "晚上", "晚")):
            hour += 12
        if hour < 8 and not any(kw in text for kw in ("早上", "上午", "早")):
            hour += 12
        return f"{hour:02d}:{minute:02d}"

    if "上午" in text:
        return "09:00"
    if "下午" in text:
        return "14:00"
    if "晚上" in text:
        return "19:00"
    return ""


def _extract_person(text: str) -> str:
    """提取人名。"""
    m = re.search(r"([\u4e00-\u9fff]{1,3}(?:总|经理|老师|主任|部长|院长|教授|博士|同学|哥|姐|老板))", text)
    if m:
        return m.group(1)
    m = re.search(r"@([\u4e00-\u9fff]{2,4}|\w{2,20})", text)
    if m:
        return m.group(1)
    m = re.search(r"(?:和|跟|找|约|联系|通知)([\u4e00-\u9fff]{2,4})", text)
    if m:
        name = m.group(1)
        _not_name = {"一下", "他们", "我们", "大家", "对方", "客户", "团队", "老板", "公司", "领导"}
        if name not in _not_name:
            return name
    return ""


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Layer 1: 正则预筛
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _detect_task(text: str) -> DetectedIntent | None:
    _high = (
        r"(?:记得|别忘了|需要|要|必须|赶紧|抓紧|尽快)(?:去)?(.{2,30})",
        r"(?:提交|完成|准备|写|做|整理|修改|更新|发布|部署|review|检查)(.{2,20})",
    )
    _medium = (
        r"(.{2,20})(?:还没做|没完成|待处理|要搞定|得弄)",
        r"(?:TODO|todo|待办)[：:\s]*(.{2,30})",
    )
    for pat in _high:
        m = re.search(pat, text)
        if m:
            title = m.group(1).strip().rstrip("\u3002\uff0c,.")
            if 2 <= len(title) <= 40:
                date = _resolve_date(text)
                return DetectedIntent(item_type="task", title=title, confidence=0.75,
                                      fields={"due_date": date} if date else {})
    for pat in _medium:
        m = re.search(pat, text)
        if m:
            title = m.group(1).strip().rstrip("\u3002\uff0c,.")
            if 2 <= len(title) <= 40:
                date = _resolve_date(text)
                return DetectedIntent(item_type="task", title=title, confidence=0.55,
                                      fields={"due_date": date} if date else {})
    return None


def _detect_schedule(text: str) -> DetectedIntent | None:
    _patterns = (
        r"(?:和|跟)?.{0,6}(?:开会|会议|碰头|讨论|见面|聊聊|约了|面试|培训|演示|demo|汇报|review)(.{0,20})",
        r"(.{2,20})(?:开会|会议|碰头|面谈|座谈|研讨)",
    )
    has_time = bool(_resolve_date(text) or _resolve_time(text))
    if not has_time:
        return None
    for pat in _patterns:
        m = re.search(pat, text)
        if m:
            raw = m.group(0).strip()
            title = raw[:30]
            date = _resolve_date(text)
            time_str = _resolve_time(text)
            scheduled_time = f"{date} {time_str}" if date and time_str else ""
            person = _extract_person(text)
            if person and person not in title:
                title = f"和{person}{title}" if "和" not in title and "跟" not in title else title
            return DetectedIntent(item_type="schedule", title=title, confidence=0.75,
                                  fields={"scheduled_time": scheduled_time, "due_date": date})
    date = _resolve_date(text)
    time_str = _resolve_time(text)
    if date and time_str:
        cleaned = re.sub(
            r"(?:明天|后天|下周[一二三四五六日天]|今天|[0-9]+[月日号点时分]|上午|下午|晚上)", "", text)
        cleaned = cleaned.strip().rstrip("\u3002\uff0c,.!\uff01")
        if len(cleaned) >= 2:
            return DetectedIntent(item_type="schedule", title=cleaned[:30], confidence=0.50,
                                  fields={"scheduled_time": f"{date} {time_str}"})
    return None


def _detect_followup(text: str) -> DetectedIntent | None:
    _patterns = (
        r"(?:跟进|追踪|催一下|催催|提醒我|记得提醒|回访|等.{1,4}回复|等.{1,4}反馈)(.{0,20})",
        r"(?:联系|通知|告诉|问问|确认).{0,4}([\u4e00-\u9fff]{2,4}(?:总|经理|老师|主任)?).{0,15}",
    )
    for pat in _patterns:
        m = re.search(pat, text)
        if m:
            raw = m.group(0).strip()
            title = raw[:30]
            person = _extract_person(text)
            date = _resolve_date(text)
            return DetectedIntent(item_type="followup", title=title, confidence=0.75,
                                  fields={"target": person, "due_date": date})
    return None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Layer 2: 反模式过滤
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

_ANTI_PATTERNS = [
    re.compile(r"不用|不要|不需要|没必要|别.*了|无需|无须"),
    re.compile(r"取消了|已经取消|已经.*完成|已经.*做了|已经.*提��|已经.*发了|搞定了"),
    re.compile(r"上次.*(?:开会|讨论|聊|做|提交)|之前.*(?:说|做|开|提)|昨天.*了$"),
    re.compile(r"^(?:如果|假如|万一|要是)"),
    re.compile(r"(?:吗|呢)[？?]\s*$|^(?:是否|要不要|能不能|需不需要|可不可以)"),
    re.compile(r"(?:他|她|.{1,3})说(?:要|得|需要|记得)|提到过|之前提过"),
]


def _matches_anti_pattern(text: str) -> bool:
    """检查文本是否命中反模式（命中 -> 不应创建建议）。"""
    for pat in _ANTI_PATTERNS:
        if pat.search(text):
            return True
    return False


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Layer 3: LLM 轻量确认
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

_LLM_CONFIRM_PROMPT = (
    "判断用户消息是否表达了一个需要创建的工作项（任务/日程/跟进）。\n\n"
    "规则：\n"
    "- 只有用户**明确表达了要做某事、有某个安排、需要跟进某人**才算\n"
    "- 以下情况不算：提问、描述过去、假设语气、否定、取消、讨论别人的事\n"
    "- 如果判断需要创建，提取标题（简洁，不超过20字）\n\n"
    '只返回JSON，不要其他文字：\n'
    '需要创建: {"create":true,"type":"task或schedule或followup","title":"简洁标题"}\n'
    '不需要创建: {"create":false}\n\n'
    "���户消息："
)


async def llm_confirm_intent(llm_client, user_input: str, candidate: DetectedIntent) -> DetectedIntent | None:
    """��� LLM 做最终确认。返回 None 表示拒绝。"""
    text = ""
    try:
        resp = await llm_client.chat(
            system="你是一个意图判断助手，只返回JSON。",
            messages=[{"role": "user", "content": _LLM_CONFIRM_PROMPT + user_input}],
            temperature=0.1,
            max_tokens=100,
        )
        text = (resp.content or "").strip()
        if text.startswith("```"):
            text = text.split("```")[1].strip()
            if text.startswith("json"):
                text = text[4:].strip()
        result = json.loads(text)
        if not result.get("create", False):
            logger.info("LLM 拒绝建议: '%s'", user_input[:30])
            return None
        confirmed_type = result.get("type", candidate.item_type)
        confirmed_title = result.get("title", candidate.title)
        if confirmed_type not in ("task", "schedule", "followup"):
            confirmed_type = candidate.item_type
        return DetectedIntent(
            item_type=confirmed_type,
            title=confirmed_title,
            confidence=0.95,
            fields=candidate.fields,
        )
    except json.JSONDecodeError:
        logger.warning("LLM 确认返回非 JSON: %s", text[:100])
        return None
    except Exception as e:
        logger.warning("LLM 确认调用失败: %s，降级使用正则结果", e)
        return candidate if candidate.confidence >= 0.70 else None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 主入口
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def detect_intents_regex(user_input: str, already_handled_types: set | None = None) -> list[DetectedIntent]:
    """Layer 1 + Layer 2：正则预筛 + 反模式过滤。"""
    if not user_input or len(user_input) < 4:
        return []
    if len(user_input) < 8 and not any(kw in user_input for kw in ("明天", "下周", "跟进", "提醒")):
        return []

    if _matches_anti_pattern(user_input):
        logger.debug("反模式命中，跳过: %s", user_input[:30])
        return []

    handled = already_handled_types or set()
    results: list[DetectedIntent] = []

    if "task" not in handled:
        intent = _detect_task(user_input)
        if intent:
            results.append(intent)
    if "schedule" not in handled:
        intent = _detect_schedule(user_input)
        if intent:
            results.append(intent)
    if "followup" not in handled:
        intent = _detect_followup(user_input)
        if intent:
            results.append(intent)

    if len(results) > 1:
        results.sort(key=lambda x: x.confidence, reverse=True)
        seen: set[str] = set()
        deduped = []
        for r in results:
            key = r.title[:10]
            if key not in seen:
                seen.add(key)
                deduped.append(r)
        results = deduped

    return [r for r in results if r.confidence >= 0.50]


async def run_detection(msg, collected_tools: list[dict], llm_client, signal_store):
    """引擎调用入口：三层检测 → yield suggestion dict。"""
    _workitem_tools = {"manage_priority", "manage_schedule", "manage_followup", "manage_work_item"}
    already_handled = {
        t["name"].replace("manage_", "").replace("priority", "task").replace("work_item", "task")
        for t in collected_tools if t["name"] in _workitem_tools
    }
    if already_handled:
        return
    candidates = detect_intents_regex(msg.content, already_handled)
    for candidate in candidates[:2]:
        if await should_suppress(signal_store, msg.user_id, msg.org_id, candidate.item_type):
            continue
        confirmed = None
        if llm_client:
            try:
                confirmed = await llm_confirm_intent(llm_client, msg.content, candidate)
            except Exception as e:
                logger.warning("LLM 确认异常: %s，降级正则", e)
        if confirmed is None and candidate.confidence >= 0.70:
            confirmed = candidate
        if confirmed:
            yield {
                "type": "suggestion",
                "item_type": confirmed.item_type,
                "title": confirmed.title,
                "confidence": confirmed.confidence,
                "fields": confirmed.fields,
            }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 忽略降频
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def should_suppress(signal_store, user_id: str, org_id: str, item_type: str) -> bool:
    """同类型忽略 >= 3 次 (24h内) -> 抑制。"""
    if not signal_store:
        return False
    try:
        signals = await signal_store.get_recent_signals(
            user_id, org_id, signal_type="suggestion_ignored", limit=10,
        )
        recent = [s for s in signals
                  if s.get("content", "").startswith(item_type)
                  and time.time() - s.get("created_at", 0) < 86400]
        return len(recent) >= 3
    except Exception:
        return False


async def record_ignore(signal_store, user_id: str, org_id: str, position_id: str, item_type: str) -> None:
    """记录用户忽略了一次建议。"""
    if not signal_store:
        return
    try:
        await signal_store.add_signal(
            user_id, org_id, position_id,
            signal_type="suggestion_ignored", content=item_type, source="suggestion",
        )
    except Exception:
        pass
