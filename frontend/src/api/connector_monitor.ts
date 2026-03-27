import client from './client'

export interface SyncHistoryItem { action: string; detail: string; created_at: number }
export interface DLQItem {
  id: string; doc_id: string; source_url: string; error_msg: string
  retry_count: number; max_retries: number; next_retry_at: number
  resolved: number; created_at: number; updated_at: number
}

export const getSyncHistory = (id: string, limit = 20) =>
  client.get(`/connectors/${id}/history?limit=${limit}`) as Promise<{ history: SyncHistoryItem[] }>
export const getDLQ = (id: string) =>
  client.get(`/connectors/${id}/dlq`) as Promise<{ failures: DLQItem[] }>
export const retryDLQ = (id: string, failureId: string) =>
  client.post(`/connectors/${id}/dlq/${failureId}/retry`) as Promise<any>
