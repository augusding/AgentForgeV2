import { create } from 'zustand'
import type { DashboardStats } from '../types/stats'
import { fetchDashboardStats } from '../api/stats'
import { useScenarioStore } from './useScenarioStore'

interface StatsState {
  stats: (DashboardStats & { is_demo?: boolean }) | null
  loading: boolean
  error: string | null

  load: () => Promise<void>
  updateTokens: (dailyTotal: number, missionTotal: number) => void
}

export const useStatsStore = create<StatsState>((set, get) => ({
  stats: null,
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const stats = await fetchDashboardStats()

      // Demo data overlay: when real stats are all zeros and demo mode is on
      const scenarioStore = useScenarioStore.getState()
      const demoStats = scenarioStore.data?.demo_stats
      const isAllZero = stats.today.tokens_used === 0 && stats.today.missions_completed === 0
      const demoMode = scenarioStore.demoMode

      if (isAllZero && demoMode && demoStats) {
        // Overlay demo stats onto the real structure
        set({
          stats: {
            ...stats,
            today: {
              ...stats.today,
              tokens_used: demoStats.today.tokens_used,
              cost: demoStats.today.cost,
              missions_completed: demoStats.today.missions_completed,
              quality_score: demoStats.today.quality_score,
              agent_count: demoStats.today.agent_count,
            },
            trend: demoStats.trend.map(t => ({ date: t.date, tokens: t.tokens, cost: t.cost })),
            agents: demoStats.agents.map(a => ({
              agent_id: a.agent_id,
              agent_name: a.agent_name,
              tokens_used: a.tokens_used,
              missions_completed: a.missions_completed,
              quality_score: a.quality_score,
              cost: a.cost,
            })),
            is_demo: true,
          },
          loading: false,
        })
      } else {
        set({ stats: { ...stats, is_demo: false }, loading: false })
      }
    } catch (e: any) {
      set({ loading: false, error: e?.message || '加载统计数据失败' })
    }
  },

  updateTokens: (dailyTotal, _missionTotal) => {
    const current = get().stats
    if (!current) return
    set({
      stats: {
        ...current,
        today: { ...current.today, tokens_used: dailyTotal, cost: dailyTotal * 0.000015 },
        is_demo: false, // Real data is coming in, exit demo
      },
    })
  },
}))
