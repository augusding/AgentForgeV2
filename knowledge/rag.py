"""
AgentForge V2 — KnowledgeBase

统一的知识库接口：文档存入 + 检索。
内部使用 Chunker → Embedding → ChromaDB 向量存储。
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any
from uuid import uuid4

logger = logging.getLogger(__name__)


class KnowledgeBase:
    """
    知识库管理器。

    用法:
        kb = KnowledgeBase(data_dir="data")
        await kb.init()
        kb.add_document("doc1", "文档内容...", {"source": "manual"})
        results = kb.search("查询内容", top_k=3)
    """

    def __init__(
        self,
        data_dir: str = "data",
        collection_name: str = "knowledge",
        chunk_size: int = 500,
        chunk_overlap: int = 100,
    ):
        self._data_dir = data_dir
        self._collection_name = collection_name
        self._chunk_size = chunk_size
        self._chunk_overlap = chunk_overlap

        self._chroma_client = None
        self._collection = None
        self._embedding = None
        self._chunker = None
        self._initialized = False

    async def init(self) -> None:
        """初始化知识库组件。"""
        if self._initialized:
            return

        from knowledge.chunker import DocumentChunker
        from knowledge.embedding import EmbeddingProvider

        self._chunker = DocumentChunker(
            chunk_size=self._chunk_size,
            overlap=self._chunk_overlap,
        )
        self._embedding = EmbeddingProvider()

        # ChromaDB
        try:
            import chromadb
            chroma_path = os.path.join(self._data_dir, "chroma")
            os.makedirs(chroma_path, exist_ok=True)
            self._chroma_client = chromadb.PersistentClient(path=chroma_path)
            self._collection = self._chroma_client.get_or_create_collection(
                name=self._collection_name,
                metadata={"hnsw:space": "cosine"},
            )
            logger.info(
                "KnowledgeBase 初始化完成: collection=%s docs=%d",
                self._collection_name,
                self._collection.count(),
            )
        except ImportError:
            logger.warning("chromadb 未安装，知识库功能不可用")
        except Exception as e:
            logger.error("ChromaDB 初始化失败: %s", e)

        self._initialized = True

    def add_document(
        self,
        doc_id: str,
        content: str,
        metadata: dict | None = None,
        is_markdown: bool = False,
        org_id: str = "",
    ) -> int:
        """
        添加文档到知识库。
        返回分块数量。
        """
        if not self._collection or not self._chunker or not self._embedding:
            logger.warning("知识库未初始化")
            return 0

        meta = metadata or {}
        meta["doc_id"] = doc_id
        if org_id:
            meta["org_id"] = org_id

        # 分块
        if is_markdown:
            chunks = self._chunker.chunk_markdown(content, meta)
        else:
            chunks = self._chunker.chunk_text(content, meta)

        if not chunks:
            return 0

        # 生成 embedding
        texts = [c.content for c in chunks]
        vectors = self._embedding.encode(texts)

        # 存入 ChromaDB
        ids = [f"{doc_id}_{i}" for i in range(len(chunks))]
        metadatas = [c.metadata for c in chunks]

        # ChromaDB 不接受 None 值，清理 metadata
        clean_metadatas = []
        for m in metadatas:
            clean = {}
            for k, v in m.items():
                if v is not None and isinstance(v, (str, int, float, bool)):
                    clean[k] = v
            clean_metadatas.append(clean)

        self._collection.upsert(
            ids=ids,
            embeddings=vectors,
            documents=texts,
            metadatas=clean_metadatas,
        )

        logger.info("文档已添加: doc_id=%s chunks=%d", doc_id, len(chunks))
        return len(chunks)

    def search(
        self,
        query: str,
        top_k: int = 3,
        org_id: str = "",
        filter_metadata: dict | None = None,
    ) -> list[dict]:
        """
        检索相关文档块。
        返回 [{"content": str, "score": float, "metadata": dict}, ...]
        """
        if not self._collection or not self._embedding:
            return []

        query_vector = self._embedding.encode_single(query)

        kwargs: dict[str, Any] = {
            "query_embeddings": [query_vector],
            "n_results": top_k,
        }
        where_clause: dict[str, Any] = {}
        if org_id:
            where_clause["org_id"] = org_id
        if filter_metadata:
            where_clause.update(filter_metadata)
        if where_clause:
            kwargs["where"] = where_clause

        try:
            results = self._collection.query(**kwargs)
        except Exception as e:
            logger.error("知识库检索失败: %s", e)
            return []

        # 解析结果
        output = []
        if results and results.get("documents"):
            docs = results["documents"][0]
            distances = results.get("distances", [[]])[0]
            metadatas = results.get("metadatas", [[]])[0]

            for i, doc in enumerate(docs):
                score = 1 - distances[i] if i < len(distances) else 0  # cosine distance → similarity
                meta = metadatas[i] if i < len(metadatas) else {}
                output.append({
                    "content": doc,
                    "score": round(score, 4),
                    "metadata": meta,
                })

        return output

    def delete_document(self, doc_id: str, org_id: str = "") -> None:
        """删除文档的所有分块。"""
        if not self._collection:
            return
        try:
            where: dict[str, Any] = {"doc_id": doc_id}
            if org_id:
                where["org_id"] = org_id
            self._collection.delete(where=where)
            logger.info("文档已删除: %s", doc_id)
        except Exception as e:
            logger.error("删除文档失败: %s", e)

    def get_stats(self) -> dict:
        """获取知识库统计信息。"""
        if not self._collection:
            return {"status": "not_initialized", "count": 0}
        return {
            "status": "ok",
            "count": self._collection.count(),
            "collection": self._collection_name,
            "embedding_mode": self._embedding.mode if self._embedding else "none",
        }
