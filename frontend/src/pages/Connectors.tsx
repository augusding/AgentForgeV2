import { useState, useEffect } from 'react'
import { Plus, Play, Trash2, TestTube, RefreshCw, CheckCircle, XCircle, AlertCircle, BarChart2 } from 'lucide-react'
import ConnectorMonitor from '../components/ConnectorMonitor'
import toast from 'react-hot-toast'
import { listConnectors, getConnectorTypes, createConnector, deleteConnector,
         testConnector, triggerSync, getSyncStatus,
         type Connector, type ConnectorType, type SyncStatus } from '../api/connectors'

const ST_ICON: Record<string, JSX.Element> = {
  success: <CheckCircle size={13} style={{ color: '#22c55e' }} />,
  partial: <AlertCircle size={13} style={{ color: '#f59e0b' }} />,
  error: <XCircle size={13} style={{ color: '#ef4444' }} />,
}

export default function Connectors() {
  const [list, setList] = useState<Connector[]>([])
  const [types, setTypes] = useState<ConnectorType[]>([])
  const [statuses, setStatuses] = useState<Record<string, SyncStatus>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', connector_type: '', config: {} as Record<string, string>, interval: 60 })
  const [testing, setTesting] = useState<string | null>(null)
  const [expandedMonitor, setExpandedMonitor] = useState<string | null>(null)

  const load = async () => {
    const [c, t] = await Promise.all([listConnectors(), getConnectorTypes()])
    setList(c.connectors || []); setTypes(t.types || [])
  }
  const refreshSt = async (ids: string[]) => {
    const res = await Promise.allSettled(ids.map(getSyncStatus))
    const m: Record<string, SyncStatus> = {}
    res.forEach((r, i) => { if (r.status === 'fulfilled') m[ids[i]] = r.value })
    setStatuses(p => ({ ...p, ...m }))
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (!list.length) return
    refreshSt(list.map(c => c.id))
    const t = setInterval(() => refreshSt(list.map(c => c.id)), 5000)
    return () => clearInterval(t)
  }, [list.length])

  const selType = types.find(t => t.type === form.connector_type)

  const handleCreate = async () => {
    if (!form.name || !form.connector_type) { toast.error('请填写名称和类型'); return }
    try {
      await createConnector({ name: form.name, connector_type: form.connector_type, config: form.config, sync_interval_minutes: form.interval })
      toast.success('创建成功'); setShowAdd(false); setForm({ name: '', connector_type: '', config: {}, interval: 60 }); await load()
    } catch { toast.error('创建失败') }
  }
  const handleTest = async (id: string) => {
    setTesting(id)
    try { const r = await testConnector(id); r.ok ? toast.success(r.message) : toast.error(r.message) }
    catch { toast.error('测试失败') } finally { setTesting(null) }
  }
  const handleSync = async (id: string) => {
    try { const r = await triggerSync(id); r.status === 'already_running' ? toast('同步进行中', { icon: '⏳' }) : toast.success('同步已触发'); setTimeout(() => refreshSt([id]), 1200) }
    catch { toast.error('触发失败') }
  }
  const handleDel = async (c: Connector) => {
    if (!confirm(`确认删除「${c.name}」？`)) return
    try { await deleteConnector(c.id); toast.success('已删除'); await load() } catch { toast.error('删除失败') }
  }
  const fmt = (ts: number | null) => ts ? new Date(ts * 1000).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <div className="h-full flex flex-col p-6 max-w-[1000px] mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-bold">企业数据源</h1>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white" style={{ background: 'var(--accent)' }}>
          <Plus size={14} /> 添加连接器</button>
      </div>
      <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>对接企业内部系统，自动同步文档到知识库供 AI 检索</p>

      <div className="space-y-3">
        {!list.length && <div className="text-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>暂无连接器，点击右上角添加</div>}
        {list.map(c => {
          const st = statuses[c.id]; const running = st?.running; const _k = c.id
          const lastSt = st?.last_sync_status || c.last_sync_status
          const circuit = st?.circuit?.state || 'closed'
          return (<div key={_k} className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>{c.connector_type}</span>
                  {circuit === 'open' && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#fef3c7', color: '#92400e' }}>熔断中</span>}
                </div>
                <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-1">
                    {running ? <RefreshCw size={13} className="animate-spin" style={{ color: 'var(--accent)' }} /> : (lastSt ? ST_ICON[lastSt] : null)}
                    {running ? '同步中' : (lastSt || '未同步')}
                  </span>
                  <span>上次: {fmt(st?.last_sync_at ?? c.last_sync_at)}</span>
                  {(st?.last_sync_count ?? c.last_sync_count) > 0 && <span>{st?.last_sync_count ?? c.last_sync_count} 篇</span>}
                  <span>每 {c.sync_interval_minutes} 分钟</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setExpandedMonitor(expandedMonitor === c.id ? null : c.id)} title="监控"
                  className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)]"><BarChart2 size={15} style={{ color: expandedMonitor === c.id ? 'var(--accent)' : 'var(--text-muted)' }} /></button>
                <button onClick={() => handleTest(c.id)} disabled={testing === c.id} title="测试" className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)]"><TestTube size={15} style={{ color: 'var(--text-muted)' }} /></button>
                <button onClick={() => handleSync(c.id)} disabled={running} title="同步" className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)]"><Play size={15} style={{ color: running ? 'var(--border)' : 'var(--accent)' }} /></button>
                <button onClick={() => handleDel(c)} title="删除" className="p-1.5 rounded-lg hover:bg-[#ef444410]"><Trash2 size={15} style={{ color: '#ef4444' }} /></button>
              </div>
            </div>
            {expandedMonitor === c.id && (
              <div className="px-4 pb-4" style={{ borderTop: '1px solid var(--border)' }}>
                <ConnectorMonitor connectorId={c.id} connectorName={c.name} />
              </div>
            )}
          </div>)
        })}
      </div>

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <h2 className="text-base font-bold mb-4">添加连接器</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>名称 *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="如：产品手册目录"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>类型 *</label>
                <select value={form.connector_type} onChange={e => setForm(p => ({ ...p, connector_type: e.target.value, config: {} }))}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                  <option value="">请选择</option>
                  {types.map(t => <option key={t.type} value={t.type}>{t.type}</option>)}
                </select>
              </div>
              {selType && Object.entries(selType.schema.properties || {}).map(([k, f]) => (
                <div key={k}>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>{f.title}{selType.schema.required?.includes(k) ? ' *' : ''}</label>
                  {(f as any).type === 'array' ? (
                    <textarea value={Array.isArray(form.config[k]) ? (form.config[k] as unknown as string[]).join('\n') : (form.config[k] as string) || ''}
                      onChange={e => setForm(p => ({ ...p, config: { ...p.config, [k]: e.target.value } }))}
                      placeholder={(f.description || '') + '\n每行一个'} rows={3}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                  ) : (
                    <input value={(form.config[k] as string) || (f.default as string) || ''} onChange={e => setForm(p => ({ ...p, config: { ...p.config, [k]: e.target.value } }))}
                      placeholder={f.description || ''} className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                  )}
                </div>
              ))}
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>同步间隔（分钟）</label>
                <input type="number" min={5} value={form.interval} onChange={e => setForm(p => ({ ...p, interval: parseInt(e.target.value) || 60 }))}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--border)' }}>取消</button>
              <button onClick={handleCreate} className="flex-1 py-2 rounded-lg text-sm text-white" style={{ background: 'var(--accent)' }}>创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
