export type MissionStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'waiting_approval'

export type MissionMode = 'direct' | 'squad' | 'workflow'

export type QualityGateDecision = 'passed' | 'failed' | 'retry' | 'escalate'

export interface MissionStep {
  id: string
  step_number: number
  agent_id: string
  agent_name: string
  description: string
  status: MissionStatus
  input: string
  output: string
  model_used: string
  tokens_used: number
  duration_ms: number
  quality_score?: number
  quality_decision?: QualityGateDecision
  quality_feedback?: string
  created_at: string
  completed_at?: string
}

export interface ApprovalRequest {
  id: string
  mission_id: string
  step_id: string
  agent_id: string
  agent_name: string
  summary: string
  full_analysis: string
  options: ApprovalOption[]
  deliverables?: Record<string, string>
  created_at: string
  expires_at: string
  status: 'pending' | 'approved' | 'rejected' | 'modified'
  resolved_at?: string
  resolved_by?: string
  comment?: string
}

export interface ApprovalOption {
  id: string
  label: string
  icon: string
  value: string
}

export interface DagNodeEvent {
  mission_id: string
  event: string
  node_id: string
  status: string
  duration?: number
  quality_score?: number
  error?: string
}

export interface Mission {
  id: string
  title: string
  description: string
  user_id: string
  mode: MissionMode
  status: MissionStatus
  priority?: 'low' | 'normal' | 'high'
  involved_agents: string[]
  input: string
  output: string
  blackboard: Record<string, string>
  steps: MissionStep[]
  current_step?: number
  total_steps?: number
  total_tokens: number
  total_cost: number
  duration_ms: number
  quality_score?: number
  created_at: string
  started_at?: string
  completed_at?: string
  tags?: string[]
}
