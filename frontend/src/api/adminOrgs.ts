import client from './client'

export interface OrgInfo {
  id: string
  name: string
  industry: string
  sub_industry: string
  plan: string
  max_seats: number
  status: string
  created_by: string
  created_at: string
  updated_at: string
  contact_name: string
  contact_phone: string
  contact_email: string
  member_count?: number
}

export interface OrgMember {
  id: string
  org_id: string
  user_id: string
  org_role: string
  joined_at: string
  username: string
  display_name: string
  last_login_at: string | null
}

export interface OrgListResult {
  items: OrgInfo[]
  total: number
  page: number
  limit: number
}

export const fetchAdminOrgs = async (
  search = '',
  page = 1,
  limit = 50,
): Promise<OrgListResult> => {
  return (await client.get('/admin/orgs', {
    params: { search, page, limit },
  })) as any
}

export const getAdminOrgDetail = async (orgId: string): Promise<OrgInfo & { members: OrgMember[] }> => {
  return (await client.get(`/admin/orgs/${orgId}`)) as any
}

export const updateAdminOrg = async (
  orgId: string,
  data: Partial<OrgInfo>,
): Promise<{ ok: boolean }> => {
  return (await client.put(`/admin/orgs/${orgId}`, data)) as any
}

export const updateAdminOrgStatus = async (
  orgId: string,
  status: 'active' | 'suspended',
): Promise<{ ok: boolean }> => {
  return (await client.patch(`/admin/orgs/${orgId}/status`, { status })) as any
}

export const fetchAdminOrgMembers = async (orgId: string): Promise<OrgMember[]> => {
  return (await client.get(`/admin/orgs/${orgId}/members`)) as any
}

export const addAdminOrgMember = async (
  orgId: string,
  data: { username: string; password: string; display_name?: string; role?: string },
): Promise<{ ok: boolean; user_id: string; message: string }> => {
  return (await client.post(`/admin/orgs/${orgId}/members`, data)) as any
}

export const updateAdminOrgMemberRole = async (
  orgId: string,
  userId: string,
  role: string,
): Promise<{ ok: boolean }> => {
  return (await client.put(`/admin/orgs/${orgId}/members/${userId}`, { role })) as any
}

export const removeAdminOrgMember = async (
  orgId: string,
  userId: string,
): Promise<{ ok: boolean }> => {
  return (await client.delete(`/admin/orgs/${orgId}/members/${userId}`)) as any
}
