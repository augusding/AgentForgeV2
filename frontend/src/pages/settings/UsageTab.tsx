import { useState, useEffect } from 'react'
import { BarChart3, Loader2, TrendingUp, MessageSquare, Zap } from 'lucide-react'
import client from '../../api/client'

export default function UsageTab() {
  const [stats, setStats] = useState<any>(null); const [models, setModels] = useState<any[]>([]); const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([client.get('/analytics/daily').catch(() => ({})), client.get('/health').catch(() => ({})), client.get('/analytics/weekly').catch(() => [])])
      .then(([d, h, w]) => { setStats({ ...(h as any), ...(d as any) }); if (Array.isArray(w)) setModels(w); setLoading(false) })
  }, [])

  if (loading) return <div className="text-center py-8"><Loader2 className="animate-spin mx-auto" size={20} style={{ color: 'var(--accent)' }} /></div>

  const cards = [
    { label: '今日对话', value: stats?.total_sessions || stats?.session_count || 0, icon: MessageSquare, color: '#3b82f6' },
    { label: '今日消息', value: stats?.total_messages || stats?.message_count || 0, icon: TrendingUp, color: '#22c55e' },
    { label: 'Token 用量', value: stats?.total_tokens || 0, icon: BarChart3, color: '#a855f7', fmt: true },
    { label: '工作流', value: stats?.workflow_count || 0, icon: Zap, color: '#f59e0b' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        {cards.map(c => { const Icon = c.icon; const v = c.fmt && c.value > 10000 ? `${(c.value / 1000).toFixed(1)}K` : String(c.value)
          return (<div key={c.label} className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-2"><Icon size={14} style={{ color: c.color }} /><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{c.label}</span></div>
            <div className="text-xl font-bold" style={{ color: c.color }}>{v}</div>
          </div>)})}
      </div>

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
                  <div className="h-full rounded-full" style={{ width: `${((m.total_tokens || 0) / max) * 100}%`, background: 'var(--accent)' }} /></div>
              </div>)})}
          </div>
        </div>)}

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
