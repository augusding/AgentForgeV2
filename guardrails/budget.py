"""
AgentForge V2 — 预算守护

按日限额控制 token 消耗，支持警告阈值和硬停止。
"""

from __future__ import annotations

import logging
import time

logger = logging.getLogger(__name__)


class BudgetGuard:
    """
    预算守护器。

    用法:
        guard = BudgetGuard(daily_limit_usd=100)
        guard.check()  # raises BudgetExhaustedError if over limit
        guard.record(cost_usd=0.05)
    """

    def __init__(
        self,
        daily_limit_usd: float = 100.0,
        warning_threshold: float = 0.8,
        hard_stop: bool = True,
    ):
        self.daily_limit = daily_limit_usd
        self.warning_threshold = warning_threshold
        self.hard_stop = hard_stop
        self._today_cost: float = 0.0
        self._today_date: str = ""

    def _reset_if_new_day(self) -> None:
        today = time.strftime("%Y-%m-%d")
        if today != self._today_date:
            self._today_cost = 0.0
            self._today_date = today

    def record(self, cost_usd: float) -> None:
        """记录消耗。"""
        self._reset_if_new_day()
        self._today_cost += cost_usd

        ratio = self._today_cost / self.daily_limit if self.daily_limit > 0 else 0
        if ratio >= self.warning_threshold:
            logger.warning(
                "预算警告: 今日已消耗 $%.2f / $%.2f (%.0f%%)",
                self._today_cost, self.daily_limit, ratio * 100,
            )

    def check(self) -> None:
        """检查是否超预算，超了则抛异常。"""
        self._reset_if_new_day()
        if self.hard_stop and self.daily_limit > 0 and self._today_cost >= self.daily_limit:
            raise BudgetExhaustedError(
                f"今日预算已用尽: ${self._today_cost:.2f} / ${self.daily_limit:.2f}"
            )

    @property
    def remaining_usd(self) -> float:
        self._reset_if_new_day()
        return max(0, self.daily_limit - self._today_cost)

    @property
    def usage_ratio(self) -> float:
        self._reset_if_new_day()
        return self._today_cost / self.daily_limit if self.daily_limit > 0 else 0


class BudgetExhaustedError(Exception):
    """预算耗尽异常。"""
