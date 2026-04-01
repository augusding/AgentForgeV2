import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ChevronDown, ChevronRight, Clock, Zap, AlertCircle, CheckCircle, Search } from 'lucide-react'
import client from '../../api/client'

const SC: Record<string, { color: string }> = {
  completed: { color: '#22c55e' }, running: { color: '#3b82f6' },
  error: { color: '#ef4444' }, blocked: { color: '#f59e0b' },
}
function spanColor(n: string) {
  if (n.startsWith('llm_call')) return '#3b82f6'
  if (n.startsWith('tool_')) return '#22c55e'
  return { guardrail_check: '#f59e0b', rag_search: '#06b6d4', context_build: '#8b5cf6' }[n] || '#6b7280'
}
function spanLabel(n: string) {
  if (n.startsWith('llm_call_')) return `LLM #${n.split('_').pop()}`
  if (n.startsWith('tool_')) return `工具: ${n.slice(5)}`
  return { guardrail_check: '安全检查', position_resolve: '岗位解析', session_load: '会话加载',
    rag_search: 'RAG 检索', context_build: '上下文构建', agent_start: 'Agent 启动' }[n] || n
}
function fmtT(ts: number) { return new Date(ts * 1000).toLocaleTimeString('zh-CN', { hour12: false }) }
function fmtD(ms: number) { return ms < 1 ? '<1ms' : ms < 1000 ? `${Math.round(ms)}ms` : `${(ms/1000).toFixed(1)}s` }

