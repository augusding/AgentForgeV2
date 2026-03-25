import client from './client'

export interface CustomTool {
  id: string
  name: string
  tool_name: string
  description: string
  template_type: string
  config: Record<string, any>
  position_id: string
  org_id: string
  created_by: string
  created_at: number
  enabled: boolean
  usage_count: number
}

export interface ToolTemplate {
  name: string
  description: string
  icon: string
  fields: {
    key: string
    label: string
    type: string
    required?: boolean
    placeholder?: string
    options?: string[]
    default?: string
  }[]
}

export async function getToolTemplates(): Promise<Record<string, ToolTemplate>> {
  return client.get('/custom-tools/templates')
}

export async function getCustomTools(positionId?: string): Promise<CustomTool[]> {
  const params = positionId ? `?position_id=${positionId}` : ''
  return client.get(`/custom-tools${params}`)
}

export async function createCustomTool(data: {
  name: string
  description: string
  template_type: string
  config: Record<string, any>
  position_id?: string
}): Promise<CustomTool> {
  return client.post('/custom-tools', data)
}

export async function updateCustomTool(id: string, data: Partial<CustomTool>): Promise<void> {
  await client.put(`/custom-tools/${id}`, data)
}

export async function deleteCustomTool(id: string): Promise<void> {
  await client.delete(`/custom-tools/${id}`)
}
