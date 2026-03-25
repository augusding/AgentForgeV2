import client from './client'
import type {
  KnowledgeFile,
  KnowledgeStats,
  ConnectorType,
  Connector,
  TestResult,
  SyncLog,
  SourceSchema,
} from '../types/knowledge'

export async function fetchKnowledgeFiles(positionId?: string): Promise<KnowledgeFile[]> {
  const params = positionId ? `?position_id=${positionId}` : ''
  return client.get(`/knowledge${params}`)
}

export async function fetchKnowledgeStats(): Promise<KnowledgeStats> {
  return client.get('/knowledge/stats')
}

export async function uploadKnowledgeFile(
  file: File,
  options?: { positionIds?: string[]; scopeTags?: string[]; category?: string },
): Promise<KnowledgeFile> {
  const form = new FormData()
  form.append('file', file)
  if (options?.positionIds?.length) {
    form.append('position_ids', JSON.stringify(options.positionIds))
  }
  if (options?.scopeTags?.length) {
    form.append('scope_tags', JSON.stringify(options.scopeTags))
  }
  if (options?.category) {
    form.append('category', options.category)
  }
  return client.post('/knowledge/add', form, { timeout: 120000 })
}

export async function deleteKnowledgeFile(fileId: string): Promise<void> {
  return client.delete(`/knowledge/${fileId}`)
}

// ── 批量上传 + SSE 进度流 ──────────────────────────

export interface BatchUploadEvent {
  event: 'file_start' | 'extract_done' | 'chunks_ready' | 'chunk_progress' | 'file_done' | 'file_error' | 'batch_done'
  data: Record<string, any>
}

export interface BatchUploadResult {
  success: number
  failed: number
  total: number
  files: Array<{ filename: string; status: 'success' | 'error'; file_id?: string; chunks_added?: number; error?: string }>
}

export async function batchUploadKnowledgeFiles(
  files: File[],
  options?: { positionIds?: string[]; scopeTags?: string[]; category?: string },
  onProgress?: (event: BatchUploadEvent) => void,
): Promise<BatchUploadResult> {
  const form = new FormData()
  for (const file of files) {
    form.append('file', file)
  }
  if (options?.positionIds?.length) {
    form.append('position_ids', JSON.stringify(options.positionIds))
  }
  if (options?.scopeTags?.length) {
    form.append('scope_tags', JSON.stringify(options.scopeTags))
  }
  if (options?.category) {
    form.append('category', options.category)
  }

  // Auth header
  const headers: Record<string, string> = {}
  const token = localStorage.getItem('agentforge_token')
  if (token) headers['Authorization'] = `Bearer ${token}`

  const resp = await fetch('/api/v1/knowledge/batch-upload', {
    method: 'POST',
    body: form,
    headers,
    credentials: 'include',
  })

  if (!resp.ok || !resp.body) {
    throw new Error(`Upload failed: ${resp.status}`)
  }

  // Parse SSE stream
  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalResult: BatchUploadResult = { success: 0, failed: 0, total: files.length, files: [] }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    let currentEvent = ''
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim()
      } else if (line.startsWith('data: ') && currentEvent) {
        try {
          const data = JSON.parse(line.slice(6))
          if (onProgress) {
            onProgress({ event: currentEvent as BatchUploadEvent['event'], data })
          }
          if (currentEvent === 'batch_done') {
            finalResult = data as BatchUploadResult
          }
        } catch { /* ignore parse errors */ }
        currentEvent = ''
      }
    }
  }

  return finalResult
}

// ── 知识连接器 API ──────────────────────────────

export async function fetchConnectorTypes(): Promise<ConnectorType[]> {
  return client.get('/knowledge/connector-types')
}

export async function fetchConnectors(): Promise<Connector[]> {
  return client.get('/knowledge/connectors')
}

export async function createConnector(data: {
  connector_type: string
  name: string
  config: Record<string, any>
  field_mapping?: Record<string, any>
  sync_strategy?: string
  cron_expression?: string
}): Promise<Connector> {
  return client.post('/knowledge/connectors', data)
}

export async function updateConnector(
  id: string,
  data: Partial<Connector>
): Promise<Connector> {
  return client.put(`/knowledge/connectors/${id}`, data)
}

export async function deleteConnector(id: string): Promise<void> {
  return client.delete(`/knowledge/connectors/${id}`)
}

export async function testConnectorAdhoc(data: {
  connector_type: string
  config: Record<string, any>
}): Promise<TestResult> {
  return client.post('/knowledge/connectors/test', data)
}

export async function testConnector(id: string): Promise<TestResult> {
  return client.post(`/knowledge/connectors/${id}/test`, {})
}

export async function syncConnector(
  id: string,
  fullSync: boolean = false
): Promise<SyncLog> {
  return client.post(`/knowledge/connectors/${id}/sync`, { full_sync: fullSync })
}

export async function fetchConnectorSchema(id: string): Promise<SourceSchema> {
  return client.get(`/knowledge/connectors/${id}/schema`)
}

export async function fetchConnectorLogs(
  id: string,
  limit: number = 20
): Promise<SyncLog[]> {
  return client.get(`/knowledge/connectors/${id}/logs?limit=${limit}`)
}
