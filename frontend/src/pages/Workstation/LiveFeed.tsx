/**
 * 工作动态 — 多时间维度视图
 *
 * 今日：实时事件流（30s 刷新）
 * 本周：按天分组的摘要统计卡片
 * 本月：按周分组的汇总统计
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2, Clock, Loader2, AlertTriangle,
  ChevronDown, ChevronRight, X, Zap,
  Eye, ThumbsUp, Activity,
  UserCheck, Users, BarChart3,
} from 'lucide-react'
import { fetchLiveFeed, fetchLiveFeedAggregated, dismissEvent } from '../../api/workstation'
import { useDailyContextStore } from '../../stores/useDailyContextStore'
import type { LiveFeedEvent, TimeRange, AggregatedGroup } from '../../types/workstation'
import FeatureTip from './FeatureTip'

/* ── Types & Config ──────────────────────────────────────── */

type FilterTab = 'all' | 'workflow' | 'approval' | 'followup'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',      label: '全部' },
  { key: 'workflow',  label: '工作流' },
  { key: 'approval',  label: '审批' },
  { key: 'followup',  label: '跟进' },
]

const EVENT_CONFIG: Record<string, {
  icon: typeof CheckCircle2
  color: string
  dotColor: string
  label: string
}> = {
  workflow_completed: { icon: CheckCircle2, color: 'text-success', dotColor: 'bg-success', label: '已完成' },
  workflow_running: { icon: Loader2, color: 'text-info', dotColor: 'bg-info', label: '处理中' },
  approval_needed: { icon: Clock, color: 'text-warning', dotColor: 'bg-warning', label: '等待操作' },
  approval_done: { icon: ThumbsUp, color: 'text-success', dotColor: 'bg-success', label: '已审批' },
  insight: { icon: Zap, color: 'text-accent', dotColor: 'bg-accent', label: '洞察' },
  schedule: { icon: Clock, color: 'text-text-muted', dotColor: 'bg-text-muted', label: '即将到来' },
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  workflow_completed: '完成', workflow_running: '进行中',
  approval_needed: '待审批', approval_done: '已审批',
  insight: '洞察', schedule: '日程',
}

/* ── Helpers ──────────────────────────────────────────────── */

function getDateGroup(iso: string): 'today' | 'yesterday' | 'earlier' {
  try {
    const d = new Date(iso)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 86400000)
    if (d >= today) return 'today'
    if (d >= yesterday) return 'yesterday'
    return 'earlier'
  } catch { return 'earlier' }
}

const DATE_GROUP_LABELS: Record<string, string> = {
  today: '今天', yesterday: '昨天', earlier: '更早',
}

function formatTime(iso: string, showDate = false) {
  try {
    const d = new Date(iso)
    const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    if (!showDate) return time
    return `${d.getMonth() + 1}/${d.getDate()} ${time}`
  } catch { return '' }
}

function matchesFilter(event: LiveFeedEvent, filter: FilterTab): boolean {
  if (filter === 'all') return true
  if (filter === 'workflow') return ['workflow_completed', 'workflow_running', 'schedule'].includes(event.event_type)
  if (filter === 'approval') return ['approval_needed', 'approval_done'].includes(event.event_type)
  return false
}

function formatWeekday(dateStr: string) {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('zh-CN', { weekday: 'short', month: 'numeric', day: 'numeric' })
  } catch { return dateStr }
}

/* ── Main Component ──────────────────────────────────────── */

interface Props { timeRange: TimeRange }