export default function TracesTab(_props: { isAdmin?: boolean }) {
  const [traces, setTraces] = useState<any[]>([])
  const [detail, setDetail] = useState<any>(null)
  const [sel, setSel] = useState(''); const [loading, setLoading] = useState(false)
  const [dLoading, setDLoading] = useState(false); const [autoR, setAutoR] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { const r: any = await client.get('/traces?limit=30'); setTraces(r?.traces ?? []) } catch {}
    setLoading(false)
  }, [])

  const open = async (id: string) => {
    if (sel === id) { setSel(''); setDetail(null); return }
    setSel(id); setDLoading(true)
    try { setDetail(await client.get(`/trace/${id}`)) } catch { setDetail(null) }
    setDLoading(false)
  }

  useEffect(() => { load() }, [load])
  useEffect(() => { if (!autoR) return; const t = setInterval(load, 5000); return () => clearInterval(t) }, [autoR, load])

  const maxD = detail ? Math.max(...detail.spans.map((s: any) => s.offset_ms + s.duration_ms), detail.duration * 1000) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Search size={14} style={{ color: 'var(--text-muted)' }} />
        <span className="text-sm font-medium">请求追踪</span>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer ml-2" style={{ color: 'var(--text-muted)' }}>
          <input type="checkbox" checked={autoR} onChange={e => setAutoR(e.target.checked)} />自动刷新</label>
        <button onClick={load} className="flex items-center gap-1 text-xs px-2 py-1 rounded ml-auto"
          style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />刷新</button>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{traces.length} 条</span>
      </div>

      <div className="space-y-1.5">
        {!traces.length && <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>暂无追踪数据</div>}
        {traces.map((t: any) => {
          const sc = SC[t.status] || SC.completed; const isOpen = sel === t.request_id
          return (
            <div key={t.request_id}>
              <div onClick={() => open(t.request_id)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer"
                style={{ background: isOpen ? 'var(--bg-surface)' : 'transparent', border: isOpen ? '1px solid var(--border)' : '1px solid transparent' }}>
                {isOpen ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
                {t.status === 'completed' ? <CheckCircle size={14} style={{ color: sc.color }} /> :
                 t.status === 'error' ? <AlertCircle size={14} style={{ color: sc.color }} /> :
                 <Clock size={14} style={{ color: sc.color }} />}
                <span className="font-mono text-xs" style={{ color: 'var(--accent)', minWidth: 90 }}>{t.request_id}</span>
                <span className="text-xs truncate flex-1" style={{ color: 'var(--text)' }}>{t.content || '—'}</span>
                <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--text-muted)' }}><Zap size={10} />{t.spans_count}</span>
                <span className="text-xs font-mono" style={{ color: t.duration > 10 ? '#ef4444' : t.duration > 5 ? '#f59e0b' : 'var(--text-muted)', minWidth: 50, textAlign: 'right' }}>{t.duration.toFixed(1)}s</span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)', minWidth: 55 }}>{fmtT(t.start_time)}</span>
              </div>

              {isOpen && <div className="mx-2 mb-2 rounded-lg p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                {dLoading ? <div className="text-center py-4"><RefreshCw size={16} className="animate-spin mx-auto" style={{ color: 'var(--accent)' }} /></div>
                : detail ? <div className="space-y-4">
                  <div className="grid grid-cols-5 gap-2">
                    <MS label="总耗时" value={`${detail.duration.toFixed(1)}s`} />
                    <MS label="LLM 调用" value={`${detail.summary.llm_calls} 次`} />
                    <MS label="工具调用" value={`${detail.summary.tool_calls} 次`} />
                    <MS label="LLM 耗时" value={fmtD(detail.summary.llm_time_ms)} sub={detail.duration > 0 ? `${Math.round(detail.summary.llm_time_ms / (detail.duration * 1000) * 100)}%` : ''} />
                    <MS label="工具耗时" value={fmtD(detail.summary.tool_time_ms)} sub={detail.duration > 0 ? `${Math.round(detail.summary.tool_time_ms / (detail.duration * 1000) * 100)}%` : ''} />
                  </div>
                  <div className="space-y-1">
                    {detail.spans.map((s: any, i: number) => {
                      const c = spanColor(s.name)
                      const w = maxD > 0 ? Math.max((s.duration_ms / maxD) * 100, 0.5) : 0
                      const l = maxD > 0 ? (s.offset_ms / maxD) * 100 : 0
                      return <div key={i} className="group">
                        <div className="flex items-center gap-2" style={{ minHeight: 28 }}>
                          <span className="text-[11px] shrink-0" style={{ color: c, minWidth: 110, fontWeight: 500 }}>{spanLabel(s.name)}</span>
                          <div className="flex-1 relative" style={{ height: 18, background: 'var(--bg)', borderRadius: 4 }}>
                            <div style={{ position: 'absolute', left: `${l}%`, width: `${Math.max(w, 0.8)}%`, height: '100%',
                              background: c, borderRadius: 3, opacity: 0.7 }} className="group-hover:opacity-100" /></div>
                          <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--text-muted)', minWidth: 55, textAlign: 'right' }}>
                            {s.duration_ms > 0 ? fmtD(s.duration_ms) : `+${s.offset_ms}ms`}</span>
                        </div>
                        {Object.keys(s.data).length > 0 && <div className="ml-[118px] hidden group-hover:block mb-1">
                          <div className="inline-flex flex-wrap gap-1.5">
                            {Object.entries(s.data).map(([k, v]) => <span key={k} className="text-[9px] px-1.5 py-0.5 rounded"
                              style={{ background: `${c}15`, color: c, border: `1px solid ${c}30` }}>{k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>)}
                          </div></div>}
                      </div>
                    })}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] pt-2" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                    {detail.metadata.user_id && <span>用户: {String(detail.metadata.user_id)}</span>}
                    {detail.metadata.position_id && <span>岗位: {String(detail.metadata.position_id)}</span>}
                    {detail.metadata.model && <span>模型: {String(detail.metadata.model)}</span>}
                    {detail.metadata.tokens && <span>Token: {String(detail.metadata.tokens)}</span>}
                  </div>
                </div> : <div className="text-center py-4 text-xs" style={{ color: 'var(--text-muted)' }}>加载失败</div>}
              </div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MS({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</div>
    <div className="text-sm font-bold mt-0.5">{value}</div>
    {sub && <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
  </div>
}
