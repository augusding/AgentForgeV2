"""删除所有 chunk 后重新插入（不是 update），强制重建 HNSW 索引。"""
import os, sys
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv('.env')

from knowledge.embedding import EmbeddingProvider
import chromadb
import numpy as np

ep = EmbeddingProvider()
print(f"Embedding mode: {ep.mode}, dim: {ep.dimension}")
assert ep.mode == "api", "Embedding 必须是 API 模式"

client = chromadb.PersistentClient(path='data/chroma')
col = client.get_collection('knowledge')
total = col.count()
print(f"Total chunks: {total}")

# 1. 读出所有数据
print("读取所有 chunk...")
all_data = col.get(include=["documents", "metadatas"])
all_ids = all_data["ids"]
all_docs = all_data["documents"]
all_metas = all_data["metadatas"]
print(f"  读取完成: {len(all_ids)} chunks")

# 2. 删除整个 collection 并重建
print("删除旧 collection...")
client.delete_collection('knowledge')
col = client.create_collection(
    name='knowledge',
    metadata={"hnsw:space": "cosine"},
)
print("  新 collection 已创建")

# 3. 分批重新 embed + 插入
BATCH = 10
inserted = 0
for i in range(0, len(all_ids), BATCH):
    batch_ids = all_ids[i:i+BATCH]
    batch_docs = all_docs[i:i+BATCH]
    batch_metas = all_metas[i:i+BATCH]

    print(f"  Embedding + insert batch {i}-{i+len(batch_ids)}...")
    vectors = ep.encode(batch_docs)

    col.add(
        ids=batch_ids,
        embeddings=vectors,
        documents=batch_docs,
        metadatas=batch_metas,
    )
    inserted += len(batch_ids)

print(f"\n重新插入完成: {inserted} chunks")

# 4. 验证搜索质量
print("\n=== 搜索质量验证 ===")
test_query = "openclaw的核心理念"
query_vec = ep.encode_single(test_query)
results = col.query(query_embeddings=[query_vec], n_results=3)
for i, (doc, dist) in enumerate(zip(results['documents'][0], results['distances'][0])):
    score = 1 - dist
    print(f"  #{i+1} score={score:.4f}  {doc[:60]}...")
print(f"\n预期: score > 0.5 说明搜索正常, < 0.1 说明仍有问题")
