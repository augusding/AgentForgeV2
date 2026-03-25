/**
 * AI 洞察 V2 — 实时扫描雷达引擎
 *
 * 统一洞察流，覆盖四个层面：
 *   执行层 — 交付延期、依赖超时、负荷过载
 *   结果层 — 工作流失败、审批被拒
 *   业务层 — 指标偏离、多指标关联异常、超额达标
 *   指标层 — 趋势恶化/改善、知识盲区
 *
 * 不受全局时间筛选影响，始终聚焦当前正在发生或即将发生的事项。
 */
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2, ArrowUpRight, Lightbulb,
  ShieldAlert, TrendingUp, Zap, AlertTriangle,
  Briefcase, BarChart3, ChevronDown, ChevronRight,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import FeatureTip from './FeatureTip'
import { useInsightStore } from '../../stores/useInsightStore'
import type { UnifiedInsightItem } from '../../types/workstation'

/* ── Config ──────────────────────────────────────────────── */

type FilterTab = 'all' | 'risk' | 'opportunity'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',         label: '全部' },
  { key: 'risk',        label: '风险' },
  { key: 'opportunity', label: '机会' },
]

const LAYER_CONFIG: Record<string, { label: string; icon: LucideIcon; color: string; bg: string }> = {
  execution:  { label: '执行层', icon: Briefcase,   color: 'text-info',    bg: 'bg-info/10' },
  results:    { label: '结果层', icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
  business:   { label: '业务层', icon: BarChart3,    color: 'text-accent',  bg: 'bg-accent/10' },
  indicators: { label: '指标层', icon: TrendingUp,   color: 'text-success', bg: 'bg-success/10' },
}

const SEVERITY_CONFIG: Record<string, { dot: string; border: string; bg: string }> = {
  critical: { dot: 'bg-danger',      border: 'border-danger/30',  bg: 'bg-danger/5' },
  high:     { dot: 'bg-warning',     border: 'border-warning/30', bg: 'bg-warning/5' },
  medium:   { dot: 'bg-info/60',     border: 'border-border',     bg: 'bg-bg' },
  low:      { dot: 'bg-text-muted/40', border: 'border-border',   bg: 'bg-bg' },
}

interface Props {
  positionName: string
  positionId: string
  personality: string
}

/* ── Main Component ──────────────────────────────────────── */

export default function WorkstationAssistant({ positionName }: Props) {
  const navigate = useNavigate()
  const { items, counts, loading, load, startBackgroundRefresh } = useInsightStore()
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    load()
    const cleanup = startBackgroundRefresh()
    return cleanup
  }, [load, startBackgroundRefresh])

  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return items
    return items.filter(item => item.insight_type === activeFilter)
  }, [items, activeFilter])

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const riskCount = counts.risk
  const oppCount = counts.opportunity

  return (
    <div className="bg-surface border border-border rounded-xl flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-accent/10 relative">
            <Lightbulb size={14} className="text-accent" />
            {riskCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-danger animate-pulse" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1">
              <h3 className="text-sm font-semibold text-text">AI 洞察</h3>
              <FeatureTip
                sections={[
                  { title: '这是什么', items: [
                    '实时扫描雷达 — 综合分析待办、工作项、工作流、指标等数据，发现潜在风险和机会',
                    '覆盖执行层、结果层、业务层、指标层四个维度',
                    '不受时间筛选影响，始终保持实时监控状态',
                  ]},
                  { title: '执行层', items: [
                    '交付风险 — 工作项逾期、进度滞后、阻塞状态检测',
                    '依赖风险 — 等待他人响应超时、跟进事项逾期',
                    '负荷风险 — 高优任务堆积、待办过载预警',
                    '准备风险 — 会议/汇报临近但无相关准备活动',
                  ]},
                  { title: '结果层', items: [
                    '流程风险 — 工作流执行失败、审批被拒',
                  ]},
                  { title: '业务层', items: [
                    '指标偏离 — 业务指标偏离目标值，按偏离程度分级',
                    '复合风险 — 多个指标同时异常，可能存在共同根因',
                    '超额达标 — 指标超过目标 10% 以上，发现可放大的机会',
                    'AI 综合分析 — 当风险 ≥3 项时 AI 做跨维度关联推理',
                  ]},
                  { title: '指标层', items: [
                    '趋势恶化 — 指标连续 3+ 天同向下滑',
                    '趋势向好 — 指标连续 3+ 天持续改善（机会信号）',
                    '知识盲区 — 反复提问但系统无法提供满意答案的领域',
                  ]},
                  { title: '数据来源', items: [
                    '系统自动采集 — 工作流事件、审批记录、对话信号',
                    '对话提取 — AI 自动识别对话中提到的业务指标数值',
                    '外部数据源 — 在知识库「数据源」中添加 API/数据库连接，自动采集业务指标',
                    '手动录入 — 通过工位工具或对话主动记录',
                  ]},
                ]}
                smartNote="AI 洞察会随着数据积累不断进化 — 更多的业务信号输入意味着更精准的风险预警和机会发现。每条洞察都包含严重度、建议操作和数据佐证。"
              />
            </div>
            <p className="text-[10px] text-text-muted">{positionName}</p>
          </div>
        </div>
        {(riskCount > 0 || oppCount > 0) && (
          <div className="flex items-center gap-1.5">
            {riskCount > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-danger/10 text-danger font-medium">
                {riskCount} 风险
              </span>
            )}
            {oppCount > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-success/10 text-success font-medium">
                {oppCount} 机会
              </span>
            )}
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 pt-3 pb-2 shrink-0">
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
            {tab.key === 'risk' && riskCount > 0 && (
              <span className="ml-1 text-[9px]">({riskCount})</span>
            )}
            {tab.key === 'opportunity' && oppCount > 0 && (
              <span className="ml-1 text-[9px]">({oppCount})</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 pb-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={18} className="animate-spin text-text-muted" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-text-muted">
            <Lightbulb size={32} className="mb-3 opacity-15" />
            <p className="text-xs">
              {activeFilter === 'all' ? '暂无洞察，AI 雷达待命中' :
               activeFilter === 'risk' ? '当前无风险项' : '暂未发现机会'}
            </p>
            <p className="text-[10px] mt-1">产生工作数据后，洞察会自动呈现</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredItems.map(item => (
              <InsightCard
                key={item.id}
                item={item}
                isExpanded={expandedIds.has(item.id)}
                onToggleExpand={() => toggleExpand(item.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border shrink-0 flex items-center gap-2">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
        </span>
        <span className="text-[10px] text-text-muted">实时更新 · 30s</span>
        <button
          onClick={() => navigate('/chat')}
          className="ml-auto flex items-center gap-1 text-[10px] text-text-muted hover:text-accent transition-colors"
        >
          AI 对话 <ArrowUpRight size={10} />
        </button>
      </div>
    </div>
  )
}

/* ── InsightCard ──────────────────────────────────────────── */

function InsightCard({
  item, isExpanded, onToggleExpand,
}: {
  item: UnifiedInsightItem
  isExpanded: boolean
  onToggleExpand: () => void
}) {
  const layer = LAYER_CONFIG[item.layer] || LAYER_CONFIG.business
  const severity = SEVERITY_CONFIG[item.severity] || SEVERITY_CONFIG.medium
  const LayerIcon = layer.icon
  const isOpportunity = item.insight_type === 'opportunity'

  return (
    <div
      className={`group rounded-lg border transition-all hover:shadow-sm cursor-pointer ${severity.bg} ${severity.border}`}
      onClick={onToggleExpand}
    >
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        {/* Severity dot */}
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${
          isOpportunity ? 'bg-success' : severity.dot
        }`} />

        <div className="flex-1 min-w-0">
          {/* Layer tag + title */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-medium ${layer.bg} ${layer.color}`}>
              <LayerIcon size={8} />
              {layer.label}
            </span>
            {isOpportunity && (
              <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-success/10 text-success">
                <TrendingUp size={8} />
                机会
              </span>
            )}
          </div>

          {/* Title */}
          <p className="text-xs font-medium text-text mt-1">{item.title}</p>

          {/* Detail */}
          <p className="text-[10px] text-text-muted leading-relaxed mt-0.5">
            {item.detail}
          </p>

          {/* Suggested action — always visible */}
          {item.suggested_action && (
            <div className="flex items-start gap-1.5 mt-1.5">
              <Sparkles size={10} className="text-accent mt-0.5 shrink-0" />
              <p className="text-[10px] text-accent leading-relaxed">{item.suggested_action}</p>
            </div>
          )}

          {/* Data evidence — expanded on click */}
          {isExpanded && (
            <div className="mt-2 space-y-1.5">
              {item.data_evidence && Object.keys(item.data_evidence).length > 0 && (
                <div className="px-2 py-1.5 rounded-md bg-surface border border-border">
                  <p className="text-[9px] text-text-muted font-medium mb-1">数据佐证</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(item.data_evidence).map(([k, v]) => (
                      <span key={k} className="text-[9px] text-text-secondary">
                        {k}: <span className="font-medium text-text">{String(v)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Expand indicator */}
        <div className="shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isExpanded
            ? <ChevronDown size={12} className="text-text-muted" />
            : <ChevronRight size={12} className="text-text-muted" />
          }
        </div>
      </div>
    </div>
  )
}
