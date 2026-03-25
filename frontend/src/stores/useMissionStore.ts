import { create } from 'zustand'
import type { Mission, DagNodeEvent } from '../types/mission'
import { fetchMissions, fetchMission } from '../api/missions'

interface MissionState {
  missions: Mission[]
  activeMission: Mission | null
  loading: boolean
  error: string | null

  /** DAG node status map: { nodeId: status } — for real-time workflow visualization */
  dagState: Record<string, string> | null

  load: () => Promise<void>
  loadOne: (missionId: string) => Promise<void>
  updateProgress: (missionId: string, step: number, total: number, currentAgent: string) => void
  completeMission: (missionId: string) => void
  updateDagState: (missionId: string, event: DagNodeEvent) => void
  clearDagState: () => void
}

export const useMissionStore = create<MissionState>((set) => ({
  missions: [],
  activeMission: null,
  loading: false,
  error: null,
  dagState: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const missions = await fetchMissions()
      set({ missions, loading: false })
    } catch (e: any) {
      set({ loading: false, error: e?.message || '加载任务失败' })
    }
  },

  loadOne: async (missionId) => {
    set({ loading: true, error: null })
    try {
      const mission = await fetchMission(missionId)
      set({ activeMission: mission, loading: false })
    } catch (e: any) {
      set({ loading: false, error: e?.message || '加载任务详情失败' })
    }
  },

  updateProgress: (missionId, step, total, _currentAgent) => {
    set(state => {
      const update = (m: Mission) =>
        m.id === missionId ? { ...m, current_step: step, total_steps: total, status: 'in_progress' as const } : m
      return {
        missions: state.missions.map(update),
        activeMission: state.activeMission?.id === missionId
          ? { ...state.activeMission, current_step: step, total_steps: total, status: 'in_progress' }
          : state.activeMission,
      }
    })
  },

  completeMission: (missionId) => {
    set(state => {
      const update = (m: Mission) =>
        m.id === missionId ? { ...m, status: 'completed' as const, completed_at: new Date().toISOString() } : m
      return {
        missions: state.missions.map(update),
        activeMission: state.activeMission?.id === missionId
          ? { ...state.activeMission, status: 'completed', completed_at: new Date().toISOString() }
          : state.activeMission,
        dagState: null,
      }
    })
  },

  updateDagState: (missionId, event) => {
    set(state => {
      // Only update if this is for the active mission
      if (state.activeMission && state.activeMission.id !== missionId) return state
      const prev = state.dagState || {}
      return {
        dagState: { ...prev, [event.node_id]: event.status },
      }
    })
  },

  clearDagState: () => set({ dagState: null }),
}))
