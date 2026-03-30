"""AgentForge V2 — AI 主动推送引擎。定时检测事件，通过 WebSocket 推送通知。"""

from __future__ import annotations

import asyncio
import datetime
import logging
import time

logger = logging.getLogger(__name__)


class ProactiveEngine:
    """主动推送引擎。由 Scheduler 定期调用 check_all_users。"""

    def __init__(self, work_item_store, wf_store, session_store, gateway):
        self._wis = work_item_store
        self._wfs = wf_store
        self._ss = session_store
        self._gw = gateway
        self._notified: dict[str, set[str]] = {}  # user_id → notified keys today

    def _seen(self, uid: str, key: str) -> bool:
        """返回 True 表示已通知过（应跳过）。"""
        today = datetime.date.today().isoformat()
        full = f"{today}:{key}"
        bucket = self._notified.setdefault(uid, set())
        if full in bucket:
            return True
        bucket.add(full)
        # 清理非今天的 key
        bucket -= {k for k in bucket if not k.startswith(today)}
        return False

    async def check_all_users(self) -> int:
        """检查所有在线用户，返回推送总数。"""
        if not self._gw:
            return 0
        total = 0
        for uid in list(self._gw._clients.keys()):
            try:
                for ev in await self._check_user(uid):
                    if not self._seen(uid, ev["key"]):
                        await self._gw.push_to_user(uid, {"type": "proactive_notification", "data": ev})
                        total += 1
                        logger.info("推送通知 → %s: %s", uid, ev["title"])
            except Exception as e:
                logger.warning("检查用户 %s 失败: %s", uid, e)
        return total

    async def _check_user(self, uid: str) -> list[dict]:
        now = datetime.datetime.now()
        today_str = now.strftime("%Y-%m-%d")
        events: list[dict] = []

        # 规则 1: 待办逾期 / 24h 内到期
        if self._wis:
            try:
                for p in await self._wis.get_priorities(uid, "", "", status="active"):
                    if not p.get("due_date"):
                        continue
                    try:
                        hrs = (datetime.datetime.strptime(p["due_date"], "%Y-%m-%d") - now).total_seconds() / 3600
                    except (ValueError, TypeError):
                        continue
                    if hrs < 0:
                        events.append(self._evt(f"overdue:{p['id']}", "task_overdue", f"⚠️ 已逾期：{p['title']}",
                            f"截止 {p['due_date']}，{p.get('priority','P1')}", "high",
                            {"type": "chat", "label": "立即处理", "metadata": {"prompt": f"帮我处理逾期任务：{p['title']}"}}))
                    elif hrs <= 24:
                        events.append(self._evt(f"due_soon:{p['id']}", "task_due", f"⏰ 即将到期：{p['title']}",
                            f"明天截止，{p.get('priority','P1')}", "high" if p.get("priority") == "P0" else "medium",
                            {"type": "chat", "label": "开始处理", "metadata": {"prompt": f"帮我推进任务：{p['title']}"}}))
            except Exception:
                pass

        # 规则 2: 跟进超 7 天
        if self._wis:
            try:
                for f in await self._wis.get_followups(uid, ""):
                    if f.get("status") != "pending":
                        continue
                    updated = f.get("updated_at") or f.get("created_at", 0)
                    days = (time.time() - updated) / 86400 if updated else 0
                    if days >= 7:
                        events.append(self._evt(f"followup:{f['id']}", "followup_overdue", f"📞 跟进提醒：{f['title']}",
                            f"对象 {f.get('target','')}，已 {int(days)} 天未跟进", "medium",
                            {"type": "chat", "label": "记录跟进", "metadata": {"prompt": f"帮我跟进：{f['title']}"}}))
            except Exception:
                pass

        # 规则 3: 工作流最近 24h 失败（只查自己创建的）
        if self._wfs:
            try:
                try:
                    _wf_list = await self._wfs.list_workflows(user_id=uid)
                except TypeError:
                    _wf_list = await self._wfs.list_workflows()
                for wf in _wf_list[:10]:
                    try:
                        execs = await self._wfs.get_executions(wf["id"], limit=1)
                        if execs and execs[0].get("status") == "failed":
                            t = execs[0].get("started_at", 0)
                            if isinstance(t, (int, float)) and (time.time() - t) < 86400:
                                events.append(self._evt(f"wf:{wf['id']}:{int(t)}", "workflow_failed",
                                    f"❌ 工作流失败：{wf.get('name','')}", str(execs[0].get("error",""))[:80] or "执行出错", "high",
                                    {"type": "workflow", "label": "查看详情", "metadata": {"workflowId": wf["id"]}}))
                    except Exception:
                        pass
            except Exception:
                pass

        # 规则 4: 每日简报 (9:00-9:30)
        if 9 <= now.hour < 10 and now.minute < 30 and self._wis:
            try:
                cnt = len(await self._wis.get_priorities(uid, "", "", status="active"))
                if cnt:
                    events.append(self._evt(f"brief:{today_str}", "daily_brief",
                        f"📋 早安，今天有 {cnt} 条待办", "查看 AI 今日行动建议", "low",
                        {"type": "workstation", "label": "查看今日行动"}))
            except Exception:
                pass

        return events

    @staticmethod
    def _evt(key, cat, title, body, urgency, action=None):
        return {"key": key, "category": cat, "title": title, "body": body,
                "urgency": urgency, "action": action, "created_at": time.time()}
