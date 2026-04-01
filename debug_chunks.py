import sys
sys.path.insert(0, '.')
import chromadb

client = chromadb.PersistentClient(path='data/chroma')
col = client.get_collection('knowledge')

# 检查所有 chunk 的文本长度
total = col.count()
BATCH = 100
empty = 0
long_texts = 0
for offset in range(0, total, BATCH):
    result = col.get(limit=BATCH, offset=offset, include=["documents"])
    for i, doc in enumerate(result["documents"]):
        if not doc or not doc.strip():
            empty += 1
            print(f"  Empty chunk at offset {offset+i}: id={result['ids'][i]}")
        if len(doc) > 8000:
            long_texts += 1
            print(f"  Long chunk at offset {offset+i}: len={len(doc)}, id={result['ids'][i]}")

print(f"\nTotal: {total}, Empty: {empty}, Long(>8000): {long_texts}")
