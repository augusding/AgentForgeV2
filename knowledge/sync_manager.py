"""
SyncManager：连接器同步调度引擎

并发控制：Connector 级 Lock + Org 级 Semaphore(3)
断路器：CLOSED → OPEN（5次失败，熔断300s）→ HALF_OPEN → CLOSED
错误恢复：指数退避重试 + DLQ + Cursor checkpoint
"""
from __future__ import annotations

import asyncio
import enum
import logging
import time
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

BATCH_DELAY = 0.3
MAX_RETRY = 3
RETRY_BASE = 1.0
CB_FAIL_THRESHOLD = 5
CB_OPEN_SECONDS = 300


class CBState(enum.Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreaker:
    def __init__(self, cid: str):
        self.cid = cid
        self.state = CBState.CLOSED
        self._fails = 0
        self._opened_at: float | None = None

    def allow(self) -> bool:
        if self.state == CBState.CLOSED:
            return True
        if self.state == CBState.OPEN:
            if time.time() - (self._opened_at or 0) >= CB_OPEN_SECONDS:
                self.state = CBState.HALF_OPEN
                logger.info("断路器 HALF_OPEN: %s", self.cid)
                return True
            return False
        return True

    def ok(self) -> None:
        self._fails = 0
        self.state = CBState.CLOSED

    def fail(self) -> None:
        self._fails += 1
        if self.state == CBState.HALF_OPEN or self._fails >= CB_FAIL_THRESHOLD:
            self.state = CBState.OPEN
            self._opened_at = time.time()
            logger.warning("断路器 OPEN: %s fails=%d", self.cid, self._fails)

    def status(self) -> dict:
        return {"state": self.state.value, "fail_count": self._fails,
                "opened_at": self._opened_at}


@dataclass
class SyncResult:
    connector_id: str = ""
    status: str = "success"
    total: int = 0
    indexed: int = 0
    skipped: int = 0
    filtered: int = 0
    failed: int = 0
    duration_seconds: float = 0.0
    errors: list[str] = field(default_factory=list)
    cursor: str | None = None


class SyncManager:

    def __init__(self, connector_store, knowledge_base):
        from knowledge.pipeline.quality_filter import QualityFilter
        self._store = connector_store
        self._kb = knowledge_base
        self._qf = QualityFilter()
        self._c_locks: dict[str, asyncio.Lock] = {}
        self._o_sems: dict[str, asyncio.Semaphore] = {}
        self._cbs: dict[str, CircuitBreaker] = {}
        self._running: set[str] = set()

    def is_running(self, cid: str) -> bool:
        return cid in self._running

    def circuit_status(self, cid: str) -> dict:
        cb = self._cbs.get(cid)
        return cb.status() if cb else {"state": "closed", "fail_count": 0}

    async def sync(self, connector_id: str, org_id: str = "",
                   force_full: bool = False) -> SyncResult:
        lock = self._c_locks.setdefault(connector_id, asyncio.Lock())
        if lock.locked():
            return SyncResult(connector_id=connector_id, status="already_running")

        cb = self._cbs.setdefault(connector_id, CircuitBreaker(connector_id))
        if not cb.allow():
            return SyncResult(connector_id=connector_id, status="circuit_open")

        sem = self._o_sems.setdefault(org_id or "_default", asyncio.Semaphore(3))

        async with lock, sem:
            self._running.add(connector_id)
            try:
                r = await self._do_sync(connector_id, org_id, force_full)
                cb.fail() if r.failed > r.indexed else cb.ok()
                return r
            except Exception as e:
                cb.fail()
                logger.error("同步异常: %s — %s", connector_id, e, exc_info=True)
                return SyncResult(connector_id=connector_id, status="error", errors=[str(e)])
            finally:
                self._running.discard(connector_id)

    async def sync_all_due(self, org_id: str = "") -> list[SyncResult]:
        conns = await self._store.list_by_org(org_id)
        now = time.time()
        tasks = [
            self.sync(c["id"], org_id=c.get("org_id", ""))
            for c in conns
            if c.get("enabled", True)
            and now - (c.get("last_sync_at") or 0) >= c.get("sync_interval_minutes", 60) * 60
        ]
        return list(await asyncio.gather(*tasks)) if tasks else []

    async def _do_sync(self, cid: str, org_id: str, force_full: bool) -> SyncResult:
        r = SyncResult(connector_id=cid)
        t0 = time.time()

        cfg = await self._store.get(cid)
        if not cfg or not cfg.get("enabled", True):
            r.status = "skipped"
            return r

        from knowledge.connectors.registry import get_registry
        try:
            adapter = get_registry().build(cid, cfg["connector_type"], cfg["config"])
        except Exception as e:
            r.status = "error"
            r.errors.append(str(e))
            return r

        cursor = None if force_full else cfg.get("last_cursor")
        last_cursor = cursor
        _synced_ids: set[str] = set()
        logger.info("同步开始: %s type=%s cursor=%s", cid, cfg["connector_type"], cursor)

        try:
            async for raw in adapter.extract(cursor):
                r.total += 1
                fr = self._qf.filter(raw)
                if fr.skipped:
                    r.skipped += 1
                    continue
                if fr.doc is None:
                    r.filtered += 1
                    continue
                try:
                    await self._index_retry(fr.doc, org_id)
                    r.indexed += 1
                    _synced_ids.add(fr.doc.doc_id)
                    if r.indexed % 10 == 0 and raw.extra_meta.get("cursor"):
                        last_cursor = raw.extra_meta["cursor"]
                        await self._store.update_sync_result(cid, "running", r.indexed, last_cursor)
                except Exception as e:
                    r.failed += 1
                    r.errors.append(f"索引失败 {raw.doc_id}: {e}")
                    await self._store.dlq_add(cid, org_id, raw.doc_id, raw.source_url, str(e))
                await asyncio.sleep(0)
        except Exception as e:
            r.status = "error"
            r.errors.append(f"extract 异常: {e}")

        # 全量同步对账：清理孤儿文档
        if force_full and r.status != "error":
            orphans = await self._reconcile(cid, org_id, cfg["connector_type"], _synced_ids)
            if orphans:
                logger.info("对账清理孤儿文档: connector=%s count=%d", cid, orphans)

        r.duration_seconds = round(time.time() - t0, 2)
        r.status = "success" if not r.errors else "partial"
        r.cursor = last_cursor
        await self._store.update_sync_result(cid, r.status, r.indexed, last_cursor)
        logger.info("同步完成: %s total=%d indexed=%d skipped=%d filtered=%d failed=%d cost=%.1fs",
                    cid, r.total, r.indexed, r.skipped, r.filtered, r.failed, r.duration_seconds)
        return r

    async def _reconcile(self, connector_id: str, org_id: str,
                          source_type: str, synced_doc_ids: set[str]) -> int:
        """对账：软删除 ChromaDB 中存在但本次未拉取到的孤儿文档。"""
        if not self._kb:
            return 0
        try:
            existing = self._kb.list_doc_ids_by_source(source_type, org_id)
            orphans = existing - synced_doc_ids
            if not orphans:
                return 0
            for doc_id in orphans:
                self._kb.soft_delete_document(doc_id, org_id)
            logger.info("对账: connector=%s 孤儿=%d", connector_id, len(orphans))
            return len(orphans)
        except Exception as e:
            logger.error("对账失败: %s", e)
            return 0

    async def _index_retry(self, doc, org_id: str) -> None:
        exc = None
        for i in range(MAX_RETRY):
            try:
                self._index(doc, org_id)
                return
            except Exception as e:
                exc = e
                if i < MAX_RETRY - 1:
                    await asyncio.sleep(RETRY_BASE * (2 ** i))
        raise exc

    def _index(self, doc, org_id: str) -> None:
        meta = {
            "source": doc.source_url, "source_type": doc.source_type,
            "title": doc.title, "filename": doc.title,
            "content_hash": doc.content_hash,
            "quality_score": doc.quality_score, "lang": doc.lang,
            **{k: v for k, v in doc.extra_meta.items()
               if isinstance(v, (str, int, float, bool))},
        }
        self._kb.add_document(doc_id=doc.doc_id, content=doc.content,
                               metadata=meta, org_id=org_id)
