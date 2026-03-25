import client from './client'
import type { WorkstationHome, PositionInfo, FocusItem, LiveFeedEvent, InsightItem, TimeRange, AggregatedFeedData } from '../types/workstation'

export async function fetchWorkstationHome(): Promise<WorkstationHome> {
  return client.get('/workstation/home', { _silent: true } as any)
}

export async function fetchPositions(): Promise<PositionInfo[]> {
  const data: any = await client.get('/workstation/positions')
  return data.positions
}

export async function assignPosition(positionId: string): Promise<void> {
  await client.post('/workstation/assign', { position_id: positionId })
}

export async function runQuickWorkflow(
  workflowId: string,
  params?: Record<string, string>,
): Promise<{ mission_id: string }> {
  return client.post('/workstation/run-workflow', { workflow_id: workflowId, params })
}

export interface DagNodeStatus {
  id: string
  status: 'pending' | 'ready' | 'running' | 'completed' | 'skipped' | 'failed' | 'waiting'
  duration_ms: number
  error?: string | null
  output_preview?: string
  agent_id?: string
  tokens_used?: number
  approval?: {
    approval_id: string
    summary: string
  }
}

export interface DagStatus {
  mission_id: string
  found: boolean
  workflow_name?: string
  status: string
  completed_count?: number
  total_count?: number
  nodes: DagNodeStatus[]
}

export async function fetchDagStatus(missionId: string): Promise<DagStatus> {
  return client.get(`/missions/${missionId}/dag-status`)
}

// ── Daily Context API ────────────────────────────────────────────────────────

export interface Priority {
  id: string
  text: string
  priority: 'high' | 'mid' | 'low'
  done: boolean
  source: 'manual' | 'ai_suggest' | 'from_meeting'
  date: string
}

export interface ScheduleItem {
  id: string
  time: string
  title: string
  duration_min: number
  type: 'meeting' | 'deadline' | 'reminder'
  done: boolean
  date: string
}

export interface FollowUp {
  id: string
  text: string
  direction: 'waiting_them' | 'waiting_me'
  person: string
  due_date: string
  done: boolean
  source: string
  date: string
}

export interface WorkItem {
  id: string
  title: string
  status: 'active' | 'at_risk' | 'blocked' | 'done'
  progress_pct: number
  due_date: string
  milestone: string
  tags: string[]
}

export interface DailyContext {
  date: string
  priorities: Priority[]
  schedule: ScheduleItem[]
  followups: FollowUp[]
  work_items: WorkItem[]
}

export async function fetchDailyContext(date?: string): Promise<DailyContext> {
  const q = date ? `?date=${date}` : ''
  return client.get(`/daily-context${q}`)
}

export async function addPriority(text: string, priority = 'mid', source = 'manual'): Promise<Priority> {
  return client.post('/daily-context/priorities', { text, priority, source })
}
export async function updatePriority(id: string, updates: Partial<Priority>): Promise<void> {
  return client.patch(`/daily-context/priorities/${id}`, updates)
}
export async function deletePriority(id: string): Promise<void> {
  return client.delete(`/daily-context/priorities/${id}`)
}

export async function addScheduleItem(item: { time: string; title: string; duration_min?: number; type?: string }): Promise<ScheduleItem> {
  return client.post('/daily-context/schedule', item)
}
export async function deleteScheduleItem(id: string): Promise<void> {
  return client.delete(`/daily-context/schedule/${id}`)
}

export async function addFollowUp(item: { text: string; direction?: string; person?: string; due_date?: string }): Promise<FollowUp> {
  return client.post('/daily-context/followups', item)
}
export async function updateFollowUp(id: string, updates: Partial<FollowUp>): Promise<void> {
  return client.patch(`/daily-context/followups/${id}`, updates)
}
export async function deleteFollowUp(id: string): Promise<void> {
  return client.delete(`/daily-context/followups/${id}`)
}

export async function fetchWorkItems(): Promise<WorkItem[]> {
  const data: any = await client.get('/work-items')
  return data.items
}
export async function addWorkItem(item: { title: string; status?: string; progress_pct?: number; due_date?: string; milestone?: string; tags?: string[] }): Promise<WorkItem> {
  return client.post('/work-items', item)
}
export async function updateWorkItem(id: string, updates: Partial<WorkItem>): Promise<void> {
  return client.patch(`/work-items/${id}`, updates)
}
export async function deleteWorkItem(id: string): Promise<void> {
  return client.delete(`/work-items/${id}`)
}

