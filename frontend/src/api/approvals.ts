import client from './client'
import type { ApprovalRequest } from '../types/mission'

export async function fetchApprovals(): Promise<ApprovalRequest[]> {
  return client.get('/approvals')
}

export async function resolveApproval(approvalId: string, decision: string, comment?: string): Promise<void> {
  return client.post(`/approvals/${approvalId}`, { decision, comment })
}
