import os, sys
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv('.env')
import httpx

api_key = os.environ.get("DASHSCOPE_API_KEY", "")
url = "https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings"

import chromadb
client = chromadb.PersistentClient(path='data/chroma')
col = client.get_collection('knowledge')

# Get 25 docs like the batched encoder does
sample = col.get(limit=25, include=["documents"])
docs = sample["documents"]
print(f"Batch of {len(docs)} docs")
print(f"Doc lengths: {[len(d) for d in docs]}")
total_chars = sum(len(d) for d in docs)
print(f"Total chars: {total_chars}")

resp = httpx.post(url, json={"model": "text-embedding-v3", "input": docs, "encoding_format": "float"},
    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, timeout=30)
print(f"Status: {resp.status_code}")
if resp.status_code != 200:
    print(f"Error: {resp.text[:500]}")
else:
    data = resp.json()
    print(f"Got {len(data['data'])} embeddings")
