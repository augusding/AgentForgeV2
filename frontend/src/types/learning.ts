// ── V4: Learning Dashboard Types ────────────────────────

export interface SkillStat {
  skill_id: string
  executions: number
  avg_score: number
  level: number
  trend?: string
}

export interface QualityPoint {
  date: string
  avg_score: number
  count: number
}

export interface PlaybookRule {
  agent_id?: string
  rule: string
  confidence: number
  applied_count: number
  success_count: number
}

export interface SoulSuggestion {
  id?: string
  agent_id?: string
  type: string
  target_field: string
  current_value?: string
  suggested_value: string
  reasoning?: string
  confidence: number
  status: string
  created_at?: string
  resolved_at?: string
}

export interface SkillSuggestion {
  id: string
  suggested_name: string
  description: string
  required_tools: string
  methodology: string
  occurrences: number
  confidence: number
  status: string
  created_at: string
}

export interface LearningOverview {
  skill_tracking: {
    total_records: number
    agents: number
    skills: number
  }
  playbook: {
    total_rules: number
    active_rules: number
    avg_confidence: number
  }
  soul_suggestions: {
    pending: number
    accepted: number
    modified?: number
    ignored: number
  }
  skill_suggestions: {
    pending: number
    accepted: number
    ignored: number
  }
}

export interface AgentGrowth {
  agent_id: string
  skills: SkillStat[]
  quality_history: QualityPoint[]
  playbook_rules: PlaybookRule[]
  soul_suggestions: SoulSuggestion[]
}
