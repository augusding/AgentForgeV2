import client from './client'

export async function listWorkflows() {
  return client.get('/workflows') as Promise<any>
}
export async function getWorkflow(id: string) {
  return client.get(`/workflows/${id}`) as Promise<any>
}
export async function createWorkflow(data: any) {
  return client.post('/workflows', data) as Promise<any>
}
export async function updateWorkflow(id: string, data: any) {
  return client.put(`/workflows/${id}`, data) as Promise<any>
}
export async function deleteWorkflow(id: string) {
  return client.delete(`/workflows/${id}`) as Promise<any>
}
export async function executeWorkflow(id: string, triggerData?: any) {
  return client.post(`/workflows/${id}/execute`, { trigger_data: triggerData || {} }) as Promise<any>
}
export async function getNodeCatalog() {
  return client.get('/workflow-engine/nodes') as Promise<{ nodes: NodeTypeDef[] }>
}
export async function testNode(type: string, config: any, input?: any) {
  return client.post('/workflow-engine/test-node', { type, config, input: input || {} }) as Promise<any>
}
export async function getExecutions(workflowId: string) {
  return client.get(`/workflows/${workflowId}/executions`) as Promise<any>
}
export async function getWorkflowStats(days: number = 7) {
  return client.get(`/workflows/stats?days=${days}`) as Promise<any>
}

export async function clearAllWorkflows() {
  return client.post('/workflows/clear') as Promise<any>
}

export interface NodeTypeDef {
  name: string; displayName: string; description: string; group: string; icon: string
  inputs: number; outputs: number; outputNames: string[]; parameters: NodeParamDef[]
}
export interface NodeParamDef {
  name: string; type: string; displayName: string; default?: any; description?: string
  options?: Array<{ name: string; value: string }>
  displayOptions?: { show?: Record<string, any> }
}
