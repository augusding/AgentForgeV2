import client from './client'

export interface IndustryTemplateSummary {
  id: string
  name: string
  description: string
  icon: string
  tags: string[]
  role_count: number
  workflow_count: number
  skill_count: number
}

export interface IndustryTemplateDetail extends IndustryTemplateSummary {
  roles: Array<{
    id: string
    name: string
    description: string
    squad: string
    avatar_emoji: string
    skills: string[]
  }>
  workflows: Array<{
    id: string
    name: string
    description: string
    trigger_keywords: string[]
    steps: number | Array<Record<string, unknown>>
  }>
  skills: Array<{
    id: string
    name: string
  }>
  glossary_count: number
  test_case_count: number
}

export async function fetchTemplates(): Promise<IndustryTemplateSummary[]> {
  return client.get('/templates')
}

export async function fetchTemplateDetail(templateId: string): Promise<IndustryTemplateDetail> {
  return client.get(`/templates/${templateId}`)
}
