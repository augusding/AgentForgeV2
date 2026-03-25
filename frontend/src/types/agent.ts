export type AgentStatus = 'idle' | 'executing' | 'waiting' | 'error'

export interface Agent {
  id: string
  name: string
  role: string
  status: AgentStatus
  squad_id: string
  squad_name: string
  description: string
  soul_core: string
  capabilities: string[]
  collaborators: string[]
  today_tasks: number
  today_tokens: number
  quality_score?: number
  model_preference?: string
  updated_at: string
  created_at: string
}

export interface Squad {
  id: string
  name: string
  description?: string
  members: Agent[]
  created_at: string
}

export interface AgentMemory {
  id: string
  agent_id: string
  content: string
  importance: number
  decay_weight: number
  created_at: string
  last_used: string
}
