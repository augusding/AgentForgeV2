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
        description="搜索知识库中的文档。当用户问关于公司政策、产品文档、操作手册、技术规范等有明确文档依据的问题时优先使用。返回最相关的文档片段和来源。注意：不要用于实时信息，那应该用 web_search。",
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


def create_knowledge_list_tool(knowledge_base):
    """创建知识库文件列表工具。"""

    async def _handler(args: dict) -> str:
        if not knowledge_base or not knowledge_base._collection:
            return json.dumps({"files": [], "message": "知识库未初始化"}, ensure_ascii=False)
        try:
            result = knowledge_base._collection.get(include=["metadatas"])
            seen: dict[str, dict] = {}
            for meta in (result.get("metadatas") or []):
                doc_id = meta.get("doc_id", "")
                if doc_id and doc_id not in seen:
                    seen[doc_id] = {"doc_id": doc_id, "filename": meta.get("filename", doc_id)}
            files = list(seen.values())
            if not files:
                return json.dumps({"files": [], "total": 0, "message": "知识库中暂无文档"}, ensure_ascii=False)
            return json.dumps({"files": files, "total": len(files)}, ensure_ascii=False)
        except Exception as e:
            return json.dumps({"error": f"获取文件列表失败: {e}"}, ensure_ascii=False)

    return ToolDefinition(
        name="list_knowledge_files",
        description="列出知识库中已上传的文档。当用户询问'知识库有什么文档''有哪些文件''知识库内容列表'时使用。",
        input_schema={"type": "object", "properties": {}, "required": []},
        handler=_handler,
        category="knowledge",
    )
