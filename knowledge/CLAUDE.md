# Knowledge 模块

## 职责
RAG Pipeline：文档解析 → 分块 → Embedding → 存储 → 检索。

## 文件说明
| 文件 | 职责 |
|------|------|
| `rag.py` | KnowledgeBase 主类：统一的存入/检索接口 |
| `chunker.py` | 文档分块：结构感知 + 中文友好 |
| `embedding.py` | Embedding 生成 (bge-base-zh / API) |
| `retriever.py` | 混合检索：向量 + BM25 + Rerank |

## 约束
- KnowledgeBase 是唯一对外接口
- 分块/嵌入/检索各自独立，可替换
- 默认用 ChromaDB 做向量存储
