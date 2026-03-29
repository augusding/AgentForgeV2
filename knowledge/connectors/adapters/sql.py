"""
SQLAdapter：关系型数据库连接器

三种模式：
  row_to_doc   — 每行 → 一个 RawDoc（产品/客户/工单）
  query_to_doc — 自定义 SELECT → 结果集合并为一个文档（报表）
  table_summary — 表结构 + 示例 → 描述文档（数据字典）

安全：query_to_doc 只允许 SELECT，拒绝写操作。
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import re
import time
from typing import AsyncIterator

from knowledge.connectors.base import BaseAdapter, RawDoc

logger = logging.getLogger(__name__)

_WRITE_PATTERN = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|REPLACE|MERGE)\b", re.IGNORECASE)
_MAX_ROWS = 1000


class SQLAdapter(BaseAdapter):
    connector_type = "sql"

    def __init__(self, connector_id: str, config: dict):
        super().__init__(connector_id, config)
        self._conn_str = config.get("connection_string", "")
        self._mode = config.get("mode", "row_to_doc")
        self._table = config.get("table", "")
        self._pk = config.get("pk_column", "id")
        self._updated_col = config.get("updated_at_column", "")
        self._columns: list[str] = config.get("columns", [])
        self._sql = config.get("custom_sql", "")
        self._title_tpl = config.get("doc_title_template", "{table} #{pk}")
        self._batch = int(config.get("batch_size", 100))

    def get_config_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "connection_string": {"type": "string", "title": "数据库连接串",
                    "description": "sqlite:///data.db 或 postgresql://user:pass@host/db"},
                "mode": {"type": "string", "title": "转换模式", "default": "row_to_doc",
                    "description": "row_to_doc / query_to_doc / table_summary"},
                "table": {"type": "string", "title": "表名", "description": "row_to_doc/table_summary 必填"},
                "pk_column": {"type": "string", "title": "主键列", "default": "id"},
                "updated_at_column": {"type": "string", "title": "更新时间列", "description": "优先用时间戳增量"},
                "columns": {"type": "array", "title": "同步列（留空=全部）", "items": {"type": "string"}},
                "custom_sql": {"type": "string", "title": "自定义 SQL（query_to_doc）", "description": "只允许 SELECT"},
                "batch_size": {"type": "number", "title": "每批行数", "default": 100},
            },
            "required": ["connection_string"],
        }

    async def validate(self) -> tuple[bool, str]:
        if not self._conn_str:
            return False, "connection_string 未配置"
        if self._mode == "query_to_doc" and not self._sql:
            return False, "query_to_doc 需要 custom_sql"
        if self._mode in ("row_to_doc", "table_summary") and not self._table:
            return False, f"{self._mode} 需要 table"
        if self._mode == "query_to_doc" and _WRITE_PATTERN.search(self._sql):
            return False, "custom_sql 只允许 SELECT"
        try:
            engine = self._get_engine()
            with engine.connect() as conn:
                conn.execute(self._text("SELECT 1"))
            info = f"表: {self._table}" if self._table else "自定义查询"
            return True, f"连接成功，模式: {self._mode}，{info}"
        except Exception as e:
            return False, f"连接失败: {e}"

    async def extract(self, cursor: str | None) -> AsyncIterator[RawDoc]:
        if self._mode == "row_to_doc":
            async for doc in self._extract_rows(cursor):
                yield doc
        elif self._mode == "query_to_doc":
            doc = await self._extract_query()
            if doc: yield doc
        elif self._mode == "table_summary":
            doc = await self._extract_summary()
            if doc: yield doc

    async def _extract_rows(self, cursor: str | None) -> AsyncIterator[RawDoc]:
        import asyncio
        engine = self._get_engine()
        cols = ", ".join(self._columns) if self._columns else "*"
        offset = 0
        while True:
            if cursor and self._updated_col:
                where = f"WHERE {self._updated_col} > :cursor"
                params = {"cursor": cursor, "limit": self._batch, "offset": offset}
            elif cursor:
                where = f"WHERE {self._pk} > :cursor"
                params = {"cursor": cursor, "limit": self._batch, "offset": offset}
            else:
                where = ""
                params = {"limit": self._batch, "offset": offset}
            sql = f"SELECT {cols} FROM {self._table} {where} ORDER BY {self._pk} LIMIT :limit OFFSET :offset"
            with engine.connect() as conn:
                result = conn.execute(self._text(sql), params)
                rows = result.fetchall()
                keys = list(result.keys())
            if not rows:
                break
            for row in rows:
                doc = self._row_to_doc(dict(zip(keys, row)))
                if doc: yield doc
            offset += self._batch
            if len(rows) < self._batch:
                break
            await asyncio.sleep(0.1)

    def _row_to_doc(self, row: dict) -> RawDoc | None:
        pk_val = row.get(self._pk, "")
        lines = [f"{k}: {v}" for k, v in row.items() if v is not None]
        content = "\n".join(lines)
        if not content.strip():
            return None
        title = self._title_tpl.format(table=self._table, pk=pk_val,
            **{k: v for k, v in row.items() if isinstance(v, (str, int, float))})
        doc_id = f"sql_{self._table}_{hashlib.md5(str(pk_val).encode()).hexdigest()[:12]}"
        return RawDoc(doc_id=doc_id, content=content, title=title,
                      source_url=f"sql://{self._table}/{pk_val}", source_type="sql",
                      content_hash=hashlib.md5(content.encode()).hexdigest(),
                      extra_meta={"table": self._table, "pk": str(pk_val), "cursor": str(pk_val)})

    async def _extract_query(self) -> RawDoc | None:
        if _WRITE_PATTERN.search(self._sql):
            return None
        try:
            engine = self._get_engine()
            with engine.connect() as conn:
                result = conn.execute(self._text(self._sql), {"limit": _MAX_ROWS})
                rows = result.fetchmany(_MAX_ROWS)
                keys = list(result.keys())
            lines = [" | ".join(str(k) for k in keys)]
            for row in rows:
                lines.append(" | ".join(str(v) if v is not None else "" for v in row))
            content = "\n".join(lines)
            h = hashlib.md5(self._sql.encode()).hexdigest()[:12]
            return RawDoc(doc_id=f"sql_query_{h}", content=content,
                          title=f"SQL 查询结果（{len(rows)} 行）", source_url=f"sql://query/{h}",
                          source_type="sql", content_hash=hashlib.md5(content.encode()).hexdigest(),
                          extra_meta={"mode": "query_to_doc", "row_count": len(rows), "cursor": str(time.time())})
        except Exception as e:
            logger.error("query_to_doc 失败: %s", e)
            return None

    async def _extract_summary(self) -> RawDoc | None:
        try:
            engine = self._get_engine()
            with engine.connect() as conn:
                r0 = conn.execute(self._text(f"SELECT * FROM {self._table} LIMIT 0"))
                columns = list(r0.keys())
                r1 = conn.execute(self._text(f"SELECT * FROM {self._table} LIMIT 5"))
                samples = r1.fetchall()
                r2 = conn.execute(self._text(f"SELECT COUNT(*) FROM {self._table}"))
                total = r2.fetchone()[0]
            lines = [f"数据表: {self._table}", f"总行数: {total}", f"字段: {', '.join(columns)}", "", "示例："]
            for row in samples:
                lines.append("  " + " | ".join(f"{k}={v}" for k, v in zip(columns, row) if v is not None))
            content = "\n".join(lines)
            doc_id = f"sql_schema_{hashlib.md5(self._table.encode()).hexdigest()[:12]}"
            return RawDoc(doc_id=doc_id, content=content, title=f"数据表: {self._table}",
                          source_url=f"sql://schema/{self._table}", source_type="sql",
                          content_hash=hashlib.md5(content.encode()).hexdigest(),
                          extra_meta={"table": self._table, "mode": "table_summary", "cursor": str(time.time())})
        except Exception as e:
            logger.error("table_summary 失败: %s", e)
            return None

    def _get_engine(self):
        try:
            from sqlalchemy import create_engine
        except ImportError:
            raise RuntimeError("需要安装 sqlalchemy: pip install sqlalchemy")
        return create_engine(self._conn_str, pool_pre_ping=True)

    @staticmethod
    def _text(sql: str):
        from sqlalchemy import text
        return text(sql)
