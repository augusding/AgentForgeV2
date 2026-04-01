"""
AgentForge V2 — Embedding 生成

使用 DashScope text-embedding-v3 API 生成向量。
降级策��：API 不可用时 fallback 到 hash（仅保持接口不崩溃）。
"""
from __future__ import annotations

import hashlib
import logging
import os

import httpx

logger = logging.getLogger(__name__)

_API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings"
_API_MODEL = "text-embedding-v3"
_HASH_DIM = 1024
_BATCH_SIZE = 25


class EmbeddingProvider:
    def __init__(self):
        # 确保 .env 已加载
        try:
            from dotenv import load_dotenv
            load_dotenv()
        except ImportError:
            pass

        self._api_key = os.environ.get("DASHSCOPE_API_KEY", "")
        self._mode = "hash"
        self._dim = _HASH_DIM

        if self._api_key:
            try:
                test = self._api_call(["测试"])
                if test and len(test) == 1 and len(test[0]) > 0:
                    self._mode = "api"
                    self._dim = len(test[0])
                    logger.info("Embedding 初始化成功: DashScope API (%s), dim=%d", _API_MODEL, self._dim)
                else:
                    logger.warning("DashScope Embedding API 返回异常，降级为 hash")
            except Exception as e:
                logger.warning("DashScope Embedding API 验证失败: %s，降级为 hash", e)
        else:
            logger.warning("DASHSCOPE_API_KEY 未配置，Embedding 使用 hash 模式（RAG 无法正常工作）")

    def encode(self, texts: list[str]) -> list[list[float]]:
        if self._mode == "api":
            return self._api_encode_batched(texts)
        return [self._hash_embed(t) for t in texts]

    def encode_single(self, text: str) -> list[float]:
        return self.encode([text])[0]

    def _api_encode_batched(self, texts: list[str]) -> list[list[float]]:
        all_vectors: list[list[float]] = []
        for i in range(0, len(texts), _BATCH_SIZE):
            batch = texts[i:i + _BATCH_SIZE]
            try:
                all_vectors.extend(self._api_call(batch))
            except Exception as e:
                logger.error("Embedding API 批次 %d 失败: %s，用 hash 填充", i // _BATCH_SIZE, e)
                all_vectors.extend([self._hash_embed(t) for t in batch])
        return all_vectors

    def _api_call(self, texts: list[str]) -> list[list[float]]:
        resp = httpx.post(_API_URL, json={"model": _API_MODEL, "input": texts, "encoding_format": "float"},
            headers={"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"}, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        embeddings = sorted(data["data"], key=lambda x: x["index"])
        return [e["embedding"] for e in embeddings]

    @staticmethod
    def _hash_embed(text: str, dim: int = _HASH_DIM) -> list[float]:
        h = hashlib.sha256(text.encode("utf-8")).digest()
        return [(h[i % len(h)] / 255.0) * 2 - 1 for i in range(dim)]

    @property
    def dimension(self) -> int:
        return self._dim

    @property
    def mode(self) -> str:
        return self._mode