// ── V19: 智能驾驶舱 API ──────────────────────────────────

export async function fetchFocusItems(range: TimeRange = 'today'): Promise<FocusItem[]> {
  const data: any = await client.get(`/workstation/focus?range=${range}`, { _silent: true } as any)
  return data.focus_items
}

export async function fetchLiveFeed(limit = 30, range: TimeRange = 'today'): Promise<LiveFeedEvent[]> {
  const data: any = await client.get(`/workstation/live-feed?limit=${limit}&range=${range}`, { _silent: true } as any)
  return data.events
}

export async function fetchLiveFeedAggregated(range: 'week' | 'month'): Promise<AggregatedFeedData> {
  return client.get(`/workstation/live-feed?range=${range}`, { _silent: true } as any)
}

export async function dismissEvent(eventId: string): Promise<void> {
  await client.post(`/workstation/events/${eventId}/dismiss`, {})
}

export async function recordSignal(signal: {
  signal_type: string
  context_type?: string
  context_id?: string
  detail?: Record<string, any>
}): Promise<void> {
  await client.post('/workstation/signals', signal)
}

export async function fetchInsights(range: TimeRange = 'today'): Promise<InsightItem[]> {
  const data: any = await client.get(`/workstation/insights?range=${range}`)
  return data.insights
}

export interface PeriodStats {
  period: string
  start_date: string
  usage: {
    total_sessions: number
    total_tokens: number
    total_messages: number
    by_capability: Record<string, { tokens: number; count: number }>
    daily_trend: { date: string; count: number; tokens: number }[]
  }
  events: { total: number; by_type: Record<string, number> }
  feedback: { up: number; down: number }
  patterns: { new_count: number; total_count: number }
  playbook: { active_rules: number; new_rules: number }
  peak_hours: { hour: number; count: number }[]
}

export async function fetchPeriodStats(range: 'week' | 'month'): Promise<PeriodStats> {
  const data: any = await client.get(`/workstation/insights?range=${range}`)
  return data.period_stats
}

// ── 风险推理 ─────────────────────────────────────────

export interface RiskItem {
  id: string
  risk_type: 'delivery' | 'dependency' | 'overload' | 'process' | 'metric' | 'trend' | 'compound' | 'preparation' | 'blind_spot' | 'synthesis'
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  detail: string
  source_type: string
  source_id: string
  suggested_action: string
  action_data: Record<string, any>
}

export interface RisksResponse {
  risks: RiskItem[]
  count: number
  critical: number
  high: number
}

export async function fetchRisks(): Promise<RisksResponse> {
  return client.get('/workstation/risks')
}

// ── V24: 统一洞察 API ──────────────────────────────────

import type { UnifiedInsightsResponse } from '../types/workstation'

export async function fetchUnifiedInsights(): Promise<UnifiedInsightsResponse> {
  return client.get('/workstation/insights-v2', { _silent: true } as any)
}

// ── AI 学习透明度 ──────────────────────────────────────

export interface UserPattern {
  id: string
  key: string
  value: Record<string, any>
  confidence: number
  hit_count: number
  position_id: string
  last_hit_at: string
}

export interface PatternsResponse {
  total: number
  patterns: Record<string, UserPattern[]>
}

export async function fetchPatterns(): Promise<PatternsResponse> {
  return client.get('/workstation/patterns')
}

export async function deletePattern(patternId: string): Promise<void> {
  await client.delete(`/workstation/patterns/${patternId}`)
}

// ── 最近 AI 产出 ───────────────────────────────────────

export interface RecentOutcome {
  id: string
  type: 'workflow' | 'mission'
  title: string
  summary: string
  created_at: string
  context: Record<string, any>
}

export async function fetchRecentOutcomes(limit = 10): Promise<RecentOutcome[]> {
  const data: any = await client.get(`/workstation/recent-outcomes?limit=${limit}`)
  return data.outcomes
}
