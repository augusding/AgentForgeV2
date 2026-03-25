"""AgentForge V2 — 统一触发器管理：Cron/Webhook/Chat 三种触发方式。"""

from __future__ import annotations

import logging
from typing import Any, Callable, Awaitable

logger = logging.getLogger(__name__)


class TriggerManager:
    """统一触发器管理。"""

    def __init__(self, workflow_store, workflow_engine, scheduler=None, llm_client=None):
        self._store = workflow_store
        self._engine = workflow_engine
        self._scheduler = scheduler
        self._llm = llm_client
        self._webhook_map: dict[str, str] = {}  # trigger_id → workflow_id
        self._chat_triggers: list[dict] = []

    async def load_triggers(self) -> int:
        """从所有工作流中加载触发器配置。返回加载数量。"""
        workflows = await self._store.list_workflows()
        count = 0
        for wf_info in workflows:
            if not wf_info.get("enabled", True):
                continue
            wf = await self._store.get_workflow(wf_info["id"])
            if not wf or not wf.trigger:
                continue
            trigger_type = wf.trigger.get("type", "")

            if trigger_type == "cron" and self._scheduler:
                cron_expr = wf.trigger.get("cron", "")
                if cron_expr:
                    self._scheduler.add_job(
                        job_id=f"wf_{wf.id}", name=f"工作流: {wf.name}",
                        cron_expr=cron_expr, handler=self._make_cron_handler(wf.id))
                    count += 1
                    logger.info("Cron 触发器: %s [%s]", wf.name, cron_expr)

            elif trigger_type == "webhook":
                trigger_id = wf.trigger.get("trigger_id", wf.id)
                self._webhook_map[trigger_id] = wf.id
                count += 1
                logger.info("Webhook 触发器: %s → %s", trigger_id, wf.name)

            elif trigger_type == "chat":
                self._chat_triggers.append({
                    "workflow_id": wf.id, "name": wf.name,
                    "keywords": wf.trigger.get("keywords", []),
                    "description": wf.trigger.get("description", wf.name),
                })
                count += 1

        logger.info("触发器加载完成: %d 个", count)
        return count

    async def handle_webhook(self, trigger_id: str, data: dict, context: dict | None = None) -> dict:
        """处理 Webhook 触发。"""
        workflow_id = self._webhook_map.get(trigger_id)
        if not workflow_id:
            return {"error": f"未找到触发器: {trigger_id}"}
        wf = await self._store.get_workflow(workflow_id)
        if not wf:
            return {"error": f"工作流不存在: {workflow_id}"}

        logger.info("Webhook 触发工作流: %s (trigger=%s)", wf.name, trigger_id)
        execution = await self._engine.run(wf, trigger_data=data, context=context or {})

        node_results = {
            nid: {"status": nr.status, "output": nr.output, "error": nr.error, "duration": nr.duration}
            for nid, nr in execution.node_results.items()
        }
        await self._store.save_execution(
            exec_id=execution.id, workflow_id=workflow_id, status=execution.status,
            node_results=node_results, variables=execution.variables,
            trigger_type="webhook", trigger_data=data,
            started_at=execution.started_at, completed_at=execution.completed_at,
            error=execution.error,
        )
        return {
            "execution_id": execution.id, "workflow": wf.name,
            "status": execution.status,
            "duration": execution.completed_at - execution.started_at,
        }

    def match_chat_trigger(self, message: str) -> dict | None:
        """匹配聊天消息是否触发某个工作流。"""
        msg_lower = message.lower()
        for t in self._chat_triggers:
            for kw in t["keywords"]:
                if kw.lower() in msg_lower:
                    return {"workflow_id": t["workflow_id"], "name": t["name"], "matched_keyword": kw}
        return None

    def _make_cron_handler(self, workflow_id: str) -> Callable[[], Awaitable[Any]]:
        """创建 cron 任务的执行函数。"""
        async def _handler():
            wf = await self._store.get_workflow(workflow_id)
            if not wf:
                logger.warning("Cron 执行失败: 工作流 %s 不存在", workflow_id)
                return
            execution = await self._engine.run(wf, trigger_data={"trigger": "cron"})
            node_results = {
                nid: {"status": nr.status, "output": nr.output, "error": nr.error}
                for nid, nr in execution.node_results.items()
            }
            await self._store.save_execution(
                exec_id=execution.id, workflow_id=workflow_id, status=execution.status,
                node_results=node_results, variables=execution.variables,
                trigger_type="cron", started_at=execution.started_at,
                completed_at=execution.completed_at,
            )
            logger.info("Cron 执行完成: %s → %s", wf.name, execution.status)
        return _handler

    def get_webhook_ids(self) -> list[str]:
        return list(self._webhook_map.keys())

    def get_chat_triggers(self) -> list[dict]:
        return self._chat_triggers
