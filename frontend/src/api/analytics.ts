import client from './client'

// ── 类型定义 ──

export interface UsageEntry {
  message_id: string
  capability: string
  tokens_used: number
  tools_used: string // JSON array
  rag_hit_count: number
  rag_avg_score: number
  created_at: string
}

export interface DailyUsage {
  date: string
  total_sessions: number
  total_tokens: number
  total_messages: number
  by_capability: Record<string, { tokens: number; count: number }>
}

export interface WeeklyEntry {
  date: string
  tokens: number
  count: number
}

export interface QualityStats {
  days: number
  total_completions: number
  feedback_up: number
  feedback_down: number
  positive_rate: number
  copy_count: number
  download_count: number
  regenerate_count: number
  adoption_rate: number
  rag_queries: number
  rag_avg_score: number
  knowledge_hit_rate: number
  quality_score: number
}

export interface QualityTrendEntry {
  week: number
  total: number
  feedback_up: number
  copy_count: number
  score: number
}

export interface Insight {
  type: 'info' | 'success' | 'warning'
  title: string
  detail: string
  action: string | null
}

// ── API 调用 ──

export async function fetchSessionUsage(sessionId: string): Promise<UsageEntry[]> {
  return client.get(`/analytics/session/${sessionId}`)
}

export async function fetchDailyUsage(date?: string): Promise<DailyUsage> {
  const params = date ? `?date=${date}` : ''
  return client.get(`/analytics/daily${params}`)
}

export async function fetchWeeklyUsage(): Promise<WeeklyEntry[]> {
  return client.get('/analytics/weekly')
}

export async function fetchQualityStats(days = 7): Promise<QualityStats> {
  return client.get(`/analytics/quality?days=${days}`)
}

export async function fetchQualityTrend(weeks = 4): Promise<QualityTrendEntry[]> {
  return client.get(`/analytics/quality/trend?weeks=${weeks}`)
}

export async function fetchInsights(): Promise<Insight[]> {
  return client.get('/analytics/insights')
}

export async function sendSignal(
  sessionId: string,
  messageId: string,
  signalType: 'copy' | 'download' | 'regenerate',
): Promise<void> {
  await client.post('/analytics/signal', {
    session_id: sessionId,
    message_id: messageId,
    signal_type: signalType,
  })
}
