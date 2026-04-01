import os, sys
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv('.env')

from knowledge.embedding import EmbeddingProvider
import numpy as np

ep = EmbeddingProvider()
print(f"Mode: {ep.mode}, Dim: {ep.dimension}")

# 检查 ChromaDB 存储的向量
import chromadb
client = chromadb.PersistentClient(path='data/chroma')
col = client.get_collection('knowledge')
print(f"Total chunks: {col.count()}")

# 取第一个 chunk，对比存储向量和实时重新 embed 的向量
sample = col.peek(1)
if sample['embeddings'] is not None and len(sample['embeddings']) > 0 and sample['documents']:
    stored_vec = sample['embeddings'][0]
    doc_text = sample['documents'][0]
    fresh_vec = ep.encode_single(doc_text)

    def cosine(a, b):
        a, b = np.array(a), np.array(b)
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

    sim = cosine(stored_vec, fresh_vec)
    print(f"\n存储向量 vs 实时 embed 相似度: {sim:.4f}")
    print(f"  (> 0.99 = 同一模型生成, < 0.1 = 不同模型)")
    print(f"  存储向量前5: {stored_vec[:5]}")
    print(f"  实时向量前5: {list(fresh_vec[:5])}")
    print(f"  文档片段: {doc_text[:80]}...")

    # 检查向量是否像 hash（值集中在 -1 和 1 附近）
    vals = np.array(stored_vec)
    unique_ratio = len(set(round(v, 2) for v in stored_vec)) / len(stored_vec)
    print(f"\n  存储向量唯一值比例: {unique_ratio:.3f}")
    print(f"  (hash 向量 < 0.05, API 向量 > 0.5)")
