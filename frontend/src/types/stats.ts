export interface DailyStats {
  date: string
  tokens_used: number
  cost: number
  missions_completed: number
  quality_score: number
  agent_count: number
}

export interface TokenTrendData {
  date: string
  tokens: number
  cost: number
}

export interface ModelDistribution {
  model: string
  tokens_used: number
  percentage: number
  cost: number
}

export interface AgentRanking {
  agent_id: string
  agent_name: string
  tokens_used: number
  missions_completed: number
  quality_score: number
  cost: number
}

export interface QualityStats {
  passed: number
  failed: number
  retry: number
  escalated: number
  total: number
  pass_rate: number
}

export interface SavingsStats {
  methodology: string
  full_load_estimate: number
  actual_used: number
  tokens_saved: number
  cost_saved: number
  savings_percentage: number
}

export interface DashboardStats {
  today: DailyStats
  trend: TokenTrendData[]
  models: ModelDistribution[]
  agents: AgentRanking[]
  quality: QualityStats
  savings: SavingsStats
  timestamp: string
}
