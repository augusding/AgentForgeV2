import { useState, useEffect, useRef } from 'react'
import { fetchDailyUsage, fetchWeeklyUsage, fetchQualityStats, fetchQualityTrend, fetchInsights } from '../../api/analytics'
import { formatTokenCount } from '../../utils/formatToken'
import { AlertTriangle, CheckCircle, Info, TrendingUp, Zap, Target, BookOpen } from 'lucide-react'
import type { DailyUsage, WeeklyEntry, QualityStats, QualityTrendEntry, Insight } from '../../api/analytics'

const CAP_LABELS: Record<string, string> = {
  knowledge_retrieval: '知识检索',
  content_generation: '内容生成',
  data_analysis: '数据分析',
  tool_invocation: '工具调用',
  chat: '闲聊/澄清',
}

const CAP_COLORS: Record<string, string> = {
  knowledge_retrieval: '#3b82f6',
  content_generation: '#10b981',
  data_analysis: '#f59e0b',
  tool_invocation: '#8b5cf6',
  chat: '#9ca3af',
}

export default function AIEfficiency() {
  const [daily, setDaily] = useState<DailyUsage | null>(null)
  const [weekly, setWeekly] = useState<WeeklyEntry[]>([])
  const [quality, setQuality] = useState<QualityStats | null>(null)
  const [trend, setTrend] = useState<QualityTrendEntry[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetchDailyUsage().catch(() => null),
      fetchWeeklyUsage().catch(() => []),
      fetchQualityStats().catch(() => null),
      fetchQualityTrend().catch(() => []),
      fetchInsights().catch(() => []),
    ]).then(([d, w, q, t, ins]) => {
      setDaily(d)
      setWeekly(w)
      setQuality(q)
      setTrend(t)
      setInsights(ins)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-lg p-6">
        <h3 className="text-sm font-semibold text-text mb-4 flex items-center gap-2">
          <Target size={16} className="text-accent" /> AI 效能分析
        </h3>
        <div className="text-xs text-text-muted text-center py-8">加载中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Row 1: Usage Overview + Capability Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Usage */}
        <div className="bg-surface border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-text mb-4 flex items-center gap-2">
            <Zap size={16} className="text-accent" /> 今日用量
          </h3>
          {daily ? (
            <div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-accent font-mono">{formatTokenCount(daily.total_tokens)}</div>
                  <div className="text-[10px] text-text-muted">总 Token</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-text font-mono">{daily.total_sessions}</div>
                  <div className="text-[10px] text-text-muted">对话数</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-text font-mono">{daily.total_messages}</div>
                  <div className="text-[10px] text-text-muted">AI 回复</div>
                </div>
              </div>

              {/* Capability bars */}
              {Object.keys(daily.by_capability).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[11px] font-medium text-text-muted uppercase tracking-wide">能力分布</h4>
                  {Object.entries(daily.by_capability)
                    .sort((a, b) => b[1].tokens - a[1].tokens)
                    .map(([cap, info]) => {
                      const pct = daily.total_tokens > 0 ? (info.tokens / daily.total_tokens) * 100 : 0
                      return (
                        <div key={cap}>
                          <div className="flex items-center justify-between text-xs mb-0.5">
                            <span className="text-text-secondary">{CAP_LABELS[cap] || cap}</span>
                            <span className="text-text-muted font-mono">
                              {formatTokenCount(info.tokens)} · {info.count}次
                            </span>
                          </div>
                          <div className="h-2 bg-border rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: CAP_COLORS[cap] || '#6b7280' }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-text-muted text-center py-4">暂无数据</p>
          )}
        </div>

        {/* Weekly Token Trend */}
        <div className="bg-surface border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-text mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-accent" /> 7天用量趋势
          </h3>
          {weekly.length > 0 ? (
            <div>
              <WeeklyLineChart data={weekly} />
            </div>
          ) : (
            <p className="text-xs text-text-muted text-center py-4">积累中...</p>
          )}
        </div>
      </div>

      {/* Row 2: Quality + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quality Stats */}
        <div className="bg-surface border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-text mb-4 flex items-center gap-2">
            <Target size={16} className="text-accent" /> 质量指标
          </h3>
          {quality ? (
            <div>
              {/* Score + trend */}
              <div className="flex items-center gap-6 mb-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-text">{quality.quality_score}</div>
                  <div className="text-[10px] text-text-muted">综合质量分 /100</div>
                </div>
                {trend.length > 0 && (
                  <div className="flex-1">
                    <div className="flex items-end gap-1 h-12">
                      {trend.map((t, i) => {
                        const max = Math.max(...trend.map(x => x.score), 1)
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                            <div
                              className="w-full bg-accent/60 rounded-t"
                              style={{ height: `${(t.score / max) * 40}px` }}
                            />
                            <span className="text-[8px] text-text-muted">W{t.week}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Metric grid */}
              <div className="grid grid-cols-2 gap-3">
                <MetricItem label="正面反馈率" value={`${Math.round(quality.positive_rate * 100)}%`} sub={`${quality.feedback_up}/${quality.feedback_up + quality.feedback_down}`} />
                <MetricItem label="内容采纳率" value={`${Math.round(quality.adoption_rate * 100)}%`} sub={`${quality.copy_count} 次复制`} />
                <MetricItem label="知识命中率" value={`${Math.round(quality.knowledge_hit_rate * 100)}%`} sub={`${quality.rag_queries} 次检索`} />
                <MetricItem label="总 AI 交互" value={String(quality.total_completions)} sub={`近 ${quality.days} 天`} />
              </div>
            </div>
          ) : (
            <p className="text-xs text-text-muted text-center py-4">暂无数据</p>
          )}
        </div>

        {/* Insights */}
        <div className="bg-surface border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-text mb-4 flex items-center gap-2">
            <BookOpen size={16} className="text-accent" /> 效能洞察
          </h3>
          {insights.length > 0 ? (
            <div className="space-y-3">
              {insights.map((ins, i) => (
                <div
                  key={i}
                  className={`flex gap-2.5 p-3 rounded-md border text-xs leading-relaxed ${
                    ins.type === 'warning' ? 'bg-warning/5 border-warning/20'
                      : ins.type === 'success' ? 'bg-success/5 border-success/20'
                      : 'bg-accent/5 border-accent/20'
                  }`}
                >
                  {ins.type === 'warning' ? <AlertTriangle size={15} className="text-warning shrink-0 mt-0.5" />
                    : ins.type === 'success' ? <CheckCircle size={15} className="text-success shrink-0 mt-0.5" />
                    : <Info size={15} className="text-accent shrink-0 mt-0.5" />}
                  <div>
                    <div className="font-medium text-text mb-0.5">{ins.title}</div>
                    <div className="text-text-muted">{ins.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted text-center py-4">暂无洞察，继续使用后将自动生成</p>
          )}
        </div>
      </div>
    </div>
  )
}

function WeeklyLineChart({ data }: { data: WeeklyEntry[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  // Ensure 7 days: pad missing leading days with 0
  const padded: WeeklyEntry[] = (() => {
    if (data.length >= 7) return data.slice(-7)
    const last = data.length > 0 ? data[data.length - 1].date : new Date().toISOString().slice(0, 10)
    const end = new Date(last)
    const result: WeeklyEntry[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(end)
      d.setDate(d.getDate() - i)
      const ds = d.toISOString().slice(0, 10)
      const existing = data.find(x => x.date === ds)
      result.push(existing || { date: ds, tokens: 0, count: 0 })
    }
    return result
  })()

  const padL = 6
  const padR = 6
  const padT = 28
  const padB = 20
  const H = 160
  const chartW = width - padL - padR
  const chartH = H - padT - padB

  const maxTokens = Math.max(...padded.map(d => d.tokens), 1)
  const yMax = Math.ceil(maxTokens * 1.15)

  const points = padded.map((d, i) => ({
    x: padL + (padded.length > 1 ? (i / (padded.length - 1)) * chartW : chartW / 2),
    y: padT + chartH - (d.tokens / yMax) * chartH,
    tokens: d.tokens,
    date: d.date.slice(5),
  }))

  const yBottom = padT + chartH
  // Smooth curve using cubic bezier, clamped to chart bounds
  const smoothPath = (pts: typeof points) => {
    if (pts.length < 2) return ''
    const clampY = (v: number) => Math.min(Math.max(v, padT), yBottom)
    let d = `M${pts[0].x},${pts[0].y}`
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = pts[Math.min(i + 2, pts.length - 1)]
      const tension = 0.3
      const cp1x = p1.x + (p2.x - p0.x) * tension
      const cp1y = clampY(p1.y + (p2.y - p0.y) * tension)
      const cp2x = p2.x - (p3.x - p1.x) * tension
      const cp2y = clampY(p2.y - (p3.y - p1.y) * tension)
      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
    }
    return d
  }

  const linePath = smoothPath(points)
  const areaPath = linePath
    ? `${linePath} L${points[points.length - 1].x},${padT + chartH} L${points[0].x},${padT + chartH} Z`
    : ''

  return (
    <div ref={containerRef} className="w-full">
      {width > 0 && (
        <svg width={width} height={H} className="block">
          <defs>
            <linearGradient id="weeklyAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent, #06b6d4)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--color-accent, #06b6d4)" stopOpacity={0} />
            </linearGradient>
          </defs>
          {/* Horizontal grid lines */}
          {[0, 0.5, 1].map((ratio, i) => {
            const y = padT + chartH * (1 - ratio)
            return <line key={i} x1={padL} y1={y} x2={width - padR} y2={y} stroke="currentColor" className="text-border" strokeWidth={0.5} opacity={0.4} />
          })}
          {/* Area */}
          <path d={areaPath} fill="url(#weeklyAreaGrad)" />
          {/* Line */}
          <path d={linePath} fill="none" stroke="var(--color-accent, #06b6d4)" strokeWidth={2} strokeLinecap="round" />
          {/* Points, values, dates */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={3} fill="var(--color-accent, #06b6d4)" />
              {p.tokens > 0 && (
                <text x={p.x} y={p.y - 10} textAnchor="middle" className="fill-text-secondary" fontSize={10} fontFamily="monospace">
                  {formatTokenCount(p.tokens)}
                </text>
              )}
              <text x={p.x} y={H - 4} textAnchor="middle" className="fill-text-muted" fontSize={10}>
                {p.date}
              </text>
            </g>
          ))}
        </svg>
      )}
    </div>
  )
}

function MetricItem({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-bg rounded-md px-3 py-2">
      <div className="text-[10px] text-text-muted mb-0.5">{label}</div>
      <div className="text-sm font-bold text-text">{value}</div>
      <div className="text-[9px] text-text-muted">{sub}</div>
    </div>
  )
}
