import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, Play, Trash2, RefreshCw, Plus, Edit3 } from 'lucide-react'
import { listWorkflows, createWorkflow, deleteWorkflow, executeWorkflow } from '../api/workflow'
import toast from 'react-hot-toast'

export default function Workflows() {
  const [wfs, setWfs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => { load() }, [])
  const load = async () => { setLoading(true); try { const d: any = await listWorkflows(); setWfs(Array.isArray(d) ? d : d.workflows || []) } catch {} finally { setLoading(false) } }

  const handleCreate = async () => {
    try {
      const r = await createWorkflow({ name: `工作流 ${new Date().toLocaleTimeString('zh-CN')}`, description: '',
        nodes: [{ id: 'trigger_1', type: 'manualTrigger', label: '手动触发', config: {}, position: { x: 250, y: 200 } }], edges: [] })
      if (r.id) navigate(`/workflows/${r.id}`)
    } catch { toast.error('创建失败') }
  }

  const handleExec = async (id: string) => { setExecuting(id); try { await executeWorkflow(id); toast.success('执行完成') } catch { toast.error('执行失败') } finally { setExecuting(null) } }
  const handleDel = async (id: string, name: string) => { if (!confirm(`删除「${name}」？`)) return; try { await deleteWorkflow(id); toast.success('已删除'); load() } catch {} }

  if (loading) return <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-muted)' }}>加载中...</div>

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-lg font-bold">工作流</h1><p className="text-xs" style={{ color: 'var(--text-muted)' }}>自动化任务编排</p></div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}><RefreshCw size={16} /></button>
          <button onClick={handleCreate} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-white" style={{ background: 'var(--accent)' }}><Plus size={14} /> 新建</button>
        </div>
      </div>
      {wfs.length === 0 ? (
        <div className="text-center py-20"><Zap size={48} className="mx-auto mb-4" style={{ color: 'var(--border)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>暂无工作流，点击"新建"开始创建</p></div>
      ) : (
        <div className="space-y-3">{wfs.map(wf => (
          <div key={wf.id} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <Zap size={18} style={{ color: 'var(--accent)' }} />
            <div className="flex-1 min-w-0"><h3 className="text-sm font-medium truncate">{wf.name}</h3>
              {wf.description && <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{wf.description}</p>}</div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => navigate(`/workflows/${wf.id}`)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs hover:bg-[var(--bg-hover)]"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}><Edit3 size={12} /> 编辑</button>
              <button onClick={() => handleExec(wf.id)} disabled={executing === wf.id} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-white"
                style={{ background: executing === wf.id ? 'var(--border)' : 'var(--accent)' }}><Play size={12} /> {executing === wf.id ? '...' : '执行'}</button>
              <button onClick={() => handleDel(wf.id, wf.name)} className="p-1.5 rounded hover:text-[var(--error)]" style={{ color: 'var(--text-muted)' }}><Trash2 size={14} /></button>
            </div>
          </div>))}</div>
      )}
    </div>
  )
}
