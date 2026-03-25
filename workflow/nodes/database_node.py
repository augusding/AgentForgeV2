"""数据库查询节点：SQLite"""

import logging
from workflow.registry import NodeRegistry, NodeTypeInfo
from workflow.types import WorkflowNode, NodeResult

logger = logging.getLogger(__name__)


async def _database_executor(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    db_type = node.config.get("dbType", "sqlite")
    connection = node.config.get("connection", "") or "data/memories.db"
    query = node.config.get("query", "")
    if not query:
        return NodeResult(node_id=node.id, status="failed", error="SQL 查询不能为空")
    if db_type != "sqlite":
        return NodeResult(node_id=node.id, status="failed", error=f"{db_type} 暂不支持")

    try:
        import aiosqlite
        async with aiosqlite.connect(connection) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(query)
            if query.strip().upper().startswith("SELECT"):
                rows = [dict(r) for r in await cursor.fetchall()]
                return NodeResult(node_id=node.id, status="completed", output={"items": rows, "row_count": len(rows)})
            await db.commit()
            return NodeResult(node_id=node.id, status="completed", output={"affected_rows": cursor.rowcount})
    except Exception as e:
        return NodeResult(node_id=node.id, status="failed", error=f"查询失败: {e}")


def register_database(registry: NodeRegistry) -> None:
    registry.register(NodeTypeInfo(name="database", display_name="数据库查询", group="data", icon="database",
        description="执行 SQL 查询（SQLite）", parameters=[
            {"name": "dbType", "type": "options", "displayName": "类型", "default": "sqlite",
             "options": [{"name": "SQLite", "value": "sqlite"}]},
            {"name": "connection", "type": "string", "displayName": "连接", "default": "data/memories.db"},
            {"name": "query", "type": "code", "displayName": "SQL", "default": "SELECT 1"},
        ], executor=_database_executor))
