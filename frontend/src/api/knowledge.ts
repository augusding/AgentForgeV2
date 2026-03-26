import client from './client'

export async function searchKnowledge(query: string, topK = 3) {
  return client.post('/knowledge/search', { query, top_k: topK }) as Promise<any>
}

export async function getKnowledgeStats() {
  return client.get('/knowledge/stats') as Promise<any>
}

export async function uploadFile(file: File, target: 'knowledge' | 'chat' = 'knowledge') {
  const form = new FormData()
  form.append('file', file)
  form.append('target', target)
  return client.post('/files/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } }) as Promise<any>
}

export async function listFiles() {
  return client.get('/knowledge/files') as Promise<any>
}
