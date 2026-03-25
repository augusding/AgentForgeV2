export interface ProfileScenarioPreview {
  name: string
  tagline: string
  icon: string
}

export interface Profile {
  id: string
  name: string
  description: string
  industry: string
  agent_count: number
  workflow_count: number
  scenario_previews?: ProfileScenarioPreview[]
  created_at: string
  updated_at: string
}

// ── Provider Registry (from backend) ──

export interface ProviderModel {
  id: string
  name: string
  name_zh: string
  context_window: number
  is_default: boolean
}

export interface ProviderDef {
  id: string
  name: string
  name_zh: string
  sdk: string
  api_base: string
  env_key: string
  models: ProviderModel[]
}

export interface TierConfig {
  provider: string
  model: string
  api_key_env: string
  api_key_set: boolean
  api_key_masked: string
  enabled: boolean
}

export interface LLMConfig {
  // Tier-based config (new)
  tiers?: Record<string, TierConfig>   // tier1, tier2, tier3
  providers?: ProviderDef[]            // 9-provider registry from backend
  // Legacy fields (kept for compat)
  simple_model: string
  standard_model: string
  complex_model: string
  fallback_enabled: boolean
}

export interface ChannelConfig {
  type: 'feishu' | 'wecom' | 'api'
  enabled: boolean
  config: Record<string, string>
  test_status?: 'connected' | 'disconnected' | 'error'
}

export interface GuardrailConfig {
  budget_limit_daily: number
  budget_warning_threshold: number
  sensitive_words: string[]
  pii_masking_enabled: boolean
}

export interface Workflow {
  id: string
  name: string
  description: string
  trigger: string
  steps: WorkflowStep[]
  enabled: boolean
  created_at: string
}

export interface WorkflowStep {
  agent_id: string
  agent_name: string
  action: string
  order: number
}

export interface Heartbeat {
  id: string
  name: string
  cron: string
  agent_id: string
  agent_name: string
  task_template: string
  enabled: boolean
  last_run?: string
  next_run?: string
}

export interface AppConfig {
  current_profile_id: string
  profiles: Profile[]
  llm: LLMConfig
  channels: ChannelConfig[]
  guardrails: GuardrailConfig
  updated_at: string
}
