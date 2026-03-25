import { create } from 'zustand'
import type { LearningOverview, AgentGrowth } from '../types/learning'
import { fetchLearningOverview, fetchAgentGrowth } from '../api/learning'

interface LearningStore {
  overview: LearningOverview | null
  agentGrowth: AgentGrowth | null
  selectedAgentId: string | null
  loading: boolean
  error: string | null

  loadOverview: () => Promise<void>
  loadAgentGrowth: (agentId: string) => Promise<void>
  setSelectedAgent: (agentId: string | null) => void
}

export const useLearningStore = create<LearningStore>((set, get) => ({
  overview: null,
  agentGrowth: null,
  selectedAgentId: null,
  loading: false,
  error: null,

  loadOverview: async () => {
    set({ loading: true, error: null })
    try {
      const overview = await fetchLearningOverview()
      set({ overview, loading: false })
    } catch (e: any) {
      set({ error: e.message || 'Failed to load overview', loading: false })
    }
  },

  loadAgentGrowth: async (agentId: string) => {
    set({ loading: true, error: null, selectedAgentId: agentId })
    try {
      const agentGrowth = await fetchAgentGrowth(agentId)
      set({ agentGrowth, loading: false })
    } catch (e: any) {
      set({ error: e.message || 'Failed to load agent data', loading: false })
    }
  },

  setSelectedAgent: (agentId) => {
    set({ selectedAgentId: agentId, agentGrowth: null })
    if (agentId) {
      get().loadAgentGrowth(agentId)
    }
  },
}))
