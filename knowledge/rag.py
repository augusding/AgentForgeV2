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
        user_id: str = "",
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
        if user_id:
            meta["user_id"] = user_id

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
        top_k: int = 5,
        org_id: str = "",
        user_id: str = "",
        filter_metadata: dict | None = None,
    ) -> list[dict]:
        """
        检索相关文档块。
        返回 [{"content": str, "score": float, "metadata": dict}, ...]
        """
        if not self._collection or not self._embedding:
            return []

        query_vector = self._embedding.encode_single(query)

        base_kwargs: dict[str, Any] = {
            "query_embeddings": [query_vector],
            "n_results": top_k,
        }
        # 构建逐级降级的 where 策略
        where_strategies: list[dict[str, Any] | None] = []
        full_where: dict[str, Any] = {}
        if user_id:
            full_where["user_id"] = user_id
        if org_id:
            full_where["org_id"] = org_id
        if filter_metadata:
            full_where.update(filter_metadata)
        if full_where:
            where_strategies.append(full_where)
        if user_id and (org_id or filter_metadata):
            where_strategies.append({"user_id": user_id})
        where_strategies.append(None)

        results = None
        for where in where_strategies:
            try:
                kwargs = {**base_kwargs}
                if where:
                    kwargs["where"] = where
                results = self._collection.query(**kwargs)
                if results and results.get("documents") and results["documents"][0]:
                    break
            except Exception as e:
                logger.warning("知识库检索降级: %s (where=%s)", e, where)
                continue

        # 解析结果
        output = []
        if results and results.get("documents"):
            docs = results["documents"][0]
            distances = results.get("distances", [[]])[0]
            metadatas = results.get("metadatas", [[]])[0]

            for i, doc in enumerate(docs):
                score = 1 - distances[i] if i < len(distances) else 0
                meta = metadatas[i] if i < len(metadatas) else {}
                if meta.get("deleted"):
                    continue
                output.append({
                    "content": doc,
                    "score": round(score, 4),
                    "metadata": meta,
                })

        return output

    def delete_document(self, doc_id: str, org_id: str = "", user_id: str = "") -> int:
        """删除文档的所有分块。返回删除数。逐级降级查找确保能删到。"""
        if not self._collection:
            return 0
        strategies = []
        full_where: dict[str, Any] = {"doc_id": doc_id}
        if user_id:
            full_where["user_id"] = user_id
        if org_id:
            full_where["org_id"] = org_id
        strategies.append(full_where)
        if org_id:
            no_org: dict[str, Any] = {"doc_id": doc_id}
            if user_id:
                no_org["user_id"] = user_id
            strategies.append(no_org)
        strategies.append({"doc_id": doc_id})

        for i, where in enumerate(strategies):
            try:
                result = self._collection.get(where=where, include=[])
                ids = result.get("ids", [])
                if ids:
                    self._collection.delete(ids=ids)
                    logger.info("文档已删除: %s (%d chunks, 策略%d)", doc_id, len(ids), i + 1)
                    return len(ids)
            except Exception as e:
                logger.warning("删除策略%d失败: %s (where=%s)", i + 1, e, where)
                continue
        logger.warning("文档删除: 所有策略均未找到 doc_id=%s", doc_id)
        return 0

    def clear_all(self, org_id: str = "", user_id: str = "") -> int:
        """清空知识库。返回删除的 chunk 数。逐级降级查找。"""
        if not self._collection:
            return 0
        strategies: list[dict[str, Any] | None] = []
        if user_id and org_id:
            strategies.append({"user_id": user_id, "org_id": org_id})
        if user_id:
            strategies.append({"user_id": user_id})
        strategies.append(None)

        for where in strategies:
            try:
                if where:
                    result = self._collection.get(where=where, include=[])
                else:
                    result = self._collection.get(include=[])
                ids = result.get("ids", [])
                if ids:
                    for i in range(0, len(ids), 500):
                        self._collection.delete(ids=ids[i:i + 500])
                    logger.info("知识库已清空: %d chunks (where=%s)", len(ids), where)
                    return len(ids)
            except Exception as e:
                logger.warning("清空策略失败: %s (where=%s)", e, where)
                continue
        return 0

    def list_doc_ids_by_source(self, source_type: str, org_id: str = "", user_id: str = "") -> set[str]:
        """获取 ChromaDB 中指定 source_type 的所有 doc_id（对账用）。"""
        if not self._collection:
            return set()
        try:
            where: dict[str, Any] = {"source_type": source_type}
            if user_id:
                where["user_id"] = user_id
            if org_id:
                where["org_id"] = org_id
            result = self._collection.get(where=where, include=["metadatas"])
            return {m.get("doc_id", "") for m in (result.get("metadatas") or []) if m.get("doc_id")}
        except Exception as e:
            logger.error("list_doc_ids_by_source 失败: %s", e)
            return set()

    def soft_delete_document(self, doc_id: str, org_id: str = "", user_id: str = "") -> int:
        """软删除：标记 deleted=true，不物理删除。返回标记的 chunk 数。"""
        if not self._collection:
            return 0
        try:
            where: dict[str, Any] = {"doc_id": doc_id}
            if user_id:
                where["user_id"] = user_id
            if org_id:
                where["org_id"] = org_id
            result = self._collection.get(where=where, include=["metadatas"])
            ids = result.get("ids", [])
            if not ids:
                return 0
            import time as _t
            metadatas = result.get("metadatas", [])
            for m in metadatas:
                m["deleted"] = True
                m["deleted_at"] = _t.time()
            self._collection.update(ids=ids, metadatas=metadatas)
            logger.info("软删除: doc_id=%s chunks=%d", doc_id, len(ids))
            return len(ids)
        except Exception as e:
            logger.error("软删除失败: %s", e)
            return 0

    def purge_deleted_documents(self, retain_days: int = 30) -> dict:
        """物理清理到期的软删除文档。每日定时任务调用。"""
        if not self._collection:
            return {"purged_chunks": 0, "purged_docs": 0, "skipped": 0}
        import time
        cutoff = time.time() - retain_days * 86400
        try:
            result = self._collection.get(where={"deleted": True}, include=["metadatas"])
        except Exception:
            try:
                result = self._collection.get(include=["metadatas"])
            except Exception as e:
                logger.error("purge 查询失败: %s", e)
                return {"purged_chunks": 0, "purged_docs": 0, "skipped": 0}
        ids_to_purge: list[str] = []
        skipped = 0
        purged_doc_ids: set[str] = set()
        for chunk_id, meta in zip(result.get("ids", []), result.get("metadatas", [])):
            if not meta.get("deleted"):
                continue
            deleted_at = meta.get("deleted_at", 0)
            if deleted_at and float(deleted_at) <= cutoff:
                ids_to_purge.append(chunk_id)
                if meta.get("doc_id"):
                    purged_doc_ids.add(meta["doc_id"])
            else:
                skipped += 1
        if not ids_to_purge:
            return {"purged_chunks": 0, "purged_docs": 0, "skipped": skipped}
        total = 0
        for i in range(0, len(ids_to_purge), 500):
            try:
                self._collection.delete(ids=ids_to_purge[i:i + 500])
                total += len(ids_to_purge[i:i + 500])
            except Exception as e:
                logger.error("分批删除失败: %s", e)
        logger.info("purge 完成: chunks=%d docs=%d skipped=%d", total, len(purged_doc_ids), skipped)
        return {"purged_chunks": total, "purged_docs": len(purged_doc_ids), "skipped": skipped}

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
