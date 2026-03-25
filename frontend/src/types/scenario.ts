export interface KpiImpact {
  kpi: string
  direction: 'up' | 'down'
  description: string
}

export interface Scenario {
  id: string
  workflow: string
  name: string
  tagline: string
  icon: string
  color: string
  estimated_minutes: number
  agents_involved: string[]
  expected_outputs: string[]
  demo_parameters: Record<string, string>
  kpi_impact: KpiImpact[]
  context_briefing: string
}

export interface ScenarioPreview {
  name: string
  tagline: string
  icon: string
}

export interface DemoAgentStat {
  agent_id: string
  agent_name: string
  tokens_used: number
  missions_completed: number
  quality_score: number
  cost: number
}

export interface DemoStats {
  today: {
    tokens_used: number
    cost: number
    missions_completed: number
    quality_score: number
    agent_count: number
  }
  trend: Array<{ date: string; tokens: number; cost: number }>
  agents: DemoAgentStat[]
}

export interface SquadInfo {
  squad_id: string
  name: string
  lead: string
  members: string[]
}

export interface ScenarioData {
  scenarios: Scenario[]
  demo_stats: DemoStats | null
  kpi_definitions: Record<string, { name?: string; unit?: string; target?: string }>
  squads: SquadInfo[]
}
