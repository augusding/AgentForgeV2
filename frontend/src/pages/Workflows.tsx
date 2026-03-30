import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, Play, Trash2, RefreshCw, Plus, Edit3, BarChart3, CheckCircle, XCircle, Clock, Sparkles, X } from 'lucide-react'
import { listWorkflows, createWorkflow, deleteWorkflow, executeWorkflow, getWorkflowStats, clearAllWorkflows, generateWorkflow } from '../api/workflow'
import toast from 'react-hot-toast'

export default function Workflows() {
  const [wfs, setWfs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState<string | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [showAI, setShowAI] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { load(); getWorkflowStats(7).then(setStats).catch(() => {}) }, [])
  const load = async () => { setLoading(true); try { const d: any = await listWorkflows(); setWfs(Array.isArray(d) ? d : d.workflows || []) } catch {} finally { setLoading(false) } }

  const handleCreate = async () => {
    try { const r = await createWorkflow({ name: `工作流 ${new Date().toLocaleTimeString('zh-CN')}`, description: '',
      nodes: [{ id: 'trigger_1', type: 'manualTrigger', label: '手动触发', config: {}, position: { x: 250, y: 200 } }], edges: [] })
      if (r.id) navigate(`/workflows/${r.id}`)
    } catch { toast.error('创建失败') }
  }
  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    try {
      const r = await generateWorkflow(aiPrompt.trim())
      if (r.error) { toast.error(r.error); return }
      toast.success(`已生成「${r.name}」（${r.nodes_count} 个节点）`)
      setShowAI(false); setAiPrompt('')
      navigate(`/workflows/${r.id}`)
    } catch (e: any) {
      toast.error(e?.message || 'AI 生成失败，请重试')
    } finally { setAiLoading(false) }
  }
  const handleExec = async (id: string) => { setExecuting(id); try { await executeWorkflow(id); toast.success('执行完成') } catch { toast.error('执行失败') } finally { setExecuting(null) } }
  const handleDel = async (id: string, name: string) => { if (!confirm(`删除「${name}」？`)) return; try { await deleteWorkflow(id); toast.success('已删除'); load() } catch {} }
  const handleClearAll = async () => {
    if (!confirm('确定清空所有工作流？此操作不可恢复，执行记录也会一并删除。')) return
    try { const r: any = await clearAllWorkflows(); toast.success(`已清空 ${r.deleted || 0} 个工作流`); setStats(null); load() } catch { toast.error('清空失败') }
  }

  if (loading) return <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-muted)' }}>加载中...</div>

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-lg font-bold">工作流</h1><p className="text-xs" style={{ color: 'var(--text-muted)' }}>自动化任务编排</p></div>
        <div className="flex gap-2">
          {wfs.length > 0 && <button onClick={handleClearAll} className="text-xs px-3 py-1.5 rounded-lg hover:bg-[#ef444410]"
            style={{ color: '#ef4444', border: '1px solid #ef444430' }}>清空工作流</button>}
          <button onClick={load} className="p-2 rounded-lg hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}><RefreshCw size={16} /></button>
          <button onClick={() => setShowAI(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm"
            style={{ color: 'var(--accent)', border: '1px solid var(--accent)40', background: 'var(--accent)08' }}>
            <Sparkles size={14} /> AI 生成
          </button>
          <button onClick={handleCreate} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-white" style={{ background: 'var(--accent)' }}><Plus size={14} /> 新建</button>
        </div>
      </div>
      {stats && stats.total_executions > 0 && wfs.length > 0 && (
        <div className="flex gap-3 mb-6">
          {[{ label: '总执行', value: stats.total_executions, icon: BarChart3, color: 'var(--text)' },
            { label: '成功率', value: `${stats.success_rate}%`, icon: CheckCircle, color: '#22c55e' },
            { label: '失败', value: stats.failed, icon: XCircle, color: '#ef4444' },
            { label: '平均耗时', value: `${stats.avg_duration}s`, icon: Clock, color: 'var(--accent)' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-lg flex-1"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <Icon size={18} style={{ color }} />
              <div><div className="text-lg font-bold" style={{ color }}>{value}</div>
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</div></div>
            </div>
          ))}
        </div>
      )}
      {wfs.length === 0 ? (
        <div className="text-center py-12"><Zap size={48} className="mx-auto mb-4" style={{ color: 'var(--border)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>暂无工作流，点击"新建"创建</p></div>
      ) : (
        <div className="space-y-3">{wfs.map(wf => (
          <div key={wf.id} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <Zap size={18} style={{ color: 'var(--accent)' }} />
            <div className="flex-1 min-w-0"><h3 className="text-sm font-medium truncate">{wf.name}</h3>
              <div className="flex items-center gap-2">
                {wf.description && <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{wf.description}</p>}
                {wf.created_by && <span className="text-[9px] px-1.5 py-0.5 rounded shrink-0" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>@{wf.created_by.slice(0, 8)}</span>}
              </div></div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => navigate(`/workflows/${wf.id}`)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs hover:bg-[var(--bg-hover)]"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}><Edit3 size={12} /> 编辑</button>
              <button onClick={() => handleExec(wf.id)} disabled={executing === wf.id} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-white"
                style={{ background: executing === wf.id ? 'var(--border)' : 'var(--accent)' }}><Play size={12} /> {executing === wf.id ? '...' : '执行'}</button>
              <button onClick={() => handleDel(wf.id, wf.name)} className="p-1.5 rounded hover:text-[var(--error)]" style={{ color: 'var(--text-muted)' }}><Trash2 size={14} /></button>
            </div>
          </div>))}</div>
      )}

      {showAI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => !aiLoading && setShowAI(false)}>
          <div className="w-full max-w-lg mx-4 rounded-2xl p-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles size={18} style={{ color: 'var(--accent)' }} />
                <h3 className="text-sm font-bold">AI 生成工作流</h3>
              </div>
              <button onClick={() => !aiLoading && setShowAI(false)} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>
            <textarea
              value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              placeholder={"描述你想要的工作流，例如：\n\n• 每天早上9点抓取竞品官网，用AI总结变化，发到飞书群\n• 收到 webhook 后解析数据，如果金额>1000 发邮件通知，否则记录到数据库\n• 手动触发，读取 Excel 文件，逐行调用 API 处理，合并结果生成报告"}
              className="w-full h-36 px-4 py-3 rounded-xl text-sm resize-none outline-none"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
              disabled={aiLoading}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAIGenerate() }}
            />
            <div className="flex items-center justify-between mt-4">
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Ctrl+Enter 发送</span>
              <button onClick={handleAIGenerate} disabled={aiLoading || !aiPrompt.trim()}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm text-white transition-opacity"
                style={{ background: 'var(--accent)', opacity: aiLoading || !aiPrompt.trim() ? 0.5 : 1 }}>
                {aiLoading ? (
                  <><span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> AI 正在设计...</>
                ) : (
                  <><Sparkles size={14} /> 生成工作流</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
