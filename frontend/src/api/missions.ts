import client from './client'
import type { Mission } from '../types/mission'

export async function fetchMissions(): Promise<Mission[]> {
  return client.get('/missions')
}

export async function fetchMission(missionId: string): Promise<Mission> {
  return client.get(`/missions/${missionId}`)
}

export async function createMission(input: string, agentId?: string): Promise<Mission> {
  return client.post('/mission/create', { input, agent_id: agentId })
}
