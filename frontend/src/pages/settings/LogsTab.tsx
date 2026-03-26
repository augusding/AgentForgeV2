import { useState, useEffect, useRef } from 'react'
import { RefreshCw } from 'lucide-react'
import client from '../../api/client'

interface LogEntry {
  timestamp: number
  level: string
  category: string
  event: string
  message: string
  data: Record<string, unknown>
  user_id: string
  session_id: string
  duration: number | null
}

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: '#6b7280', INFO: '#3b82f6', WARN: '#f59e0b', ERROR: '#ef4444',
}
const CAT_COLORS: Record<string, string> = {
  pipeline: '#a855f7', tool: '#22c55e', guard: '#f59e0b',
  file: '#06b6d4', llm: '#3b82f6', system: '#6b7280',
}
const LEVELS = ['', 'DEBUG', 'INFO', 'WARN', 'ERROR']
const CATEGORIES = ['', 'pipeline', 'tool', 'guard', 'file', 'llm', 'system']

function Badge({ color, text }: { color: string; text: string }) {
  return (
    <span style={{
      background: color + '22', color, border: `1px solid ${color}44`,
      fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>{text}</span>
  )
}

function fmt(ts: number) {
  const d = new Date(ts * 1000)
  return d.toTimeString().slice(0, 8)
}

export default function LogsTab() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [category, setCategory] = useState('')
  const [level, setLevel] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (category) params.set('category', category)
      if (level) params.set('level', level)
      const res: any = await client.get(`/system/logs?${params}`)
      setLogs(res?.logs ?? [])
    } catch { /* handled by client interceptor */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [category, level]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (autoRefresh) timerRef.current = setInterval(load, 3000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [autoRefresh, category, level]) // eslint-disable-line react-hooks/exhaustive-deps

  const sel = 'text-xs rounded px-2 py-1'
  const selStyle = { background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={category} onChange={e => setCategory(e.target.value)} className={sel} style={selStyle}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c || '全部分类'}</option>)}
        </select>
        <select value={level} onChange={e => setLevel(e.target.value)} className={sel} style={selStyle}>
          {LEVELS.map(l => <option key={l} value={l}>{l || '全部级别'}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none" style={{ color: 'var(--text-muted)' }}>
          <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
          自动刷新
        </label>
        <button onClick={load} className="flex items-center gap-1 text-xs px-2 py-1 rounded" style={selStyle}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />刷新
        </button>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>{logs.length} 条</span>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
              {['时间', '级别', '分类', '事件', '消息', '耗时'].map(h => (
                <th key={h} className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>暂无日志</td></tr>
            )}
            {logs.map((log, i) => (
              <>
                <tr key={i} onClick={() => setExpanded(expanded === i ? null : i)}
                  className="cursor-pointer transition-colors"
                  style={{ borderBottom: '1px solid var(--border)', background: expanded === i ? 'var(--bg-surface)' : 'transparent' }}>
                  <td className="px-3 py-1.5 font-mono" style={{ color: 'var(--text-muted)' }}>{fmt(log.timestamp)}</td>
                  <td className="px-3 py-1.5"><Badge color={LEVEL_COLORS[log.level] ?? '#6b7280'} text={log.level} /></td>
                  <td className="px-3 py-1.5"><Badge color={CAT_COLORS[log.category] ?? '#6b7280'} text={log.category} /></td>
                  <td className="px-3 py-1.5 font-mono" style={{ color: 'var(--text-muted)' }}>{log.event}</td>
                  <td className="px-3 py-1.5 max-w-[260px] truncate">{log.message}</td>
                  <td className="px-3 py-1.5" style={{ color: 'var(--text-muted)' }}>
                    {log.duration != null ? `${(log.duration * 1000).toFixed(0)}ms` : '—'}
                  </td>
                </tr>
                {expanded === i && (
                  <tr key={`${i}-exp`} style={{ background: 'var(--bg-surface)' }}>
                    <td colSpan={6} className="px-4 py-3">
                      <pre className="text-xs overflow-auto rounded p-2" style={{
                        background: 'var(--bg)', color: 'var(--text-muted)', maxHeight: 180,
                      }}>{JSON.stringify({ ...log, data: log.data }, null, 2)}</pre>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
