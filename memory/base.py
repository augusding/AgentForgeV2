"""
AgentForge V2 — 存储层基础工具

提供 SQLite 连接管理和公共工具方法。
所有 Store 继承此基类。
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

import aiosqlite

logger = logging.getLogger(__name__)


class BaseStore:
    """SQLite Store 基类。提供连接管理和初始化框架。"""

    def __init__(self, db_path: str = "data/memories.db"):
        self._db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._initialized = False

    @asynccontextmanager
    async def _db(self):
        """异步上下文管理器：获取 DB 连接，用完自动关闭。"""
        db = await aiosqlite.connect(self._db_path)
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA journal_mode=WAL")
        try:
            yield db
        finally:
            await db.close()

    async def ensure_tables(self) -> None:
        """创建所需的表（只执行一次）。"""
        if self._initialized:
            return
        async with self._db() as db:
            await self._create_tables(db)
            await db.commit()
        self._initialized = True

    async def _create_tables(self, db: aiosqlite.Connection) -> None:
        """子类覆写：DDL 语句。"""
        raise NotImplementedError
