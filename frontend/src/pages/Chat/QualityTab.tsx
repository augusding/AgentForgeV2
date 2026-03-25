import { useState, useEffect } from 'react'
import { fetchQualityStats, fetchQualityTrend, fetchInsights } from '../../api/analytics'
import type { QualityStats, QualityTrendEntry, Insight } from '../../api/analytics'
import { AlertTriangle, CheckCircle, Info, BookOpen, MessageSquare } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function ScoreRing({ score }: { score: number }) {
  const r = 36
  const c = 2 * Math.PI * r
  const offset = c - (score / 100) * c
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative w-24 h-24 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--color-border)" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={r} fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-text">{score}</span>
        <span className="text-[9px] text-text-muted">/ 100</span>
      </div>
    </div>
  )
}

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-0.5">
        <span className="text-text-secondary">{label}</span>
        <span className="font-mono text-text-muted">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(value * 100, 100)}%` }}
        />
      </div>
    </div>
  )
}

function TrendChart({ data }: { data: QualityTrendEntry[] }) {
  if (data.length === 0) return null
  const maxScore = Math.max(...data.map(d => d.score), 1)

  return (
    <div className="flex items-end gap-1.5 h-12">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <div
            className="w-full bg-accent/70 rounded-t transition-all duration-300"
            style={{ height: `${(d.score / maxScore) * 40}px` }}
            title={`W${d.week}: ${d.score}分`}
          />
          <span className="text-[8px] text-text-muted">W{d.week}</span>
        </div>
      ))}
    </div>
  )
}

const INSIGHT_ICONS = {
  warning: <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />,
  success: <CheckCircle size={14} className="text-success shrink-0 mt-0.5" />,
  info: <Info size={14} className="text-accent shrink-0 mt-0.5" />,
}

export default function QualityTab() {
  const [quality, setQuality] = useState<QualityStats | null>(null)
  const [trend, setTrend] = useState<QualityTrendEntry[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchQualityStats().catch(() => null),
      fetchQualityTrend().catch(() => []),
      fetchInsights().catch(() => []),
    ]).then(([q, t, ins]) => {
      if (cancelled) return
      setQuality(q)
      setTrend(t)
      setInsights(ins)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return <div className="p-4 text-xs text-text-muted text-center py-8">加载中...</div>
  }

  if (!quality) {
    return <div className="p-4 text-xs text-text-muted text-center py-8">暂无数据</div>
  }

  return (
    <div className="p-4 space-y-5">
      {/* Quality Score */}
      <section>
        <h4 className="text-[11px] font-medium text-text-muted uppercase tracking-wide mb-2 text-center">
          综合质量分
        </h4>
        <ScoreRing score={quality.quality_score} />
        <p className="text-[10px] text-text-muted text-center mt-1">
          基于最近 {quality.days} 天 {quality.total_completions} 次交互
        </p>
      </section>

      {/* Metric bars */}
      <section>
        <h4 className="text-[11px] font-medium text-text-muted uppercase tracking-wide mb-2">
          分项指标
        </h4>
        <div className="space-y-2.5">
          <MetricBar label="正面反馈率" value={quality.positive_rate} color="bg-emerald-500" />
          <MetricBar label="内容采纳率" value={quality.adoption_rate} color="bg-blue-500" />
          <MetricBar label="知识命中率" value={quality.knowledge_hit_rate} color="bg-amber-500" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
          <div className="bg-surface rounded py-1.5">
            <div className="text-xs font-bold text-text">{quality.feedback_up}</div>
            <div className="text-[9px] text-text-muted">正面</div>
          </div>
          <div className="bg-surface rounded py-1.5">
            <div className="text-xs font-bold text-text">{quality.copy_count}</div>
            <div className="text-[9px] text-text-muted">复制</div>
          </div>
          <div className="bg-surface rounded py-1.5">
            <div className="text-xs font-bold text-text">{quality.download_count}</div>
            <div className="text-[9px] text-text-muted">下载</div>
          </div>
        </div>
      </section>

      {/* Trend */}
      {trend.length > 0 && (
        <section>
          <h4 className="text-[11px] font-medium text-text-muted uppercase tracking-wide mb-2">
            质量趋势 (近 {trend.length} 周)
          </h4>
          <TrendChart data={trend} />
        </section>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <section>
          <h4 className="text-[11px] font-medium text-text-muted uppercase tracking-wide mb-2">
            改进建议
          </h4>
          <div className="space-y-2">
            {insights.map((ins, i) => (
              <div
                key={i}
                className={`flex gap-2 p-2.5 rounded-md border text-[11px] leading-relaxed ${
                  ins.type === 'warning' ? 'bg-warning/5 border-warning/20'
                    : ins.type === 'success' ? 'bg-success/5 border-success/20'
                    : 'bg-accent/5 border-accent/20'
                }`}
              >
                {INSIGHT_ICONS[ins.type]}
                <div className="min-w-0">
                  <div className="font-medium text-text mb-0.5">{ins.title}</div>
                  <div className="text-text-muted">{ins.detail}</div>
                  {ins.action === 'upload_knowledge' && (
                    <button
                      onClick={() => navigate('/knowledge')}
                      className="flex items-center gap-1 mt-1.5 text-accent hover:text-accent/80 font-medium"
                    >
                      <BookOpen size={11} /> 前往知识库
                    </button>
                  )}
                  {ins.action === 'review_prompts' && (
                    <button
                      onClick={() => navigate('/workstation')}
                      className="flex items-center gap-1 mt-1.5 text-accent hover:text-accent/80 font-medium"
                    >
                      <MessageSquare size={11} /> 查看岗位配置
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
