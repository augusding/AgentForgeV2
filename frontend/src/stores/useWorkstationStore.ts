import { create } from 'zustand'
import client from '../api/client'

interface WorkstationState {
  home: any | null
  positions: any[]
  loading: boolean
  loadHome: () => Promise<void>
  loadPositions: () => Promise<void>
  assignPosition: (positionId: string) => Promise<void>
}

export const useWorkstationStore = create<WorkstationState>((set, get) => ({
  home: null,
  positions: [],
  loading: true,

  loadHome: async () => {
    set({ loading: true })
    try {
      const data: any = await client.get('/workstation/home')
      if (data.assigned) {
        set({ home: data, loading: false })
      } else {
        set({ home: null, loading: false })
        await get().loadPositions()
      }
    } catch {
      set({ home: null, loading: false })
      await get().loadPositions()
    }
  },

  loadPositions: async () => {
    try {
      const data: any = await client.get('/workstation/positions')
      set({ positions: data.positions || [] })
    } catch {
      set({ positions: [] })
    }
  },

  assignPosition: async (positionId) => {
    await client.post('/workstation/assign', { position_id: positionId })
    await get().loadHome()
  },
}))
