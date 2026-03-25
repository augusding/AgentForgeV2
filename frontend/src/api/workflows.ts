import client from './client'
import type { WorkflowV2Data } from '../types/workflow'

export async function fetchWorkflowDetail(name: string): Promise<WorkflowV2Data> {
  return client.get(`/workflows/${encodeURIComponent(name)}`)
}

export async function saveWorkflow(workflow: WorkflowV2Data): Promise<{ ok: boolean; name: string }> {
  return client.post('/workflows', workflow)
}
