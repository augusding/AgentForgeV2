/**
 * 可视化工作流引擎 API 客户端
 */
import client from './client'

// ── 类型定义 ──────────────────────────────────────────

export interface NodePropertyOption {
  name: string
  value: any
  description?: string
}

export interface NodePropertyDisplayOptions {
  show?: Record<string, any[]>
  hide?: Record<string, any[]>
}

export interface NodePropertyTypeOptions {
  rows?: number
  editor?: string
  language?: string
  password?: boolean
  minValue?: number
  maxValue?: number
  numberPrecision?: number
  multipleValues?: boolean
  sortable?: boolean
}

export interface NodePropertyDef {
  name: string
  displayName: string
  type: string
  default: any
  description?: string
  hint?: string
  placeholder?: string
  required?: boolean
  noDataExpression?: boolean
  displayOptions?: NodePropertyDisplayOptions
  typeOptions?: NodePropertyTypeOptions
  options?: NodePropertyOption[]
  properties?: NodePropertyDef[]
}

export interface NodeTypeDef {
  name: string
  displayName: string
  description: string
  icon: string
  group: string
  subtitle?: string
  color?: string
  inputs: string[]
  outputs: string[]
  outputNames?: string[]
  properties: NodePropertyDef[]
  version: number
}

export interface WFNode {
  id: string
  name: string
  type: string
  parameters: Record<string, any>
  position: [number, number]
  disabled?: boolean
}

export interface WFConnection {
  source: string
  sourceOutput: number
  target: string
  targetInput: number
}

export interface WFWorkflow {
  id: string
  name: string
  description: string
  nodes: WFNode[]
  connections: WFConnection[]
  active: boolean
  createdAt?: string
  updatedAt?: string
}

/** 单节点执行状态（含实际数据，用于调试面板） */
export interface WFNodeExecState {
  nodeId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting'
  outputItems?: number
  outputData?: Record<string, any>[]   // 实际输出数据，最多50条
  inputData?: Record<string, any>[]    // 实际输入数据，最多50条
  error?: string
  duration?: number                    // 秒
}

export interface WFExecution {
  executionId: string
  workflowId: string
  status: 'running' | 'completed' | 'failed' | 'waiting'
  nodes: Record<string, WFNodeExecState>
  startTime: number
  endTime: number
}

/** testNode 接口返回 */
export interface WFTestNodeResult {
  status: 'completed' | 'failed'
  outputData?: Record<string, any>[]
  outputItems?: number
  duration?: number
  error?: string
}

// ── API 函数 ──────────────────────────────────────────

const BASE = '/workflow-engine'

export async function getNodeCatalog(): Promise<NodeTypeDef[]> {
  const res = await client.get(`${BASE}/nodes`) as { nodes: NodeTypeDef[] }
  return res.nodes || []
}

export async function listWorkflows(): Promise<WFWorkflow[]> {
  const res = await client.get(`${BASE}/workflows`) as { workflows: any[] }
  return res.workflows || []
}

export async function getWorkflow(id: string): Promise<WFWorkflow> {
  return await client.get(`${BASE}/workflows/${id}`) as WFWorkflow
}

export async function createWorkflow(data: Partial<WFWorkflow>): Promise<WFWorkflow> {
  return await client.post(`${BASE}/workflows`, data) as WFWorkflow
}

export async function updateWorkflow(id: string, data: Partial<WFWorkflow>): Promise<WFWorkflow> {
  return await client.put(`${BASE}/workflows/${id}`, data) as WFWorkflow
}

export async function deleteWorkflow(id: string): Promise<void> {
  await client.delete(`${BASE}/workflows/${id}`)
}

export async function executeWorkflow(id: string, triggerData?: any[], variables?: Record<string, any>): Promise<WFExecution> {
  return await client.post(`${BASE}/workflows/${id}/execute`, {
    triggerData: triggerData || [{}],
    variables: variables || {},
  }, { timeout: 300000 }) as WFExecution  // 5分钟超时，工作流执行含AI/HTTP节点耗时长
}

export async function listExecutions(workflowId?: string, limit = 20): Promise<any[]> {
  const params = new URLSearchParams()
  if (workflowId) params.set('workflowId', workflowId)
  params.set('limit', String(limit))
  const res = await client.get(`${BASE}/executions?${params}`) as { executions: any[] }
  return res.executions || []
}

export async function getExecution(executionId: string): Promise<WFExecution> {
  return await client.get(`${BASE}/executions/${executionId}`) as WFExecution
}

// ── Pin Data ──────────────────────────────────────────

export async function getPinnedNodes(workflowId: string): Promise<Record<string, number>> {
  const res = await client.get(`${BASE}/workflows/${workflowId}/pinned`) as { pinned: Record<string, number> }
  return res.pinned || {}
}

export async function pinNodeData(workflowId: string, nodeId: string, data: Record<string, any>[]): Promise<void> {
  await client.post(`${BASE}/workflows/${workflowId}/nodes/${nodeId}/pin`, { data })
}

export async function unpinNodeData(workflowId: string, nodeId: string): Promise<void> {
  await client.delete(`${BASE}/workflows/${workflowId}/nodes/${nodeId}/pin`)
}

export async function testNode(
  nodeType: string,
  parameters: Record<string, any>,
  inputData?: Record<string, any>[],
): Promise<WFTestNodeResult> {
  return await client.post(`${BASE}/test-node`, {
    nodeType,
    parameters,
    inputData: inputData ?? null,
  }) as WFTestNodeResult
}

// ── Triggers ─────────────────────────────────────────

export interface WFTrigger {
  id: string
  workflow_id: string
  type: 'schedule' | 'webhook' | 'once' | 'manual'
  name: string
  enabled: boolean
  rule: string
  cron_expression: string
  interval_minutes: number
  run_at: number
  webhook_path: string
  webhook_method: string
  last_run: number
  last_run_iso?: string
  next_run: number
  next_run_iso?: string
  run_count: number
  last_status: string
  created_by: string
  created_at: number
  created_at_iso?: string
  trigger_params: Record<string, any>
}

export async function listTriggers(workflowId?: string): Promise<WFTrigger[]> {
  const params = workflowId ? `?workflow_id=${workflowId}` : ''
  const res = await client.get(`/triggers${params}`) as { triggers: WFTrigger[] }
  return res.triggers || []
}

export async function createTrigger(data: Partial<WFTrigger> & { text?: string }): Promise<WFTrigger> {
  return await client.post('/triggers', data) as WFTrigger
}

export async function updateTrigger(id: string, data: Partial<WFTrigger>): Promise<WFTrigger> {
  return await client.put(`/triggers/${id}`, data) as WFTrigger
}

export async function deleteTrigger(id: string): Promise<void> {
  await client.delete(`/triggers/${id}`)
}

export async function pauseTrigger(id: string): Promise<WFTrigger> {
  return await client.post(`/triggers/${id}/pause`) as WFTrigger
}

export async function resumeTrigger(id: string): Promise<WFTrigger> {
  return await client.post(`/triggers/${id}/resume`) as WFTrigger
}

export async function executeTrigger(id: string): Promise<void> {
  await client.post(`/triggers/${id}/execute`)
}

// ── AI Workflow Generation ────────────────────────────

export interface WFGenerateRequest {
  prompt: string
  history?: Array<{ role: string; content: string }>
  mindmap?: string
}

export interface WFGenerateResult {
  workflow: Partial<WFWorkflow>
  explanation: string
}

export async function generateWorkflow(req: WFGenerateRequest): Promise<WFGenerateResult> {
  return await client.post(`${BASE}/generate`, req, { timeout: 120000 }) as WFGenerateResult
}
