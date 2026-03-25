import client from './client'

export async function sendMessage(content: string, positionId: string, sessionId?: string) {
  return client.post('/chat', { content, position_id: positionId, session_id: sessionId }) as Promise<any>
}

export async function getSessions(limit = 50) {
  return client.get('/chat/sessions', { params: { limit } }) as Promise<any[]>
}

export async function getSessionMessages(sessionId: string) {
  return client.get(`/chat/sessions/${sessionId}/messages`) as Promise<any[]>
}

export async function deleteSession(sessionId: string) {
  return client.delete(`/chat/sessions/${sessionId}`) as Promise<any>
}
