/**
 * 聚焦面板 — 支持今日/本周/本月三种视角
 *
 * 今日：AI 根据待办+日程+工作流状态自动生成的行动清单
 * 本周：本周进行中的跟进+工作项+截止事项
 * 本月：月度全量跟进+工作项进度
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Target, AlertCircle, Clock, CheckCircle2,
  Sparkles, Loader2, Users, Briefcase,
} from 'lucide-react'
import { fetchFocusItems } from '../../api/workstation'
import type { FocusItem, TimeRange } from '../../types/workstation'
import { trackFocusClick } from '../../utils/signalTracker'
import FeatureTip from './FeatureTip'

const URGENCY_STYLES: Record<string, { dot: string; bg: string; border: string }> = {
  high: { dot: 'bg-danger', bg: 'bg-danger/5', border: 'border-danger/20' },
  mid: { dot: 'bg-warning', bg: 'bg-warning/5', border: 'border-warning/20' },
  low: { dot: 'bg-info/60', bg: 'bg-bg', border: 'border-border' },
}

const TYPE_ICONS: Record<string, typeof Target> = {
  action_needed: AlertCircle,
  priority: Target,
  schedule: Clock,
  followup: Users,
  work_item: Briefcase,
}

const RANGE_LABELS: Record<TimeRange, string> = {
  today: '今日聚焦',
  week: '本周看板',
  month: '本月追踪',
}

const RANGE_TIPS: Record<TimeRange, { title: string; items: string[] }[]> = {
  today: [
    { title: '这是什么', items: [
      '展示你今天需要关注的个人工作事项：待办优先级、今日日程、有风险的工作项',
      '按紧急程度排序，红色=紧急，黄色=重要，蓝色=常规',
      '工作流执行状态、审批等系统事件请查看「实时动态」面板',
    ]},
  ],
  week: [
    { title: '这是什么', items: [
      '展示本周进行中的跟进事项和工作项',
      '逾期项标红，本周到期项标黄，帮你把控周节奏',
    ]},
  ],
  month: [
    { title: '这是什么', items: [
      '月度视角：所有活跃的工作项和跟进事项',
      '适合月初规划和月末复盘',
    ]},
  ],
}

interface Props {
  timeRange: TimeRange
}

export default function TodayFocus({ timeRange }: Props) {
  const navigate = useNavigate()
  const [items, setItems] = useState<FocusItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchFocusItems(timeRange)
      .then(data => { if (!cancelled) setItems(data) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [timeRange])

  const handleAction = (item: FocusItem, action: string) => {
    if (action === 'ai_assist' || action === 'ai_prepare') {
      trackFocusClick(item.id, action)
      navigate('/chat', { state: { prefillPrompt: `帮我处理：${item.title}` } })
    }
  }

  const ACTION_LABELS: Record<string, { label: string; icon: typeof Sparkles }> = {
    ai_assist: { label: 'AI 协助', icon: Sparkles },
    ai_prepare: { label: 'AI 准备', icon: Sparkles },
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1 rounded-md bg-accent/10">
          <Target size={14} className="text-accent" />
        </div>
        <h3 className="text-sm font-semibold text-text">{RANGE_LABELS[timeRange]}</h3>
        <FeatureTip
          sections={RANGE_TIPS[timeRange]}
          smartNote="越多地与 AI 对话和记录工作，聚焦项会越精准。"
        />
        {items.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-medium ml-auto">
            {items.length} 项
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-8">
          <Loader2 size={18} className="animate-spin text-text-muted" />
          <span className="text-xs text-text-muted ml-2">
            {timeRange === 'today' ? '生成聚焦项...' : '加载中...'}
          </span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-8 text-text-muted">
          <CheckCircle2 size={28} className="mb-2 opacity-30" />
          <p className="text-xs">
            {timeRange === 'today' ? '暂无紧急事项，专注深度工作' :
             timeRange === 'week' ? '本周暂无待跟进事项' :
             '本月暂无活跃工作项'}
          </p>
        </div>
      ) : (
        <div className={`flex-1 overflow-y-auto max-h-[400px] ${
          items.length > 3
            ? 'grid grid-cols-2 xl:grid-cols-3 gap-2 auto-rows-min content-start'
            : 'space-y-2'
        }`}>
          {items.map(item => {
            const style = URGENCY_STYLES[item.urgency] || URGENCY_STYLES.low
            const Icon = TYPE_ICONS[item.type] || Target
            const validActions = item.actions.filter(a => a in ACTION_LABELS)
            const isGrid = items.length > 3
            return (
              <div
                key={item.id}
                className={`group rounded-lg border transition-all hover:shadow-sm ${style.bg} ${style.border} ${
                  isGrid ? 'p-2.5 flex flex-col' : 'p-3'
                }`}
              >
                <div className={isGrid ? '' : 'flex items-start gap-2.5'}>
                  <div className={isGrid ? '' : 'flex-1 min-w-0'}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
                      <Icon size={isGrid ? 11 : 12} className="text-text-muted shrink-0" />
                      <span className={`font-medium text-text truncate ${isGrid ? 'text-[11px]' : 'text-xs'}`}>
                        {item.title}
                      </span>
                    </div>
                    {item.summary && (
                      <p className={`text-text-muted leading-relaxed mt-0.5 ${
                        isGrid ? 'text-[10px] line-clamp-2' : 'text-[11px]'
                      }`}>
                        {item.summary}
                      </p>
                    )}
                    {validActions.length > 0 && (
                      <div className={`flex gap-1.5 ${isGrid ? 'mt-1.5' : 'mt-2'}`}>
                        {validActions.map(action => {
                          const act = ACTION_LABELS[action]
                          const ActIcon = act.icon
                          return (
                            <button
                              key={action}
                              onClick={() => handleAction(item, action)}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md bg-surface border border-border text-text-secondary hover:text-accent hover:border-accent/40 transition-colors"
                            >
                              <ActIcon size={10} />
                              {act.label}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
