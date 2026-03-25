import client from './client'

export interface QuickWorkflowConfig {
  id: string
  name: string
  description: string
  icon: string
  trigger: 'manual' | 'scheduled'
  schedule: string
  workflow_ref: string
  keywords: string[]
  default_params: Record<string, any>
}

export interface MetricSource {
  type: 'manual' | 'computed' | 'api'
  endpoint?: string    // 数据源连接器名称（对应知识库数据源中的连接器）
  query?: string       // API 路径或查询标识
  value_path?: string  // 从响应 JSON 提取数值的路径
  refresh?: string     // 刷新频率：1m, 5m, 30m, 1h, 6h, 1d
}

export interface DashboardMetric {
  key: string
  name: string
  unit: string
  target: string
  direction: '' | 'higher_is_better' | 'lower_is_better'
  source?: MetricSource
}

export interface PositionDetail {
  position_id: string
  display_name: string
  icon: string
  color: string
  department: string
  domain: string
  description: string
  role: string
  goal: string
  context: string
  default_model: string
  complex_model: string
  tools: string[]
  quick_workflows: QuickWorkflowConfig[]
  dashboard_metrics: DashboardMetric[]
  knowledge_scope: string[]
}

export async function fetchPositions(): Promise<{ industry: string; positions: PositionDetail[] }> {
  return client.get('/positions')
}

export async function fetchPosition(id: string): Promise<PositionDetail> {
  return client.get(`/positions/${id}`)
}

export async function createPosition(data: PositionDetail): Promise<PositionDetail> {
  return client.post('/positions', data)
}

export async function updatePosition(id: string, data: PositionDetail): Promise<PositionDetail> {
  return client.put(`/positions/${id}`, data)
}

export async function deletePosition(id: string): Promise<void> {
  await client.delete(`/positions/${id}`)
}
