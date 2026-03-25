import client from './client'
import type { LearningOverview, AgentGrowth, SoulSuggestion, SkillSuggestion } from '../types/learning'

export async function fetchLearningOverview(): Promise<LearningOverview> {
  return client.get('/learning/overview')
}

export async function fetchAgentGrowth(agentId: string): Promise<AgentGrowth> {
  return client.get(`/learning/agent/${agentId}`)
}

export async function fetchSoulSuggestions(agentId?: string): Promise<{ suggestions: SoulSuggestion[] }> {
  const params = agentId ? `?agent_id=${agentId}` : ''
  return client.get(`/soul/suggestions${params}`)
}

export async function resolveSoulSuggestion(
  id: string,
  action: 'accept' | 'ignore' | 'modify',
  modification?: string,
): Promise<{ ok: boolean }> {
  return client.post(`/soul/suggestions/${id}`, { action, modification })
}

export async function fetchSkillSuggestions(): Promise<{ suggestions: SkillSuggestion[] }> {
  return client.get('/skills/suggestions')
}

export async function resolveSkillSuggestion(
  id: string,
  action: 'accept' | 'ignore',
): Promise<{ ok: boolean }> {
  return client.post(`/skills/suggestions/${id}`, { action })
}
