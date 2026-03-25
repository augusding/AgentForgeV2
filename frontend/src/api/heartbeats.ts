import client from './client'
import type { Heartbeat } from '../types/config'

export async function fetchHeartbeats(): Promise<Heartbeat[]> {
  return client.get('/heartbeats')
}

export async function toggleHeartbeat(id: string, enabled: boolean): Promise<void> {
  return client.patch(`/heartbeats/${id}`, { enabled })
}

export async function deleteHeartbeat(id: string): Promise<void> {
  return client.delete(`/heartbeats/${id}`)
}

export async function runHeartbeat(id: string): Promise<void> {
  return client.post(`/heartbeats/${id}/run`)
}
