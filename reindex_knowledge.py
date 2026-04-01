"""强制重新索引：读出所有 chunk 的文本，用当前 EmbeddingProvider 重新生成向量写回。"""
import os, sys
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv('.env')

from knowledge.embedding import EmbeddingProvider
import chromadb

ep = EmbeddingProvider()
print(f"Embedding mode: {ep.mode}, dim: {ep.dimension}")
if ep.mode != "api":
    print("❌ Embedding 不是 API 模式，中止！")
    sys.exit(1)

client = chromadb.PersistentClient(path='data/chroma')
col = client.get_collection('knowledge')
total = col.count()
print(f"Total chunks to re-index: {total}")

if total == 0:
    print("知识库为空，无需重新索引")
    sys.exit(0)

# 分批读取所有 chunk
BATCH = 100
offset = 0
reindexed = 0
while offset < total:
    result = col.get(
        limit=BATCH,
        offset=offset,
        include=["documents", "metadatas"],
    )
    ids = result["ids"]
    docs = result["documents"]
    metas = result["metadatas"]

    if not ids:
        break

    # 用 API 重新生成向量
    print(f"  Re-embedding batch {offset}-{offset+len(ids)}...")
    new_vectors = ep.encode(docs)

    # 写回 ChromaDB（upsert 覆盖旧向量）
    col.update(
        ids=ids,
        embeddings=new_vectors,
    )
    reindexed += len(ids)
    offset += len(ids)

print(f"\nDone: re-indexed {reindexed} chunks")

# 验证
sample = col.peek(1)
import numpy as np
stored = sample['embeddings'][0]
fresh = ep.encode_single(sample['documents'][0])
a, b = np.array(stored), np.array(fresh)
sim = float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))
print(f"验证 - 存储 vs 实时相似度: {sim:.4f} (应 > 0.99)")
