import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, Play, Trash2, RefreshCw, Plus, Edit3 } from 'lucide-react'
import { listWorkflows, createWorkflow, deleteWorkflow, executeWorkflow } from '../api/workflow'
import toast from 'react-hot-toast'

const TPLS = [
  { name: '每日数据汇总报告', desc: '定时 → 查询 → AI摘要 → 邮件', icon: '📊',
    nodes: [{ id: 't1', type: 'scheduleTrigger', label: '每天9点', config: { cron: '0 9 * * *' }, position: { x: 0, y: 200 } },
      { id: 'n1', type: 'database', label: '查询数据', config: { dbType: 'sqlite', query: 'SELECT * FROM missions LIMIT 50' }, position: { x: 250, y: 200 } },
      { id: 'n2', type: 'ai', label: 'AI摘要', config: { operation: 'summarize', maxLength: 500 }, position: { x: 500, y: 200 } },
      { id: 'n3', type: 'email', label: '发送报告', config: { to: '', subject: '每日汇总', body: '{{ $input.summary }}' }, position: { x: 750, y: 200 } }],
    edges: [{ source: 't1', target: 'n1' }, { source: 'n1', target: 'n2' }, { source: 'n2', target: 'n3' }] },
  { name: '竞品监控 → AI分析 → 飞书', desc: '抓取网页 → AI分析 → 飞书通知', icon: '🔍',
    nodes: [{ id: 't1', type: 'scheduleTrigger', label: '每天10点', config: { cron: '0 10 * * *' }, position: { x: 0, y: 200 } },
      { id: 'n1', type: 'scraper', label: '抓取', config: { url: '', extract: 'text' }, position: { x: 250, y: 200 } },
      { id: 'n2', type: 'ai', label: 'AI分析', config: { operation: 'generate', prompt: '分析变化：\n{{ $input.text }}' }, position: { x: 500, y: 200 } },
      { id: 'n3', type: 'feishu', label: '飞书通知', config: { webhookUrl: '', msgType: 'markdown', content: '## 监控报告\n{{ $input.ai_result }}' }, position: { x: 750, y: 200 } }],
    edges: [{ source: 't1', target: 'n1' }, { source: 'n1', target: 'n2' }, { source: 'n2', target: 'n3' }] },
  { name: '客户反馈分类处理', desc: 'Webhook → AI分类 → 按类型路由', icon: '📋',
    nodes: [{ id: 't1', type: 'webhookTrigger', label: 'Webhook', config: {}, position: { x: 0, y: 200 } },
      { id: 'n1', type: 'ai', label: 'AI分类', config: { operation: 'classify', categories: '产品建议, 技术问题, 投诉' }, position: { x: 250, y: 200 } },
      { id: 'n2', type: 'switch', label: '分发', config: { mode: 'value', routeField: 'category', routeValues: '产品建议, 技术问题, 投诉' }, position: { x: 500, y: 200 } },
      { id: 'n3', type: 'notification', label: '通知产品', config: { title: '产品建议', message: '{{ $input.text }}' }, position: { x: 750, y: 100 } },
      { id: 'n4', type: 'notification', label: '通知技术', config: { title: '技术问题', message: '{{ $input.text }}' }, position: { x: 750, y: 300 } }],
    edges: [{ source: 't1', target: 'n1' }, { source: 'n1', target: 'n2' }, { source: 'n2', target: 'n3', sourceOutput: 0 }, { source: 'n2', target: 'n4', sourceOutput: 1 }] },
  { name: '文档审批流程', desc: 'AI生成 → Word → 审批 → 通知', icon: '📄',
    nodes: [{ id: 't1', type: 'manualTrigger', label: '启动', config: {}, position: { x: 0, y: 200 } },
      { id: 'n1', type: 'ai', label: 'AI生成', config: { operation: 'generate', prompt: '生成报告：{{ $input.text }}' }, position: { x: 250, y: 200 } },
      { id: 'n2', type: 'document', label: 'Word', config: { action: 'create_word', title: '报告' }, position: { x: 500, y: 200 } },
      { id: 'n3', type: 'approval', label: '审批', config: { message: '请审批', autoApprove: true }, position: { x: 750, y: 200 } },
      { id: 'n4', type: 'notification', label: '通过', config: { title: '已通过' }, position: { x: 1000, y: 150 } },
      { id: 'n5', type: 'notification', label: '拒绝', config: { title: '被拒绝' }, position: { x: 1000, y: 300 } }],
    edges: [{ source: 't1', target: 'n1' }, { source: 'n1', target: 'n2' }, { source: 'n2', target: 'n3' }, { source: 'n3', target: 'n4', sourceOutput: 0 }, { source: 'n3', target: 'n5', sourceOutput: 1 }] },
  { name: 'Excel 批处理', desc: '读取 → 循环 → AI分析 → 写入', icon: '📈',
    nodes: [{ id: 't1', type: 'manualTrigger', label: '启动', config: {}, position: { x: 0, y: 200 } },
      { id: 'n1', type: 'excel', label: '读取', config: { action: 'read', path: 'data/input.xlsx' }, position: { x: 250, y: 200 } },
      { id: 'n2', type: 'loop', label: '逐行', config: {}, position: { x: 500, y: 200 } },
      { id: 'n3', type: 'ai', label: 'AI分析', config: { operation: 'generate', prompt: '分析：{{ $input.text }}' }, position: { x: 750, y: 200 } },
      { id: 'n4', type: 'excel', label: '写入', config: { action: 'create', path: 'data/outputs/result.xlsx' }, position: { x: 1000, y: 200 } }],
    edges: [{ source: 't1', target: 'n1' }, { source: 'n1', target: 'n2' }, { source: 'n2', target: 'n3' }, { source: 'n3', target: 'n4' }] },
]

