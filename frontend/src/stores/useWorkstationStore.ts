import { create } from 'zustand'
import type { WorkstationHome, PositionInfo } from '../types/workstation'
import {
  fetchWorkstationHome,
  fetchPositions,
  assignPosition,
  runQuickWorkflow,
} from '../api/workstation'

interface WorkstationState {
  home: WorkstationHome | null
  positions: PositionInfo[]
  loading: boolean
  error: string | null

  loadHome: () => Promise<void>
  loadPositions: () => Promise<void>
  selectPosition: (positionId: string) => Promise<void>
  triggerWorkflow: (workflowId: string, params?: Record<string, string>) => Promise<string | null>
}

export const useWorkstationStore = create<WorkstationState>((set, get) => ({
  home: null,
  positions: [],
  loading: false,
  error: null,

  loadHome: async () => {
    set({ loading: true, error: null })
    try {
      const home = await fetchWorkstationHome()
      set({ home, loading: false })
    } catch (e: any) {
      set({ error: e.message || 'Failed to load workstation', loading: false })
    }
  },

  loadPositions: async () => {
    try {
      const positions = await fetchPositions()
      set({ positions })
    } catch (e: any) {
      console.error('Failed to load positions:', e)
    }
  },

  selectPosition: async (positionId: string) => {
    try {
      await assignPosition(positionId)
      await get().loadHome()
    } catch (e: any) {
      set({ error: e.message || 'Failed to assign position' })
    }
  },

  triggerWorkflow: async (workflowId: string, params?: Record<string, string>) => {
    try {
      const { mission_id } = await runQuickWorkflow(workflowId, params)
      return mission_id
    } catch (e: any) {
      set({ error: e.message || 'Failed to run workflow' })
      return null
    }
  },
}))
