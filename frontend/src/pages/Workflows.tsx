import { useState, useEffect } from 'react'
import { Zap, Play, Clock, CheckCircle, XCircle, Trash2, RefreshCw } from 'lucide-react'
import client from '../api/client'
import toast from 'react-hot-toast'

interface Workflow { id: string; name: string; description: string; enabled: boolean }
interface Execution { id: string; status: string; started_at: number; completed_at: number; error: string }

export default function Workflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState<string | null>(null)
  const [executions, setExecutions] = useState<Record<string, Execution[]>>({})

  useEffect(() => { loadWorkflows() }, [])

  const loadWorkflows = async () => {
    setLoading(true)
    try { const d: any = await client.get('/workflows'); setWorkflows(Array.isArray(d) ? d : d.workflows || []) }
    catch {} finally { setLoading(false) }
  }

  const executeWorkflow = async (wfId: string) => {
    setExecuting(wfId)
    try {
      const r: any = await client.post(`/workflows/${wfId}/execute`, {})
      toast.success(`执行完成: ${r.status || 'ok'}`)
      loadExecutions(wfId)
    } catch (e: any) { toast.error(`执行失败: ${e.message || '未知错误'}`) }
    finally { setExecuting(null) }
  }

  const loadExecutions = async (wfId: string) => {
    try { const d: any = await client.get(`/workflows/${wfId}/executions`); setExecutions(p => ({ ...p, [wfId]: d.executions || [] })) } catch {}
  }

  const deleteWorkflow = async (wfId: string, name: string) => {
    if (!confirm(`确认删除工作流「${name}」？`)) return
    try { await client.delete(`/workflows/${wfId}`); toast.success('已删除'); setWorkflows(p => p.filter(w => w.id !== wfId)) }
    catch { toast.error('删除失败') }
  }

  const statusIcon = (s: string) =>
    s === 'completed' ? <CheckCircle size={14} style={{ color: 'var(--success)' }} /> :
    s === 'failed' ? <XCircle size={14} style={{ color: 'var(--error)' }} /> :
    <Clock size={14} style={{ color: 'var(--text-muted)' }} />

  if (loading) return <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-muted)' }}>加载中...</div>

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold">工作流</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>自动化任务编排和执行</p>
        </div>
        <button onClick={loadWorkflows} className="p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors" style={{ color: 'var(--text-muted)' }}>
          <RefreshCw size={16} />
        </button>
      </div>

      {workflows.length === 0 ? (
        <div className="text-center py-16">
          <Zap size={40} className="mx-auto mb-4" style={{ color: 'var(--border)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>暂无工作流</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>在岗位配置中定义工作流，或通过 API 创建</p>
        </div>
      ) : (
        <div className="space-y-4">
          {workflows.map(wf => (
            <div key={wf.id} className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap size={16} style={{ color: 'var(--accent)' }} />
                  <h3 className="font-medium text-sm">{wf.name}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => executeWorkflow(wf.id)} disabled={executing === wf.id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-white transition-colors"
                    style={{ background: executing === wf.id ? 'var(--border)' : 'var(--accent)' }}>
                    <Play size={12} /> {executing === wf.id ? '执行中...' : '执行'}
                  </button>
                  <button onClick={() => loadExecutions(wf.id)} className="p-1.5 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}><Clock size={14} /></button>
                  <button onClick={() => deleteWorkflow(wf.id, wf.name)} className="p-1.5 rounded hover:bg-[var(--bg-hover)] hover:text-[var(--error)]" style={{ color: 'var(--text-muted)' }}><Trash2 size={14} /></button>
                </div>
              </div>
              {wf.description && <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{wf.description}</p>}

              {executions[wf.id]?.length > 0 && (
                <div className="mt-3 pt-3 border-t space-y-1" style={{ borderColor: 'var(--border)' }}>
                  <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>最近执行</div>
                  {executions[wf.id].slice(0, 5).map(ex => (
                    <div key={ex.id} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {statusIcon(ex.status)}
                      <span>{ex.status}</span>
                      {ex.completed_at && ex.started_at && <span>· {((ex.completed_at - ex.started_at) * 1000).toFixed(0)}ms</span>}
                      {ex.error && <span className="text-[var(--error)]">· {ex.error.slice(0, 50)}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
