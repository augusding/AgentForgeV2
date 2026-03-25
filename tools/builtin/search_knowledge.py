"""AgentForge V2 — 知识库搜索工具，让 Agent 能主动检索知识库。"""

import json
from tools.registry import ToolDefinition


def create_search_knowledge_tool(knowledge_base):
    """创建知识库搜索工具（需要 KnowledgeBase 实例）。"""

    async def _handler(args: dict) -> str:
        query = args.get("query", "")
        top_k = args.get("top_k", 3)
        if not query:
            return json.dumps({"error": "query 不能为空"}, ensure_ascii=False)
        results = knowledge_base.search(query, top_k=top_k)
        if not results:
            return json.dumps({"results": [], "message": "未找到相关文档"}, ensure_ascii=False)
        formatted = []
        for r in results:
            formatted.append({
                "content": r["content"][:500],
                "score": r["score"],
                "source": r.get("metadata", {}).get("doc_id", ""),
            })
        return json.dumps({"results": formatted}, ensure_ascii=False)

    return ToolDefinition(
        name="search_knowledge",
        description="搜索知识库，查找与查询内容相关的文档片段。当需要查阅内部文档、规范、历史资料时使用。",
        input_schema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "搜索关键词或问题"},
                "top_k": {"type": "integer", "description": "返回结果数量，默认3", "default": 3},
            },
            "required": ["query"],
        },
        handler=_handler,
        category="search",
    )
