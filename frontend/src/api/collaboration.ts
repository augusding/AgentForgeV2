import client from './client'
import type {
  CollaborationMatrix,
  CollaborationQuality,
  BottleneckAgent,
  CollaborationSuggestion,
} from '../types/collaboration'

export async function fetchCollaborationMatrix(days = 30): Promise<CollaborationMatrix> {
  return client.get(`/collaboration/matrix?days=${days}`)
}

export async function fetchCollaborationQuality(days = 30): Promise<CollaborationQuality[]> {
  return client.get(`/collaboration/quality?days=${days}`)
}

export async function fetchBottleneckAgents(days = 30): Promise<BottleneckAgent[]> {
  return client.get(`/collaboration/bottlenecks?days=${days}`)
}

export async function fetchCollaborationSuggestions(days = 30): Promise<CollaborationSuggestion[]> {
  return client.get(`/collaboration/suggestions?days=${days}`)
}
