/**
 * Profile Builder 类型定义
 */

export type BuildPhase = 'intake' | 'generation' | 'review' | 'calibration' | 'finalized' | 'deployed'

export interface BuilderSession {
  session_id: string
  phase: BuildPhase
  created_at: string
  updated_at: string
  intake_completion?: number          // 0-100
  agent_count?: number
  workflow_count?: number
}

// ── 选择式 UI 类型 ──────────────────────────────────────

export type IntakeUIType = 'text' | 'industry_select' | 'role_select' | 'workflow_select' | 'chips'

export interface TemplateOption {
  id: string
  name: string
  description: string
  icon?: string
  tags?: string[]
  role_count?: number
  workflow_count?: number
  skill_count?: number
}

export interface RoleOption {
  id: string
  name: string
  description: string
  avatar_emoji?: string
  checked: boolean
}

export interface WorkflowOption {
  id: string
  name: string
  description: string
  steps?: number
  agents_involved?: string[]
  checked: boolean
}

export interface IntakeUIData {
  templates?: TemplateOption[]
  roles?: RoleOption[]
  workflows?: WorkflowOption[]
  chips?: string[]
}

export interface IntakeMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  ui_type?: IntakeUIType          // 仅 assistant 消息
  ui_data?: IntakeUIData          // 仅 assistant 消息
}

export interface IntakeResponse {
  session: BuilderSession
  response: string
  completed: boolean
  ui_type: IntakeUIType
  ui_data: IntakeUIData
}

// ── 其余类型 ────────────────────────────────────────────

export interface IntakeStatus {
  dimensions: Record<string, boolean>
  overall: number
  filled: number
  total: number
}

export interface ValidationIssue {
  level: 'error' | 'warning'
  field: string
  message: string
}

export interface ProfilePreviewData {
  profile_yaml: string
  squads_yaml: string
  agents: Record<string, string>        // agent_id → yaml string
  workflows: Record<string, string>     // wf_name → yaml string
  heartbeats_yaml: string
  guardrails_yaml: string
  knowledge_docs: { name: string; content: string }[]
  validation_issues: ValidationIssue[]
}

export interface CalibrationCase {
  id: string
  instruction: string
  expected_behavior: string
  expected_output_keywords: string[]
  actual_result?: string
  score?: number
  feedback?: string
  adjustments?: string[]
}

export interface CalibrationReport {
  overall_score: number
  passed: boolean
  strengths: string[]
  weaknesses: string[]
  recommendation: string
}

export interface ExportSummary {
  file_count: number
  total_size: number
  files: { path: string; size: number }[]
  agents_count: number
  workflows_count: number
  output_path?: string
}

export interface GenerationStatus {
  status: 'running' | 'completed' | 'failed'
  step: string
  progress: number
  steps_detail: string[]
  error?: string
  issues?: ValidationIssue[]
}
