import client from './client'

export interface Connector {
  id: string; name: string; connector_type: string; enabled: boolean
  sync_interval_minutes: number; last_sync_at: number | null
  last_sync_status: string | null; last_sync_count: number
  config: Record<string, unknown>
}
export interface ConnectorType {
  type: string
  schema: { properties: Record<string, { type: string; title: string; description?: string; default?: unknown }>; required?: string[] }
}
export interface SyncStatus {
  connector_id: string; running: boolean
  circuit: { state: string; fail_count: number }
  last_sync_at: number | null; last_sync_status: string | null; last_sync_count: number
}

export const listConnectors = () => client.get('/connectors') as Promise<{ connectors: Connector[] }>
export const getConnectorTypes = () => client.get('/connector-types') as Promise<{ types: ConnectorType[] }>
export const createConnector = (d: { name: string; connector_type: string; config: Record<string, unknown>; sync_interval_minutes?: number }) =>
  client.post('/connectors', d) as Promise<{ connector: Connector }>
export const deleteConnector = (id: string) => client.delete(`/connectors/${id}`)
export const testConnector = (id: string) => client.post(`/connectors/${id}/test`) as Promise<{ ok: boolean; message: string }>
export const triggerSync = (id: string, forceFull = false) => client.post(`/connectors/${id}/sync`, { force_full: forceFull }) as Promise<any>
export const getSyncStatus = (id: string) => client.get(`/connectors/${id}/status`) as Promise<SyncStatus>
