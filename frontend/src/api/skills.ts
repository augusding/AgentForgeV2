import client from './client'
import type { SkillPack, SkillAudit } from '../types/skill'

export async function fetchSkills(params?: { position_id?: string; status?: string }): Promise<SkillPack[]> {
  const qs = new URLSearchParams()
  if (params?.position_id) qs.set('position_id', params.position_id)
  if (params?.status) qs.set('status', params.status)
  const qstr = qs.toString()
  const data: any = await client.get(`/skills${qstr ? `?${qstr}` : ''}`)
  return data.skills || []
}

export async function fetchMySkills(): Promise<SkillPack[]> {
  const data: any = await client.get('/skills/my')
  return data.skills || []
}

export async function createSkill(data: Partial<SkillPack>): Promise<{ ok: boolean; id?: string }> {
  return client.post('/skills', data)
}

export async function updateSkill(id: string, data: Partial<SkillPack>): Promise<{ ok: boolean }> {
  return client.put(`/skills/${id}`, data)
}

export async function submitForReview(id: string): Promise<{ ok: boolean; violations?: string[]; status?: string }> {
  return client.post(`/skills/${id}/submit`, {})
}

export async function reviewSkill(id: string, action: 'approve' | 'reject', notes?: string): Promise<{ ok: boolean }> {
  return client.post(`/skills/${id}/review`, { action, notes })
}

export async function suspendSkill(id: string): Promise<{ ok: boolean }> {
  return client.post(`/skills/${id}/suspend`, {})
}

export async function assignSkillToPosition(skillId: string, positionId: string): Promise<{ ok: boolean; message?: string }> {
  return client.post(`/skills/${skillId}/assign`, { position_id: positionId })
}

export async function fetchSkillAudits(id: string): Promise<SkillAudit[]> {
  const data: any = await client.get(`/skills/${id}/audits`)
  return data.audits || []
}

export async function extractSkillFromContent(content: string): Promise<any> {
  return client.post('/skills/extract', { content })
}
