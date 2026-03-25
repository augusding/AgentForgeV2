"""
AgentForge V2 — 定时任务调度器

管理 Cron 定时任务和心跳检查。
基于 asyncio 实现，不依赖外部调度库。
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Awaitable

logger = logging.getLogger(__name__)


@dataclass
class ScheduledJob:
    """定时任务定义。"""
    id: str
    name: str
    cron_expr: str                              # "0 9 * * *" 或 "*/5 * * * *"
    handler: Callable[[], Awaitable[Any]]       # 异步执行函数
    enabled: bool = True
    last_run: float = 0.0
    next_run: float = 0.0
    run_count: int = 0
    last_error: str = ""


class Scheduler:
    """
    定时任务调度器。

    用法:
        scheduler = Scheduler()
        scheduler.add_job("daily_report", "0 9 * * *", report_handler)
        await scheduler.start()
    """

    def __init__(self, check_interval: int = 60):
        self._jobs: dict[str, ScheduledJob] = {}
        self._check_interval = check_interval
        self._running = False
        self._task: asyncio.Task | None = None

    def add_job(
        self, job_id: str, name: str, cron_expr: str,
        handler: Callable[[], Awaitable[Any]], enabled: bool = True,
    ) -> None:
        """添加定时任务。"""
        job = ScheduledJob(
            id=job_id, name=name, cron_expr=cron_expr,
            handler=handler, enabled=enabled,
            next_run=self._calc_next_run(cron_expr),
        )
        self._jobs[job_id] = job
        logger.info("定时任务注册: %s [%s] next=%s", name, cron_expr, self._format_time(job.next_run))

    def remove_job(self, job_id: str) -> None:
        self._jobs.pop(job_id, None)

    def toggle_job(self, job_id: str, enabled: bool) -> None:
        job = self._jobs.get(job_id)
        if job:
            job.enabled = enabled

    def list_jobs(self) -> list[dict]:
        return [
            {
                "id": j.id, "name": j.name, "cron": j.cron_expr,
                "enabled": j.enabled, "last_run": j.last_run,
                "next_run": j.next_run, "run_count": j.run_count,
                "last_error": j.last_error,
            }
            for j in self._jobs.values()
        ]

    async def start(self) -> None:
        """启动调度循环。"""
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())
        logger.info("调度器已启动 (interval=%ds, jobs=%d)", self._check_interval, len(self._jobs))

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("调度器已停止")

    async def _loop(self) -> None:
        while self._running:
            now = time.time()
            for job in self._jobs.values():
                if not job.enabled or now < job.next_run:
                    continue
                asyncio.create_task(self._run_job(job))
                job.next_run = self._calc_next_run(job.cron_expr)
            await asyncio.sleep(self._check_interval)

    async def _run_job(self, job: ScheduledJob) -> None:
        logger.info("执行定时任务: %s", job.name)
        try:
            await job.handler()
            job.last_run = time.time()
            job.run_count += 1
            job.last_error = ""
        except Exception as e:
            job.last_error = str(e)
            logger.error("定时任务失败: %s — %s", job.name, e)

    @staticmethod
    def _calc_next_run(cron_expr: str) -> float:
        """简化的 cron 下次执行时间计算。"""
        # 完整 cron 解析需要 croniter，这里用简化逻辑
        parts = cron_expr.split()
        if len(parts) != 5:
            return time.time() + 3600  # 默认 1 小时后

        minute_part = parts[0]
        hour_part = parts[1]

        now = time.time()
        import datetime
        dt = datetime.datetime.fromtimestamp(now)

        if minute_part.startswith("*/"):
            interval = int(minute_part[2:])
            return now + interval * 60

        try:
            target_min = int(minute_part) if minute_part != "*" else dt.minute
            target_hour = int(hour_part) if hour_part != "*" else dt.hour
            target = dt.replace(hour=target_hour, minute=target_min, second=0, microsecond=0)
            if target.timestamp() <= now:
                target += datetime.timedelta(days=1)
            return target.timestamp()
        except (ValueError, TypeError):
            return now + 3600

    @staticmethod
    def _format_time(ts: float) -> str:
        import datetime
        return datetime.datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S")
