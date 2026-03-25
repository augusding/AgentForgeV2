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

export async function deleteWorkflow(id: string) {
  return client.delete(`/workflows/${id}`) as Promise<any>
}

export async function executeWorkflow(id: string, triggerData?: any) {
  return client.post(`/workflows/${id}/execute`, { trigger_data: triggerData || {} }) as Promise<any>
}
