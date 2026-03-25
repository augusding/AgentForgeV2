import { useApprovalStore } from '../stores/useApprovalStore'

export function useApprovalNotify() {
  const approvals = useApprovalStore(s => s.approvals)
  const pendingCount = approvals.filter(a => a.status === 'pending').length

  return { pendingCount }
}
