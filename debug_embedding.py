import os, sys
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv('.env')

from knowledge.embedding import EmbeddingProvider

ep = EmbeddingProvider()
print(f"Mode: {ep.mode}")
print(f"Dimension: {ep.dimension}")

# 测试：两段相关文本的相似度应该 > 0.5
import numpy as np
text_a = "OpenClaw 的安装方法有三种：一键脚本安装、npm安装、从源码编译"
text_b = "如何安装 OpenClaw"
text_c = "今天天气怎么样"

vec_a = ep.encode_single(text_a)
vec_b = ep.encode_single(text_b)
vec_c = ep.encode_single(text_c)

def cosine(a, b):
    a, b = np.array(a), np.array(b)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

print(f"\n相关文本相似度 (应 > 0.5): {cosine(vec_a, vec_b):.4f}")
print(f"无关文本相似度 (应 < 0.3): {cosine(vec_a, vec_c):.4f}")
print(f"向量维度: {len(vec_a)}")
print(f"向量前5个值: {vec_a[:5]}")

# 再检查 ChromaDB 中已存储向量的维度
try:
    import chromadb
    client = chromadb.PersistentClient(path='data/chroma')
    col = client.get_collection('knowledge')
    sample = col.peek(1)
    if sample['embeddings'] is not None and len(sample['embeddings']) > 0:
        stored_dim = len(sample['embeddings'][0])
        print(f"\nChromaDB 存储的向量维度: {stored_dim}")
        print(f"API 向量维度: {len(vec_a)}")
        if stored_dim != len(vec_a):
            print("⚠️ 维度不匹配！这就是 score 极低的原因")
        else:
            # 对比存储向量和实时向量的相似度
            stored_doc = sample['documents'][0][:50]
            fresh_vec = ep.encode_single(sample['documents'][0])
            sim = cosine(sample['embeddings'][0], fresh_vec)
            print(f"存储向量 vs 实时重新 embed 的相似度: {sim:.4f}")
            print(f"  (如果 < 0.9 说明索引时用的不是同一个模型)")
            print(f"  文档片段: {stored_doc}...")
except Exception as e:
    print(f"ChromaDB 检查失败: {e}")
