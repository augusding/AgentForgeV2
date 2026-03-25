import client from './client'
import type { AppConfig, Profile, Workflow } from '../types/config'

export async function fetchConfig(): Promise<AppConfig> {
  return client.get('/config')
}

export async function fetchProfiles(): Promise<Profile[]> {
  return client.get('/profiles')
}

export async function switchProfile(profileId: string): Promise<void> {
  return client.post(`/profiles/${profileId}/switch`)
}

export async function fetchWorkflows(): Promise<Workflow[]> {
  return client.get('/workflows')
}

export async function updateConfig(patch: Partial<AppConfig>): Promise<void> {
  return client.patch('/config', patch)
}
