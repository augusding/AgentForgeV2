import client from './client'
import type { Agent, Squad } from '../types/agent'

export async function fetchAgents(): Promise<Agent[]> {
  return client.get('/agents')
}

export async function fetchAgent(agentId: string): Promise<Agent> {
  return client.get(`/agents/${agentId}`)
}

export async function fetchSquads(): Promise<Squad[]> {
  return client.get('/squads')
}
