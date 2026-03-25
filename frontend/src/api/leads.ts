import client from './client'

export interface LeadPayload {
  name: string
  phone: string
  email?: string
  company?: string
  industry?: string
  sub_industry?: string
}

export async function submitLead(data: LeadPayload): Promise<{ success: boolean; id?: string }> {
  return client.post('/leads', data)
}
