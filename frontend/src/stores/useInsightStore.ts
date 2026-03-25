import { create } from 'zustand'
import type { UnifiedInsightItem, UnifiedInsightsResponse } from '../types/workstation'
import { fetchUnifiedInsights } from '../api/workstation'

interface InsightState {
  items: UnifiedInsightItem[]
  counts: { risk: number; opportunity: number; alert: number }
  total: number
  loading: boolean       // true only on first load (no cached data)
  lastFetchedAt: number  // timestamp ms

  load: () => Promise<void>
  startBackgroundRefresh: () => () => void  // returns cleanup function
}

const CACHE_TTL = 25_000  // 25s — avoid refetch if navigated back quickly

export const useInsightStore = create<InsightState>((set, get) => ({
  items: [],
  counts: { risk: 0, opportunity: 0, alert: 0 },
  total: 0,
  loading: false,
  lastFetchedAt: 0,

  load: async () => {
    const state = get()
    const now = Date.now()

    // Skip if fetched recently (within TTL)
    if (state.lastFetchedAt && now - state.lastFetchedAt < CACHE_TTL) {
      return
    }

    // Only show loading spinner when no cached data
    if (state.items.length === 0) {
      set({ loading: true })
    }

    try {
      const data = await fetchUnifiedInsights()
      set({
        items: data.items,
        counts: data.counts,
        total: data.total,
        loading: false,
        lastFetchedAt: Date.now(),
      })
    } catch {
      set({ loading: false })
    }
  },

  startBackgroundRefresh: () => {
    const timer = setInterval(() => {
      get().load()
    }, 30_000)
    return () => clearInterval(timer)
  },
}))
