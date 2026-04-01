import os, sys
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv('.env')
import httpx

api_key = os.environ.get("DASHSCOPE_API_KEY", "")
print(f"API key: {api_key[:8]}...{api_key[-4:]}" if len(api_key) > 12 else f"API key: {api_key}")

url = "https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings"

# Test with a simple text
texts = ["hello world"]
resp = httpx.post(url, json={"model": "text-embedding-v3", "input": texts, "encoding_format": "float"},
    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, timeout=30)
print(f"Status: {resp.status_code}")
print(f"Response: {resp.text[:500]}")

# Now test with a batch from ChromaDB
import chromadb
client = chromadb.PersistentClient(path='data/chroma')
col = client.get_collection('knowledge')
sample = col.get(limit=5, include=["documents"])
docs = sample["documents"]
print(f"\nBatch test with {len(docs)} docs, lengths: {[len(d) for d in docs]}")

resp2 = httpx.post(url, json={"model": "text-embedding-v3", "input": docs, "encoding_format": "float"},
    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, timeout=30)
print(f"Status: {resp2.status_code}")
print(f"Response: {resp2.text[:500]}")
