export interface PositionMetric {
  key: string
  name: string
  unit: string
  target: string
  direction: 'higher_is_better' | 'lower_is_better' | ''
  value: number | null
  change: number | null
}

export interface QuickWorkflow {
  id: string
  name: string
  description: string
  icon: string
  trigger: 'manual' | 'scheduled'
  schedule: string
}

export interface PositionInfo {
  position_id: string
  display_name: string
  icon: string
  color: string
  department: string
  description: string
}

export interface RecentChat {
  session_id: string
  title: string
  message_count: number
  last_message_at: string
}

export interface PendingItem {
  id: string
  type: string
  title: string
  description?: string
  status: string
  created_at?: string
  mission_id?: string
}

export interface PositionOnboarding {
  tip: string
  prompts: string[]
}

export interface WorkstationHome {
  assigned: boolean
  position: PositionInfo
  assistant: {
    personality: string
    default_model: string
  }
  metrics: PositionMetric[]
  quick_workflows: QuickWorkflow[]
  tools: string[]
  knowledge_scope: string[]
  onboarding?: PositionOnboarding
  user_name?: string
  pending_approvals?: number
  recent_chats?: RecentChat[]
  pending_items?: PendingItem[]
}

// ── V19: 智能驾驶舱类型 ────────────────────────────────

export interface FocusItem {
  id: string
  type: 'action_needed' | 'priority' | 'schedule'
  title: string
  summary: string
  urgency: 'high' | 'mid' | 'low'
  context_id?: string
  context_data?: Record<string, any>
  actions: string[]
}

export interface LiveFeedEvent {
  id: string
  event_type: 'workflow_completed' | 'workflow_running' | 'approval_needed' | 'approval_done' | 'insight' | 'schedule'
  title: string
  summary: string
  status: 'active' | 'collapsed' | 'dismissed'
  context_id: string
  context_data: Record<string, any>
  position_id: string
  created_at: string
}

export interface InsightItem {
  type: 'efficiency' | 'optimization' | 'knowledge' | 'trend' | 'pattern'
  title: string
  detail: string
  action?: string
  action_data?: Record<string, any>
}

// V24: 统一洞察模型
export interface UnifiedInsightItem {
  id: string
  layer: 'execution' | 'results' | 'business' | 'indicators'
  insight_type: 'risk' | 'opportunity' | 'alert'
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  detail: string
  suggested_action?: string
  data_evidence?: Record<string, any>
  source_type?: string
  source_id?: string
  created_at?: string
}

export interface UnifiedInsightsResponse {
  items: UnifiedInsightItem[]
  counts: { risk: number; opportunity: number; alert: number }
  total: number
}

// ── 时间维度类型 ──────────────────────────────────────
export type TimeRange = 'today' | 'week' | 'month'

export interface AggregatedGroup {
  date?: string
  week?: string
  label?: string
  date_from?: string
  date_to?: string
  total: number
  by_type: Record<string, number>
}

export interface AggregatedFeedData {
  time_range: string
  start_date: string
  totals: Record<string, number>
  groups: AggregatedGroup[]
  events: LiveFeedEvent[]
}
