import client from './client'

export async function getSessions(limit = 50) {
  return client.get('/chat/sessions', { params: { limit } }) as Promise<any[]>
}

export async function getSessionMessages(sessionId: string) {
  return client.get(`/chat/sessions/${sessionId}/messages`) as Promise<any[]>
}

export async function deleteSession(sessionId: string) {
  return client.delete(`/chat/sessions/${sessionId}`) as Promise<any>
}

export async function generateTitle(sessionId: string) {
  return client.post(`/chat/sessions/${sessionId}/title`) as Promise<{ title: string }>
}

export async function uploadChatFile(file: File) {
  const form = new FormData()
  form.append('file', file)
  form.append('target', 'chat')
  return client.post('/files/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  }) as Promise<{ file_id: string; filename: string; size: number; extracted_text?: string; needs_processing?: boolean; media_type?: string }>
}

export async function getQuickCommands(positionId?: string) {
  const params = positionId ? `?position_id=${positionId}` : ''
  return client.get(`/chat/quick-commands${params}`) as Promise<Array<{ text: string; position_id?: string }>>
}

export async function submitFeedback(messageId: string, sessionId: string, rating: 'up' | 'down') {
  return client.post(`/chat/messages/${messageId}/feedback`, { session_id: sessionId, rating }) as Promise<any>
}
