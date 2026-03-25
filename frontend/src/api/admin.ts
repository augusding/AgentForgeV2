import client from './client'

export interface AdminStats {
  total_users: number
  total_leads: number
  active_trials: number
  users_by_role: Record<string, number>
  leads_by_status: Record<string, number>
  leads_today: number
  leads_this_week: number
}

export interface LeadRecord {
  id: string
  name: string
  email: string
  phone: string
  company: string
  industry: string
  sub_industry: string
  source: string
  status: string
  created_at: string
}

export interface LeadsQuery {
  page?: number
  limit?: number
  status?: string
  industry?: string
  search?: string
  date_from?: string
  date_to?: string
}

export interface LeadsResponse {
  items: LeadRecord[]
  total: number
  page: number
  limit: number
}

export const fetchAdminStats = (): Promise<AdminStats> =>
  client.get('/admin/stats')

export const fetchAdminLeads = (query: LeadsQuery): Promise<LeadsResponse> =>
  client.get('/admin/leads', { params: query })

export const updateLeadStatus = (leadId: string, status: string): Promise<void> =>
  client.patch(`/admin/leads/${leadId}`, { status })

export const exportLeads = (query: LeadsQuery): Promise<Blob> =>
  client.get('/admin/leads/export', { params: query, responseType: 'blob' })

// ─── Industry CRUD ───

export const fetchAdminIndustries = () =>
  client.get('/admin/industries')

export const createIndustry = (label: string) =>
  client.post('/admin/industries', { label })

export const updateIndustry = (id: string, label: string) =>
  client.patch(`/admin/industries/${id}`, { label })

export const deleteIndustry = (id: string) =>
  client.delete(`/admin/industries/${id}`)

export const createSubIndustry = (industryId: string, label: string) =>
  client.post(`/admin/industries/${industryId}/children`, { label })

export const updateSubIndustry = (id: string, label: string) =>
  client.patch(`/admin/sub-industries/${id}`, { label })

export const deleteSubIndustry = (id: string) =>
  client.delete(`/admin/sub-industries/${id}`)

// ─── Skill Pack CRUD ───

export interface SkillPack {
  id: string
  name: string
  description: string
  category: string
  tier: string
  icon: string
  color: string
  required_tools: string[]
  capabilities: string[]
  knowledge_template: string
  target_industries: string[]
  is_system: number
  enabled: number
  created_at: string
  updated_at: string
}

export interface SkillAssignment {
  id: string
  skill_pack_id: string
  target_type: 'industry' | 'user'
  target_id: string
  enabled: number
  custom_config: string
  assigned_by: string
  created_at: string
}

export interface SkillPackStats {
  total_packs: number
  by_category: Record<string, number>
  by_tier: Record<string, number>
  total_assignments: number
  assignments_by_type: Record<string, number>
  assignments_by_pack: Array<{ skill_pack_id: string; name: string; count: number }>
}

export const fetchSkillPacks = (): Promise<{ skill_packs: SkillPack[] }> =>
  client.get('/admin/skill-packs')

export const createSkillPack = (data: Partial<SkillPack>): Promise<{ skill_pack: SkillPack }> =>
  client.post('/admin/skill-packs', data)

export const updateSkillPack = (id: string, data: Partial<SkillPack>): Promise<{ skill_pack: SkillPack }> =>
  client.patch(`/admin/skill-packs/${id}`, data)

export const deleteSkillPack = (id: string): Promise<void> =>
  client.delete(`/admin/skill-packs/${id}`)

export const fetchSkillAssignments = (params?: { skill_pack_id?: string; target_type?: string; target_id?: string }): Promise<{ assignments: SkillAssignment[] }> =>
  client.get('/admin/skill-assignments', { params })

export const createSkillAssignment = (data: { skill_pack_id: string; target_type: string; target_id: string }): Promise<{ assignment: SkillAssignment }> =>
  client.post('/admin/skill-assignments', data)

export const deleteSkillAssignment = (id: string): Promise<void> =>
  client.delete(`/admin/skill-assignments/${id}`)

export const fetchSkillPackAssignments = (packId: string): Promise<{ assignments: SkillAssignment[] }> =>
  client.get(`/admin/skill-packs/${packId}/assignments`)

export const fetchSkillPackStats = (): Promise<SkillPackStats> =>
  client.get('/admin/skill-stats')
