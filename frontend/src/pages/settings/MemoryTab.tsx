import { useState, useEffect } from 'react'
import { Brain, Loader2, Trash2, RefreshCw } from 'lucide-react'
import client from '../../api/client'
import toast from 'react-hot-toast'

type FK = '' | 'preference' | 'topic' | 'behavior'
const FILTERS: Array<{ key: FK; label: string }> = [
  { key: '', label: '全部' }, { key: 'preference', label: '偏好' }, { key: 'topic', label: '话题' }, { key: 'behavior', label: '行为' },
]
const TS: Record<string, { label: string; color: string }> = {
  preference: { label: '偏好', color: '#a855f7' }, topic: { label: '话题', color: '#3b82f6' },
  behavior: { label: '行为', color: '#22c55e' }, insight: { label: '洞察', color: '#f59e0b' },
}

export default function MemoryTab(_props: { isAdmin?: boolean }) {
  const [signals, setSignals] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [filter, setFilter] = useState<FK>('')

  const load = () => { setLoading(true); client.get('/analytics/signal?limit=50').then((d: any) => setSignals(Array.isArray(d) ? d : d.signals || d.items || [])).catch(() => {}).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [])

  const filtered = filter ? signals.filter(s => (s.signal_type || s.type) === filter) : signals
  const del = async (id: string) => { try { await client.delete(`/analytics/signal/${id}`); setSignals(p => p.filter(s => s.id !== id)); toast.success('已删除') } catch { toast.error('失败') } }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {FILTERS.map(f => { const cnt = f.key ? signals.filter(s => (s.signal_type || s.type) === f.key).length : signals.length
            return (<button key={f.key} onClick={() => setFilter(f.key)} className="px-3 py-1 rounded-full text-[10px]"
              style={{ background: filter === f.key ? 'var(--accent)' : 'var(--bg-surface)', color: filter === f.key ? 'white' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
              {f.label} ({cnt})</button>)})}
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
      </div>

      {loading ? <div className="text-center py-8"><Loader2 className="animate-spin mx-auto" size={20} style={{ color: 'var(--accent)' }} /></div>
      : filtered.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <Brain size={32} className="mx-auto mb-2" style={{ color: 'var(--border)' }} />
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>暂无记忆。对话后系统自动学习偏好。</p></div>
      ) : (
        <div className="space-y-2">{filtered.map((s: any, i: number) => {
          const tp = TS[s.signal_type || s.type] || { label: s.signal_type || s.type || '?', color: '#6b7280' }
          return (<div key={s.id || i} className="flex items-start gap-3 px-4 py-3 rounded-lg group" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <span className="text-[9px] px-1.5 py-0.5 rounded mt-0.5 shrink-0" style={{ background: `${tp.color}15`, color: tp.color }}>{tp.label}</span>
            <div className="flex-1 min-w-0"><div className="text-xs">{s.content}</div>
              <div className="text-[9px] mt-1 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                {s.created_at && <span>{new Date(s.created_at * 1000).toLocaleString('zh-CN')}</span>}
                {s.source && <span>· {s.source}</span>}</div></div>
            <button onClick={() => del(s.id)} className="p-1 rounded opacity-0 group-hover:opacity-100 hover:text-[var(--error)]" style={{ color: 'var(--text-muted)' }}><Trash2 size={12} /></button>
          </div>)})}</div>
      )}
    </div>
  )
}
