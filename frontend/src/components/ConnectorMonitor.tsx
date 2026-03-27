import { useState, useEffect } from 'react'
import { RefreshCw, AlertTriangle, CheckCircle, Clock, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { getSyncHistory, getDLQ, retryDLQ, type SyncHistoryItem, type DLQItem } from '../api/connector_monitor'

interface Props { connectorId: string; connectorName?: string }

export default function ConnectorMonitor({ connectorId }: Props) {
  const [tab, setTab] = useState<'history' | 'dlq'>('history')
  const [history, setHistory] = useState<SyncHistoryItem[]>([])
  const [dlq, setDlq] = useState<DLQItem[]>([])
  const [loading, setLoading] = useState(false)
  const [retrying, setRetrying] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [h, d] = await Promise.all([getSyncHistory(connectorId, 30), getDLQ(connectorId)])
      setHistory(h.history || []); setDlq(d.failures || [])
    } catch { toast.error('加载监控数据失败') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [connectorId])

  const handleRetry = async (fid: string) => {
    setRetrying(fid)
    try { await retryDLQ(connectorId, fid); toast.success('已加入重试队列'); await load() }
    catch { toast.error('重试失败') } finally { setRetrying(null) }
  }

  const fmt = (ts: number) => new Date(ts * 1000).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  const pending = dlq.filter(f => !f.resolved)
  const resolved = dlq.filter(f => f.resolved)

  return (
    <div className="mt-4">
      <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
        {(['history', 'dlq'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className="flex-1 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{ background: tab === t ? 'var(--bg-surface)' : 'transparent', color: tab === t ? 'var(--text)' : 'var(--text-muted)' }}>
            {t === 'history' ? '操作历史' : `死信队列${pending.length ? ` (${pending.length})` : ''}`}
          </button>
        ))}
        <button onClick={load} disabled={loading} className="px-2 py-1.5 rounded-md" style={{ color: 'var(--text-muted)' }}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /></button>
      </div>

      {tab === 'history' && (
        <div className="space-y-2">
          {!history.length && <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>暂无历史</p>}
          {history.map((item, i) => {
            let detail: Record<string, unknown> = {}
            try { detail = JSON.parse(item.detail) } catch {}
            return (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <div className="mt-0.5">
                  {item.action === 'create' ? <CheckCircle size={14} style={{ color: '#22c55e' }} />
                   : item.action === 'delete' ? <AlertTriangle size={14} style={{ color: '#ef4444' }} />
                   : <Clock size={14} style={{ color: 'var(--text-muted)' }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{item.action}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmt(item.created_at)}</span>
                  </div>
                  {Object.keys(detail).length > 0 && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {Object.entries(detail).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'dlq' && (
        <div className="space-y-2">
          {!dlq.length && <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>DLQ 为空，所有文档同步正常</p>}
          {pending.map(f => (
            <div key={f.id} className="p-3 rounded-lg" style={{ background: '#ef444408', border: '1px solid #ef444420' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{f.source_url || f.doc_id}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#ef4444' }}>{f.error_msg.slice(0, 120)}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>重试 {f.retry_count}/{f.max_retries} · 下次: {fmt(f.next_retry_at)}</p>
                </div>
                <button onClick={() => handleRetry(f.id)} disabled={retrying === f.id}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs shrink-0" style={{ border: '1px solid #ef444440', color: '#ef4444' }}>
                  <RotateCcw size={11} className={retrying === f.id ? 'animate-spin' : ''} /> 重试
                </button>
              </div>
            </div>
          ))}
          {resolved.length > 0 && <>
            <p className="text-xs font-medium mt-2" style={{ color: '#22c55e' }}>已解决（{resolved.length}）</p>
            {resolved.slice(0, 5).map(f => (
              <div key={f.id} className="p-2 rounded-lg flex items-center gap-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <CheckCircle size={12} style={{ color: '#22c55e' }} />
                <p className="text-xs truncate flex-1" style={{ color: 'var(--text-muted)' }}>{f.source_url || f.doc_id}</p>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmt(f.updated_at)}</span>
              </div>
            ))}
          </>}
        </div>
      )}
    </div>
  )
}