export default function LiveFeed({ timeRange }: Props) {
  const [events, setEvents] = useState<LiveFeedEvent[]>([])
  const [aggData, setAggData] = useState<{ groups: AggregatedGroup[]; totals: Record<string, number>; events: LiveFeedEvent[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [earlierVisible, setEarlierVisible] = useState(6)

  const navigate = useNavigate()

  // Follow-ups from daily context
  const dailyContext = useDailyContextStore(s => s.context)
  const toggleFollowUp = useDailyContextStore(s => s.toggleFollowUp)
  const activeFollowUps = useMemo(
    () => (dailyContext?.followups ?? []).filter(f => !f.done),
    [dailyContext?.followups],
  )

  const loadEvents = useCallback(async () => {
    try {
      if (timeRange === 'today') {
        const data = await fetchLiveFeed(50)
        setEvents(data)
        setAggData(null)
      } else {
        const data = await fetchLiveFeedAggregated(timeRange)
        setAggData(data)
        setEvents([])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [timeRange])

  useEffect(() => {
    setLoading(true)
    loadEvents()
    if (timeRange === 'today') {
      const timer = setInterval(loadEvents, 30000)
      return () => clearInterval(timer)
    }
  }, [loadEvents, timeRange])

  const handleDismiss = async (e: React.MouseEvent, eventId: string) => {
    e.stopPropagation()
    try {
      await dismissEvent(eventId)
      setEvents(prev => prev.filter(ev => ev.id !== eventId))
    } catch { /* ignore */ }
  }

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Today view data ──
  const activeEvents = useMemo(() => events.filter(e => e.status !== 'dismissed'), [events])
  const stats = useMemo(() => ({
    running: activeEvents.filter(e => e.event_type === 'workflow_running').length,
    completed: activeEvents.filter(e => e.event_type === 'workflow_completed').length,
    approval: activeEvents.filter(e => e.event_type === 'approval_needed').length,
  }), [activeEvents])
  const filteredEvents = useMemo(
    () => activeEvents.filter(e => matchesFilter(e, activeFilter)),
    [activeEvents, activeFilter],
  )
  const grouped = useMemo(() => {
    const groups: Record<string, LiveFeedEvent[]> = { today: [], yesterday: [], earlier: [] }
    for (const e of filteredEvents) groups[getDateGroup(e.created_at)].push(e)
    return groups
  }, [filteredEvents])

  const showFollowups = activeFilter === 'followup' || activeFilter === 'all'
  const isFollowupOnly = activeFilter === 'followup'
  const totalCount = activeEvents.length + activeFollowUps.length

  const RANGE_LABEL: Record<TimeRange, string> = {
    today: '工作动态', week: '本周动态', month: '本月动态',
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1 rounded-md bg-info/10">
          <Activity size={14} className="text-info" />
        </div>
        <h3 className="text-sm font-semibold text-text">{RANGE_LABEL[timeRange]}</h3>
        <FeatureTip
          sections={[
            { title: '这是什么', items: [
              timeRange === 'today'
                ? '系统事件时间线 — 工作流执行结果、审批状态变更、跟进事项进展全部汇聚于此'
                : timeRange === 'week'
                ? '本周系统事件按天统计，快速了解每天的产出节奏'
                : '本月系统事件按周汇总，适合复盘和趋势分析',
              '与「今日聚焦」互补：聚焦管你的待办和日程，动态管系统发生了什么',
            ]},
          ]}
          smartNote="你在聊天中提到的待办、跟进承诺，AI 会自动识别并记录到动态流。"
        />
        {timeRange === 'today' && totalCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-info/10 text-info font-medium ml-auto">
            {totalCount}
          </span>
        )}
        {timeRange !== 'today' && aggData && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-info/10 text-info font-medium ml-auto">
            {Object.values(aggData.totals).reduce((a, b) => a + b, 0)} 条
          </span>
        )}
      </div>

      {/* Today view: summary stats + filter tabs */}
      {timeRange === 'today' && (
        <>
          {(stats.running > 0 || stats.completed > 0 || stats.approval > 0) && (
            <div className="flex items-center gap-3 mb-3 px-1">
              {stats.running > 0 && (
                <span className="text-[10px] text-info flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin" /> {stats.running} 进行中
                </span>
              )}
              {stats.completed > 0 && (
                <span className="text-[10px] text-success flex items-center gap-1">
                  <CheckCircle2 size={10} /> {stats.completed} 已完成
                </span>
              )}
              {stats.approval > 0 && (
                <span className="text-[10px] text-warning flex items-center gap-1">
                  <Clock size={10} /> {stats.approval} 待审批
                </span>
              )}
            </div>
          )}
          <div className="flex gap-1 mb-3">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${
                  activeFilter === tab.key
                    ? 'bg-accent/10 text-accent border border-accent/30'
                    : 'text-text-muted hover:text-text hover:bg-bg border border-transparent'
                }`}
              >
                {tab.label}
                {tab.key === 'followup' && activeFollowUps.length > 0 && (
                  <span className="ml-1 text-[9px]">({activeFollowUps.length})</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center py-8">
          <Loader2 size={18} className="animate-spin text-text-muted" />
        </div>
      ) : timeRange === 'today' ? (
        /* ── Today: real-time event stream ── */
        (isFollowupOnly ? activeFollowUps.length === 0 : filteredEvents.length === 0 && (!showFollowups || activeFollowUps.length === 0)) ? (
          <EmptyState message="暂无活动记录" sub="运行工作流、处理审批后，活动会在这里实时更新" />
        ) : (
          <div className="flex-1 overflow-y-auto min-h-0">
            {showFollowups && activeFollowUps.length > 0 && (
              <div className="mb-3">
                {!isFollowupOnly && (
                  <p className="text-[10px] text-text-muted font-medium px-1 mb-1.5 flex items-center gap-1">
                    <Users size={10} /> 跟进事项
                  </p>
                )}
                <div className="space-y-1">
                  {activeFollowUps.map(fu => (
                    <FollowUpCard key={fu.id} followUp={fu} onToggleDone={() => toggleFollowUp(fu.id, !fu.done)} />
                  ))}
                </div>
              </div>
            )}
            {!isFollowupOnly && (['today', 'yesterday', 'earlier'] as const).map(group => {
              const items = grouped[group]
              if (items.length === 0) return null
              const isEarlier = group === 'earlier'
              const displayItems = isEarlier ? items.slice(0, earlierVisible) : items
              return (
                <div key={group} className="mb-3">
                  <p className="text-[10px] text-text-muted font-medium px-1 mb-1.5">
                    {DATE_GROUP_LABELS[group]}{isEarlier && items.length > 0 ? ` (${items.length})` : ''}
                  </p>
                  <div className="space-y-1">
                    {displayItems.map(event => (
                      <EventRow key={event.id} event={event} isExpanded={expandedIds.has(event.id)}
                        onToggleExpand={() => toggleExpand(event.id)} onDismiss={handleDismiss}
                        onNavigate={navigate}
                        showDate={isEarlier} />
                    ))}
                  </div>
                  {isEarlier && items.length > earlierVisible && (
                    <button
                      onClick={() => setEarlierVisible(v => v + 6)}
                      className="w-full mt-1.5 py-1.5 text-[11px] text-accent hover:text-accent/80
                        bg-bg-secondary/50 rounded-md transition-colors"
                    >
                      加载更多 ({items.length - earlierVisible} 条)
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )
      ) : (
        /* ── Week / Month: aggregated view ── */
        !aggData || aggData.groups.length === 0 ? (
          <EmptyState
            message={timeRange === 'week' ? '本周暂无工作记录' : '本月暂无工作记录'}
            sub="开始使用工作流和对话后，统计数据会自动生成"
          />
        ) : (
          <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
            {/* Summary bar */}
            <div className="flex items-center gap-3 px-1 mb-1">
              {Object.entries(aggData.totals).map(([type, count]) => {
                const cfg = EVENT_CONFIG[type]
                return cfg ? (
                  <span key={type} className={`text-[10px] ${cfg.color} flex items-center gap-1`}>
                    <cfg.icon size={10} /> {count} {EVENT_TYPE_LABELS[type] || type}
                  </span>
                ) : null
              })}
            </div>

            {/* Group cards */}
            {aggData.groups.map((group, idx) => (
              <AggregateCard
                key={idx}
                group={group}
                timeRange={timeRange}
                events={aggData.events}
                expandedIds={expandedIds}
                onToggleExpand={toggleExpand}
              />
            ))}
          </div>
        )
      )}
    </div>
  )
}

/* ── Aggregate Card (Week/Month) ──────────────────────────── */

function AggregateCard({ group, timeRange, events, expandedIds, onToggleExpand }: {
  group: AggregatedGroup
  timeRange: 'week' | 'month'
  events: LiveFeedEvent[]
  expandedIds: Set<string>
  onToggleExpand: (id: string) => void
}) {
  const cardId = `agg-${group.date || group.week}`
  const isExpanded = expandedIds.has(cardId)
  const label = timeRange === 'week'
    ? formatWeekday(group.date || '')
    : (group.label || `第 ${group.week} 周`)

  // Filter events for this group by actual date range
  const groupEvents = useMemo(() => {
    if (!isExpanded) return []
    if (timeRange === 'week' && group.date) {
      return events.filter(e => e.created_at.startsWith(group.date!))
    }
    // Month view: filter by date_from ~ date_to
    if (group.date_from && group.date_to) {
      return events.filter(e => {
        const d = e.created_at.slice(0, 10) // "YYYY-MM-DD"
        return d >= group.date_from! && d <= group.date_to!
      })
    }
    return []
  }, [isExpanded, events, group, timeRange])

  return (
    <div className="rounded-lg border border-border bg-bg hover:bg-surface-hover transition-colors">
      <button
        onClick={() => onToggleExpand(cardId)}
        className="w-full flex items-center gap-3 px-3 py-2.5"
      >
        {isExpanded ? <ChevronDown size={11} className="text-text-muted" /> : <ChevronRight size={11} className="text-text-muted" />}
        <span className="text-xs font-medium text-text">{label}</span>

        {/* Type breakdown pills */}
        <div className="flex items-center gap-1.5 ml-auto">
          {Object.entries(group.by_type).map(([type, count]) => {
            const cfg = EVENT_CONFIG[type]
            if (!cfg || count === 0) return null
            return (
              <span key={type} className={`text-[9px] px-1.5 py-0.5 rounded-full ${cfg.color} bg-surface font-medium`}>
                {count} {EVENT_TYPE_LABELS[type] || type}
              </span>
            )
          })}
          {group.total === 0 && (
            <span className="text-[9px] text-text-muted">无记录</span>
          )}
        </div>

        {group.total > 0 && (
          <div className="flex items-center gap-1">
            <BarChart3 size={10} className="text-text-muted" />
            <span className="text-[10px] font-medium text-text-secondary">{group.total}</span>
          </div>
        )}
      </button>

      {/* Expanded: show events for this group */}
      {isExpanded && groupEvents.length > 0 && (
        <div className="px-3 pb-2.5 space-y-1">
          {groupEvents.map(event => {
            const config = EVENT_CONFIG[event.event_type] || EVENT_CONFIG.schedule
            const Icon = config.icon
            return (
              <div key={event.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface transition-colors">
                <div className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
                <Icon size={11} className={config.color} />
                <span className="text-[10px] text-text-muted shrink-0">{formatTime(event.created_at)}</span>
                <span className="text-[11px] text-text truncate flex-1">{event.title}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Empty State ──────────────────────────────────────────── */

function EmptyState({ message, sub }: { message: string; sub: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-8 text-text-muted">
      <Activity size={28} className="mb-2 opacity-20" />
      <p className="text-xs">{message}</p>
      <p className="text-[10px] mt-1">{sub}</p>
    </div>
  )
}

/* ── Event Row (Today view) ───────────────────────────────── */

function EventRow({
  event, isExpanded, onToggleExpand, onDismiss, onNavigate, showDate = false,
}: {
  event: LiveFeedEvent
  isExpanded: boolean
  onToggleExpand: () => void
  onDismiss: (e: React.MouseEvent, id: string) => void
  onNavigate?: (path: string) => void
  showDate?: boolean
}) {
  const config = EVENT_CONFIG[event.event_type] || EVENT_CONFIG.schedule
  const Icon = config.icon
  const isRunning = event.event_type === 'workflow_running'
  const needsAction = event.event_type === 'approval_needed'

  return (
    <div className={`group rounded-lg border transition-all ${
      needsAction ? 'border-warning/30 bg-warning/5 hover:border-warning/50' : 'border-border bg-bg hover:bg-surface-hover'
    }`}>
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dotColor} ${isRunning ? 'animate-pulse' : ''}`} />
        <Icon size={13} className={`shrink-0 ${config.color} ${isRunning ? 'animate-spin' : ''}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-text-muted shrink-0">{formatTime(event.created_at, showDate)}</span>
            <span className="text-xs text-text truncate font-medium">{event.title}</span>
          </div>
          {event.summary && !isExpanded && (
            <p className="text-[10px] text-text-muted truncate mt-0.5">{event.summary}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {event.context_data && Object.keys(event.context_data).length > 0 && (
            <button onClick={e => { e.stopPropagation(); onToggleExpand() }} className="p-1 rounded hover:bg-surface-hover text-text-muted">
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          )}
          <button onClick={e => onDismiss(e, event.id)} className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-danger">
            <X size={11} />
          </button>
        </div>
      </div>
      {isExpanded && event.summary && (
        <div className="px-3 pb-2.5 pt-0">
          <p className="text-[11px] text-text-secondary leading-relaxed pl-6">{event.summary}</p>
          {needsAction && (
            <div className="flex gap-1.5 mt-2 pl-6">
              <button
                onClick={(e) => { e.stopPropagation(); onNavigate?.(`/workflows`) }}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-md bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors"
              >
                <Eye size={10} /> 前往处理
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Follow-up Card ──────────────────────────────────────── */

function FollowUpCard({ followUp, onToggleDone }: {
  followUp: { id: string; text: string; direction: string; person: string; due_date: string; done: boolean }
  onToggleDone: () => void
}) {
  const isOverdue = followUp.due_date && new Date(followUp.due_date) < new Date()
  const isWaitingMe = followUp.direction === 'waiting_me'

  const formatDueDate = (d: string) => {
    try {
      const date = new Date(d)
      const today = new Date()
      const diff = Math.ceil((date.getTime() - today.getTime()) / 86400000)
      if (diff === 0) return '今天'
      if (diff === 1) return '明天'
      if (diff < 0) return `逾期 ${Math.abs(diff)} 天`
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
    } catch { return d }
  }

  return (
    <div className={`group rounded-lg border p-2.5 transition-all ${
      isOverdue ? 'border-danger/30 bg-danger/5' : 'border-border bg-bg hover:bg-surface-hover'
    }`}>
      <div className="flex items-start gap-2">
        <button onClick={onToggleDone} className="mt-0.5 shrink-0">
          <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-colors ${
            followUp.done ? 'bg-success border-success' : 'border-border hover:border-accent'
          }`}>
            {followUp.done && <CheckCircle2 size={8} className="text-white" />}
          </div>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-text truncate">{followUp.text}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
              isWaitingMe ? 'bg-warning/10 text-warning' : 'bg-info/10 text-info'
            }`}>
              {isWaitingMe ? <UserCheck size={8} /> : <Users size={8} />}
              {isWaitingMe ? '等我处理' : '等对方'}
            </span>
            {followUp.person && <span className="text-[9px] text-text-muted">@{followUp.person}</span>}
            {followUp.due_date && (
              <span className={`text-[9px] ${isOverdue ? 'text-danger font-medium' : 'text-text-muted'}`}>
                {formatDueDate(followUp.due_date)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
