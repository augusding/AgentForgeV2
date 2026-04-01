"""
AgentForge V2 — Embedding 生成

使用 DashScope text-embedding-v3 API 生成向量。
API 不可用时直接报错，不静默降级。
"""
from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger(__name__)

_API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings"
_API_MODEL = "text-embedding-v3"
_BATCH_SIZE = 10
_DEFAULT_DIM = 1024


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
        self._dim = _DEFAULT_DIM

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
                raise RuntimeError(f"DashScope Embedding API 不可用: {e}。请检查 DASHSCOPE_API_KEY 配置。") from e
        else:
            logger.error("DASHSCOPE_API_KEY 未配置，RAG 无法工作")
            # 保留 hash 模式但仅用于启动不崩溃，search 时会因为 score 极低被过滤

    def encode(self, texts: list[str]) -> list[list[float]]:
        if self._mode != "api":
            raise RuntimeError("Embedding 未初始化为 API 模式，无法生成向量")
        return self._api_encode_batched(texts)

    def encode_single(self, text: str) -> list[float]:
        return self.encode([text])[0]

    def _api_encode_batched(self, texts: list[str]) -> list[list[float]]:
        all_vectors: list[list[float]] = []
        for i in range(0, len(texts), _BATCH_SIZE):
            batch = texts[i:i + _BATCH_SIZE]
            try:
                all_vectors.extend(self._api_call(batch))
            except Exception as e:
                logger.error("Embedding API 批次 %d 失败: %s", i // _BATCH_SIZE, e)
                raise RuntimeError(f"Embedding API 调用失败: {e}") from e
        return all_vectors

    def _api_call(self, texts: list[str]) -> list[list[float]]:
        resp = httpx.post(_API_URL, json={"model": _API_MODEL, "input": texts, "encoding_format": "float"},
            headers={"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"}, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        embeddings = sorted(data["data"], key=lambda x: x["index"])
        return [e["embedding"] for e in embeddings]

    @property
    def dimension(self) -> int:
        return self._dim

    @property
    def mode(self) -> str:
        return self._mode
