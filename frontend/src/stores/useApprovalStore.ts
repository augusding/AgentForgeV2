import { create } from 'zustand'
import type { ApprovalRequest } from '../types/mission'
import { fetchApprovals, resolveApproval } from '../api/approvals'

interface ApprovalState {
  approvals: ApprovalRequest[]
  loading: boolean

  load: () => Promise<void>
  resolve: (approvalId: string, decision: string, comment?: string) => Promise<void>
  addApproval: (approval: ApprovalRequest) => void
  pendingCount: () => number
}

export const useApprovalStore = create<ApprovalState>((set, get) => ({
  approvals: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    try {
      const approvals = await fetchApprovals()
      set({ approvals, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  resolve: async (approvalId, decision, comment) => {
    await resolveApproval(approvalId, decision, comment)
    set(state => ({
      approvals: state.approvals.map(a =>
        a.id === approvalId
          ? {
              ...a,
              status: decision === 'approve'
                ? 'approved' as const
                : decision === 'modify'
                  ? 'modified' as const
                  : 'rejected' as const,
              resolved_at: new Date().toISOString(),
            }
          : a
      ),
    }))
  },

  addApproval: (approval) => {
    set(state => ({
      approvals: [approval, ...state.approvals],
    }))
  },

  pendingCount: () => get().approvals.filter(a => a.status === 'pending').length,
}))
