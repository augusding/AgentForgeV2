"""
AgentForge V2 — Embedding 生成

支持两种模式：
1. 本地模型 (sentence-transformers, bge-base-zh)
2. API 调用 (OpenAI-compatible embedding API)

默认尝试本地模型，失败则 fallback 到简单的 TF-IDF。
"""

from __future__ import annotations

import hashlib
import logging
from typing import Any

logger = logging.getLogger(__name__)

_EMBED_DIM = 768  # bge-base-zh 默认维度


class EmbeddingProvider:
    """
    Embedding 生成器。

    用法:
        provider = EmbeddingProvider()
        vectors = provider.encode(["文本1", "文本2"])
    """

    def __init__(self, model_name: str = "BAAI/bge-base-zh-v1.5"):
        self._model_name = model_name
        self._model = None
        self._mode = "none"
        self._init_model()

    def _init_model(self) -> None:
        """尝试加载本地模型。"""
        try:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self._model_name)
            self._mode = "local"
            logger.info("Embedding 模型加载成功: %s (local)", self._model_name)
        except ImportError:
            logger.warning("sentence-transformers 未安装，使用 hash 降级模式")
            self._mode = "hash"
        except Exception as e:
            logger.warning("模型加载失败 (%s)，使用 hash 降级模式", e)
            self._mode = "hash"

    def encode(self, texts: list[str]) -> list[list[float]]:
        """生成 embedding 向量。"""
        if self._mode == "local" and self._model:
            vectors = self._model.encode(texts, normalize_embeddings=True)
            return vectors.tolist()
        else:
            return [self._hash_embed(t) for t in texts]

    def encode_single(self, text: str) -> list[float]:
        """生成单条 embedding。"""
        return self.encode([text])[0]

    @staticmethod
    def _hash_embed(text: str, dim: int = _EMBED_DIM) -> list[float]:
        """
        降级模式：基于 hash 的伪 embedding。
        不能做语义搜索，但可以保持接口一致。
        """
        h = hashlib.sha256(text.encode("utf-8")).digest()
        # 扩展到目标维度
        result = []
        for i in range(dim):
            byte_val = h[i % len(h)]
            result.append((byte_val / 255.0) * 2 - 1)  # 归一化到 [-1, 1]
        return result

    @property
    def dimension(self) -> int:
        if self._mode == "local" and self._model:
            return self._model.get_sentence_embedding_dimension()
        return _EMBED_DIM

    @property
    def mode(self) -> str:
        return self._mode
