export interface CollaborationMatrix {
  agents: string[]
  matrix: number[][]
}

export interface CollaborationQuality {
  agent_a: string
  agent_b: string
  avg_quality: number
  mission_count: number
}

export interface BottleneckAgent {
  agent_id: string
  avg_duration: number
  total_tasks: number
  avg_quality: number | null
  total_tokens: number
}

export interface CollaborationSuggestion {
  suggestion: string
  agent_a: string
  agent_b: string
  metric: string
  value: number
}
