import { useState, useEffect, useCallback } from 'react'
import { BarChart3, Loader2, TrendingUp, MessageSquare, Zap, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import client from '../../api/client'

export default function UsageTab(_props: { isAdmin?: boolean }) {
  const [stats, setStats] = useState<any>(null)
  const [models, setModels] = useState<any[]>([])
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const [daily, health, weekly, m] = await Promise.all([
        client.get('/analytics/daily').catch(() => ({})),
        client.get('/health').catch(() => ({})),
        client.get('/analytics/weekly').catch(() => []),
        client.get('/metrics').catch(() => null),
      ])
      setStats({ ...(health as any), ...(daily as any) })
      if (Array.isArray(weekly)) setModels(weekly)
      setMetrics(m)
    } catch {}
    setLoading(false); setRefreshing(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { const t = setInterval(() => loadData(), 30000); return () => clearInterval(t) }, [loadData])

  if (loading) return <div className="text-center py-8"><Loader2 className="animate-spin mx-auto" size={20} style={{ color: 'var(--accent)' }} /></div>

  const cards = [
    { label: '今日对话', value: stats?.total_sessions || 0, icon: MessageSquare, color: '#3b82f6' },
    { label: '今日消息', value: stats?.total_messages || 0, icon: TrendingUp, color: '#22c55e' },
    { label: 'Token 用量', value: stats?.total_tokens || 0, icon: BarChart3, color: '#a855f7', fmt: true },
    { label: '工作流', value: stats?.workflow_count || 0, icon: Zap, color: '#f59e0b' },
  ]

  const errRate = metrics?.error_rate_1h || 0
  const toolSucc = metrics?.tool_success_rate_1h ?? 1
  const fu = metrics?.feedback_up_24h || 0
  const fd = metrics?.feedback_down_24h || 0
  const satisfaction = fu + fd > 0 ? fu / (fu + fd) : null

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={() => loadData(true)} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg"
          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }} disabled={refreshing}>
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> {refreshing ? '刷新中...' : '刷新'}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {cards.map(c => {
          const Icon = c.icon
          const v = c.fmt && c.value > 10000 ? `${(c.value / 1000).toFixed(1)}K` : String(c.value)
          return (
            <div key={c.label} className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-2"><Icon size={14} style={{ color: c.color }} />
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{c.label}</span></div>
              <div className="text-xl font-bold" style={{ color: c.color }}>{v}</div>
            </div>
          )
        })}
      </div>

      {metrics && (
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">实时指标
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--accent)', color: '#fff' }}>1h</span></h3>
          <div className="grid grid-cols-3 gap-3">
            <MM label="请求数" value={metrics.requests_total_1h || 0} unit="次" />
            <MM label="错误率" value={`${(errRate * 100).toFixed(1)}%`}
              color={errRate > 0.05 ? '#ef4444' : errRate > 0.01 ? '#f59e0b' : '#22c55e'} />
            <MM label="LLM 调用" value={metrics.llm_calls_total_1h || 0} unit="次" />
            <MM label="LLM P95" value={metrics.llm_latency_1h?.p95 || 0} unit="s"
              color={(metrics.llm_latency_1h?.p95 || 0) > 5 ? '#ef4444' : '#22c55e'} />
            <MM label="首Token P95" value={metrics.llm_ttft_1h?.p95 || 0} unit="s" />
            <MM label="降级" value={metrics.llm_fallbacks_1h || 0}
              color={(metrics.llm_fallbacks_1h || 0) > 0 ? '#f59e0b' : '#22c55e'} />
            <MM label="工具调用" value={metrics.tool_calls_total_1h || 0} unit="次" />
            <MM label="工具成功率" value={`${(toolSucc * 100).toFixed(0)}%`}
              color={toolSucc < 0.85 ? '#ef4444' : '#22c55e'} />
            <MM label="护栏拦截" value={metrics.guardrail_blocks_1h || 0} />
          </div>
        </div>
      )}

      {satisfaction !== null && (
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <h3 className="text-sm font-medium mb-3">用户满意度（24h）</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5"><CheckCircle size={14} style={{ color: '#22c55e' }} /><span className="text-sm font-medium">{fu}</span></div>
            <div className="flex items-center gap-1.5"><XCircle size={14} style={{ color: '#ef4444' }} /><span className="text-sm font-medium">{fd}</span></div>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{
              background: satisfaction > 0.7 ? '#dcfce7' : satisfaction > 0.5 ? '#fef3c7' : '#fee2e2',
              color: satisfaction > 0.7 ? '#166534' : satisfaction > 0.5 ? '#92400e' : '#991b1b',
            }}>{(satisfaction * 100).toFixed(0)}% 好评</span>
          </div>
        </div>
      )}

      {metrics?.tool_calls_by_name && Object.keys(metrics.tool_calls_by_name).length > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <h3 className="text-sm font-medium mb-3">工具调用排行（1h）</h3>
          <div className="space-y-2">
            {Object.entries(metrics.tool_calls_by_name).sort(([,a],[,b]) => (b as number) - (a as number)).slice(0, 8)
              .map(([name, count]: [string, any]) => {
                const max = Math.max(...Object.values(metrics.tool_calls_by_name).map(Number), 1)
                const errors = (metrics.tool_errors_by_name || {})[name] || 0
                const rate = count > 0 ? ((count - errors) / count * 100).toFixed(0) : '100'
                return (<div key={name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono">{name}</span>
                    <span style={{ color: 'var(--accent)' }}>{count} 次 <span style={{ color: Number(rate) < 85 ? '#ef4444' : 'var(--text-muted)', marginLeft: 4 }}>({rate}%)</span></span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(count/max)*100}%`, background: 'var(--accent)' }} /></div>
                </div>)
              })}
          </div>
        </div>
      )}

      {models.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <h3 className="text-sm font-medium mb-3">按模型统计（近 7 天）</h3>
          <div className="space-y-2">
            {models.map((m: any, i: number) => {
              const max = Math.max(...models.map((x: any) => x.total_tokens || 0), 1)
              return (<div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono">{m.model || '未知'}</span>
                  <span style={{ color: 'var(--accent)' }}>{(m.total_tokens || 0).toLocaleString()} tok · {m.call_count || 0} 次</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
                  <div className="h-full rounded-full" style={{ width: `${((m.total_tokens||0)/max)*100}%`, background: 'var(--accent)' }} /></div>
              </div>)})}
          </div>
        </div>
      )}

      {metrics?.llm_latency_by_model && Object.keys(metrics.llm_latency_by_model).length > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <h3 className="text-sm font-medium mb-3">LLM 延迟（1h）</h3>
          <div className="space-y-2">
            {Object.entries(metrics.llm_latency_by_model).map(([model, stat]: [string, any]) => (
              <div key={model} className="flex items-center justify-between text-xs py-1" style={{ borderBottom: '1px solid var(--border)' }}>
                <span className="font-mono">{model}</span>
                <span style={{ color: 'var(--text-muted)' }}>avg {stat.avg}s · P95 {stat.p95}s · {stat.count} 次</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-medium mb-3">系统总览</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {[{ l: 'Profile', v: (stats?.profiles || []).join(', ') || '-' }, { l: '知识库', v: stats?.knowledge || '-' },
            { l: '工具', v: `${stats?.tools || 0} 个` }, { l: 'WS', v: `${stats?.ws_connections || 0} 连接` }].map(r => (
            <div key={r.l} className="flex justify-between py-1.5 text-sm">
              <span style={{ color: 'var(--text-muted)' }}>{r.l}</span><span>{r.v}</span></div>))}
        </div>
      </div>
    </div>
  )
}

function MM({ label, value, unit, color }: { label: string; value: any; unit?: string; color?: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
      <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-base font-bold" style={{ color: color || 'var(--text)' }}>
        {value}{unit && <span className="text-[10px] font-normal ml-0.5" style={{ color: 'var(--text-muted)' }}>{unit}</span>}
      </div>
    </div>
  )
}
