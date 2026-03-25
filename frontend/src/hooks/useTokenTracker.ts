import { useStatsStore } from '../stores/useStatsStore'

export function useTokenTracker() {
  const stats = useStatsStore(s => s.stats)

  return {
    todayTokens: stats?.today.tokens_used ?? 0,
    todayCost: stats?.today.cost ?? 0,
    budgetLimit: 10, // from config
    budgetUsed: stats?.today.cost ?? 0,
    budgetRatio: stats ? stats.today.cost / 10 : 0,
  }
}