export default function Workflows() {
  const [wfs, setWfs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState<string | null>(null)
  const [showTpls, setShowTpls] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { load() }, [])
  useEffect(() => { if (!loading && wfs.length === 0) setShowTpls(true) }, [loading, wfs])
  const load = async () => { setLoading(true); try { const d: any = await listWorkflows(); setWfs(Array.isArray(d) ? d : d.workflows || []) } catch {} finally { setLoading(false) } }

  const handleCreate = async () => {
    try { const r = await createWorkflow({ name: `工作流 ${new Date().toLocaleTimeString('zh-CN')}`, description: '',
      nodes: [{ id: 'trigger_1', type: 'manualTrigger', label: '手动触发', config: {}, position: { x: 250, y: 200 } }], edges: [] })
      if (r.id) navigate(`/workflows/${r.id}`)
    } catch { toast.error('创建失败') }
  }
  const handleExec = async (id: string) => { setExecuting(id); try { await executeWorkflow(id); toast.success('执行完成') } catch { toast.error('执行失败') } finally { setExecuting(null) } }
  const handleDel = async (id: string, name: string) => { if (!confirm(`删除「${name}」？`)) return; try { await deleteWorkflow(id); toast.success('已删除'); load() } catch {} }
  const importTpl = async (tpl: typeof TPLS[0]) => { try { const r = await createWorkflow({ name: tpl.name, description: tpl.desc, nodes: tpl.nodes, edges: tpl.edges })
    if (r.id) { toast.success('模板导入成功'); navigate(`/workflows/${r.id}`) } } catch { toast.error('导入失败') } }

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
        <div className="text-center py-12"><Zap size={48} className="mx-auto mb-4" style={{ color: 'var(--border)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>暂无工作流，从模板开始或点击"新建"</p></div>
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

      {/* Templates */}
      <div className="mt-8">
        <button onClick={() => setShowTpls(!showTpls)} className="flex items-center gap-2 text-sm font-medium mb-4" style={{ color: 'var(--text-muted)' }}>
          <span>{showTpls ? '▼' : '▶'}</span> 模板库
          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>{TPLS.length}</span>
        </button>
        {showTpls && <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TPLS.map((tpl, i) => (
            <div key={i} onClick={() => importTpl(tpl)} className="flex items-start gap-3 p-4 rounded-xl cursor-pointer hover:border-[var(--accent)]"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <span className="text-2xl">{tpl.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium mb-0.5" style={{ color: 'var(--text)' }}>{tpl.name}</div>
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{tpl.desc}</div>
                <span className="text-[9px] px-1.5 py-0.5 rounded mt-1.5 inline-block" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>{tpl.nodes.length} 节点</span>
              </div>
            </div>))}
        </div>}
      </div>
    </div>
  )
}
