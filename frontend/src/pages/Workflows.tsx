import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, Play, Trash2, RefreshCw, Plus, Edit3, BarChart3, CheckCircle, XCircle, Clock } from 'lucide-react'
import { listWorkflows, createWorkflow, deleteWorkflow, executeWorkflow, getWorkflowStats } from '../api/workflow'
import toast from 'react-hot-toast'

const TPLS = [
  { name: '每日数据汇总报告', desc: '定时 → 查询 → AI摘要 → 邮件', icon: '📊',
    nodes: [
      { id: 't1', type: 'scheduleTrigger', label: '每天9点', config: { cron: '0 9 * * *' }, position: { x: 0, y: 200 } },
      { id: 'n1', type: 'database', label: '查询数据', config: { dbType: 'sqlite', query: 'SELECT * FROM missions LIMIT 50' }, position: { x: 250, y: 200 } },
      { id: 'n2', type: 'ai', label: 'AI摘要', config: { operation: 'summarize', maxLength: 500 }, position: { x: 500, y: 200 } },
      { id: 'n3', type: 'email', label: '发送报告', config: { to: '', subject: '每日汇总', body: '{{ $input.summary }}' }, position: { x: 750, y: 200 } },
    ],
    edges: [{ source: 't1', target: 'n1' }, { source: 'n1', target: 'n2' }, { source: 'n2', target: 'n3' }] },
  { name: '竞品监控 → AI分析 → 飞书', desc: '抓取 → AI → 飞书通知', icon: '🔍',
    nodes: [
      { id: 't1', type: 'scheduleTrigger', label: '每天10点', config: { cron: '0 10 * * *' }, position: { x: 0, y: 200 } },
      { id: 'n1', type: 'scraper', label: '抓取', config: { url: '', extract: 'text' }, position: { x: 250, y: 200 } },
      { id: 'n2', type: 'ai', label: 'AI分析', config: { operation: 'generate', prompt: '分析：{{ $input.text }}' }, position: { x: 500, y: 200 } },
      { id: 'n3', type: 'feishu', label: '飞书', config: { webhookUrl: '', content: '{{ $input.ai_result }}' }, position: { x: 750, y: 200 } },
    ],
    edges: [{ source: 't1', target: 'n1' }, { source: 'n1', target: 'n2' }, { source: 'n2', target: 'n3' }] },
  { name: '[测试] T1-1 代码节点', desc: 'import + result 输出', icon: '🧪',
    nodes: [
      { id: 't1', type: 'manualTrigger', label: '触发', config: {}, position: { x: 0, y: 200 } },
      { id: 'n1', type: 'code', label: '代码验证', position: { x: 250, y: 200 }, config: { code: 'import hashlib, math\nresult = {"hash": hashlib.md5(b"test").hexdigest()[:8], "sqrt2": round(math.sqrt(2),4), "status": "passed"}' } },
    ],
    edges: [{ source: 't1', target: 'n1' }] },
  { name: '[测试] T1-2 IF 条件', desc: 'score>60 分支', icon: '🧪',
    nodes: [
      { id: 't1', type: 'manualTrigger', label: '传score', config: {}, position: { x: 0, y: 200 } },
      { id: 'n1', type: 'if', label: 'score>60', position: { x: 250, y: 200 }, config: { mode: 'rules', conditions: JSON.stringify({ combineMode: 'AND', rules: [{ field: 'score', operator: 'gt', value: '60' }] }) } },
      { id: 'n2', type: 'notification', label: '通过✅', config: { title: '通过' }, position: { x: 500, y: 100 } },
      { id: 'n3', type: 'notification', label: '未通过❌', config: { title: '未通过' }, position: { x: 500, y: 320 } },
    ],
    edges: [{ source: 't1', target: 'n1' }, { source: 'n1', target: 'n2', sourceOutput: 0 }, { source: 'n1', target: 'n3', sourceOutput: 1 }] },
  { name: '[测试] T1-3 Switch', desc: '按type多路分发', icon: '🧪',
    nodes: [
      { id: 't1', type: 'manualTrigger', label: '传type', config: {}, position: { x: 0, y: 200 } },
      { id: 'n1', type: 'switch', label: '按type', position: { x: 250, y: 200 }, config: { mode: 'value', routeField: 'type', routeValues: 'A,B,C' } },
      { id: 'n2', type: 'notification', label: 'A', config: { title: 'A' }, position: { x: 500, y: 80 } },
      { id: 'n3', type: 'notification', label: 'B', config: { title: 'B' }, position: { x: 500, y: 200 } },
      { id: 'n4', type: 'notification', label: 'C', config: { title: 'C' }, position: { x: 500, y: 320 } },
      { id: 'n5', type: 'notification', label: '兜底', config: { title: '未匹配' }, position: { x: 500, y: 440 } },
    ],
    edges: [{ source: 't1', target: 'n1' }, { source: 'n1', target: 'n2', sourceOutput: 0 }, { source: 'n1', target: 'n3', sourceOutput: 1 }, { source: 'n1', target: 'n4', sourceOutput: 2 }, { source: 'n1', target: 'n5', sourceOutput: 3 }] },
  { name: '[测试] T1-4 KV存储', desc: 'set/get/delete', icon: '🧪',
    nodes: [
      { id: 't1', type: 'manualTrigger', label: '开始', config: {}, position: { x: 0, y: 200 } },
      { id: 'n1', type: 'kvStore', label: '写入', config: { action: 'set', key: 'test:001', value: '{"ok":true}', scope: 'global' }, position: { x: 200, y: 200 } },
      { id: 'n2', type: 'kvStore', label: '读取', config: { action: 'get', key: 'test:001', scope: 'global' }, position: { x: 400, y: 200 } },
      { id: 'n3', type: 'kvStore', label: '删除', config: { action: 'delete', key: 'test:001', scope: 'global' }, position: { x: 600, y: 200 } },
    ],
    edges: [{ source: 't1', target: 'n1' }, { source: 'n1', target: 'n2' }, { source: 'n2', target: 'n3' }] },
  { name: '[测试] T1-5 HTTP', desc: 'GET httpbin', icon: '🧪',
    nodes: [
      { id: 't1', type: 'manualTrigger', label: '开始', config: {}, position: { x: 0, y: 200 } },
      { id: 'n1', type: 'http', label: 'GET', config: { method: 'GET', url: 'https://httpbin.org/get', timeout: 15 }, position: { x: 250, y: 200 } },
      { id: 'n2', type: 'notification', label: '结果', config: { title: 'HTTP', message: 'ok={{ $input.ok }}' }, position: { x: 500, y: 200 } },
    ],
    edges: [{ source: 't1', target: 'n1' }, { source: 'n1', target: 'n2' }] },
  { name: '[测试] T2-1 数据处理链', desc: '生成→转换→条件→通知', icon: '🔗',
    nodes: [
      { id: 't1', type: 'manualTrigger', label: '开始', config: {}, position: { x: 0, y: 200 } },
      { id: 'n1', type: 'code', label: '生成', position: { x: 200, y: 200 }, config: { code: 'result = {"items":[{"name":"Alice","score":88},{"name":"Bob","score":55}]}' } },
      { id: 'n2', type: 'transform', label: '过滤>=80', position: { x: 400, y: 200 }, config: { filter: '$input.score >= 80' } },
      { id: 'n3', type: 'if', label: '有结果?', position: { x: 600, y: 200 }, config: { mode: 'expression', expression: '$input.count > 0' } },
      { id: 'n4', type: 'notification', label: '有✅', config: { title: '有优秀' }, position: { x: 800, y: 100 } },
      { id: 'n5', type: 'notification', label: '无', config: { title: '无人达标' }, position: { x: 800, y: 320 } },
    ],
    edges: [{ source: 't1', target: 'n1' }, { source: 'n1', target: 'n2' }, { source: 'n2', target: 'n3' }, { source: 'n3', target: 'n4', sourceOutput: 0 }, { source: 'n3', target: 'n5', sourceOutput: 1 }] },
  { name: '[测试] T2-2 延时合并', desc: '两路→延时→合并', icon: '🔗',
    nodes: [
      { id: 't1', type: 'manualTrigger', label: '开始', config: {}, position: { x: 0, y: 200 } },
      { id: 'n1', type: 'code', label: 'A路', position: { x: 220, y: 100 }, config: { code: 'result = {"source":"A","value":100}' } },
      { id: 'n2', type: 'code', label: 'B路', position: { x: 220, y: 320 }, config: { code: 'result = {"source":"B","value":200}' } },
      { id: 'n3', type: 'delay', label: '等2秒', config: { seconds: 2 }, position: { x: 440, y: 100 } },
      { id: 'n4', type: 'merge', label: '合并', config: { mode: 'combine' }, position: { x: 660, y: 200 } },
      { id: 'n5', type: 'notification', label: '完成', config: { title: '合并完成' }, position: { x: 880, y: 200 } },
    ],
    edges: [{ source: 't1', target: 'n1' }, { source: 't1', target: 'n2' }, { source: 'n1', target: 'n3' }, { source: 'n3', target: 'n4' }, { source: 'n2', target: 'n4' }, { source: 'n4', target: 'n5' }] },
  { name: '[测试] T3-1 告警路由', desc: '级别判断→高优KV+通知/低优记录', icon: '🏭',
    nodes: [
      { id: 't1', type: 'manualTrigger', label: '传level+msg', config: {}, position: { x: 0, y: 220 } },
      { id: 'n1', type: 'code', label: '解析', position: { x: 220, y: 220 }, config: { code: 'result={"level":input_data.get("level","low"),"message":input_data.get("msg","告警"),"is_high":input_data.get("level","low") in ("high","critical")}' } },
      { id: 'n2', type: 'if', label: '高优?', position: { x: 440, y: 220 }, config: { mode: 'expression', expression: '$input.is_high' } },
      { id: 'n3', type: 'kvStore', label: '写KV', config: { action: 'set', key: 'alert:latest', scope: 'global' }, position: { x: 660, y: 100 } },
      { id: 'n4', type: 'notification', label: '🚨高优', config: { title: '高优告警', message: '{{ $input.message }}' }, position: { x: 880, y: 100 } },
      { id: 'n5', type: 'notification', label: '📝低优', config: { title: '已记录', message: '{{ $input.message }}' }, position: { x: 660, y: 360 } },
    ],
    edges: [{ source: 't1', target: 'n1' }, { source: 'n1', target: 'n2' }, { source: 'n2', target: 'n3', sourceOutput: 0 }, { source: 'n3', target: 'n4' }, { source: 'n2', target: 'n5', sourceOutput: 1 }] },
  { name: '[测试] T3-2 HTTP+AI摘要', desc: '抓取→AI摘要→缓存→通知', icon: '🏭',
    nodes: [
      { id: 't1', type: 'manualTrigger', label: '开始', config: {}, position: { x: 0, y: 200 } },
      { id: 'n1', type: 'http', label: 'GET', config: { method: 'GET', url: 'https://httpbin.org/json', timeout: 15 }, position: { x: 220, y: 200 } },
      { id: 'n2', type: 'ai', label: 'AI摘要', position: { x: 440, y: 200 }, config: { operation: 'summarize', maxLength: 100 } },
      { id: 'n3', type: 'kvStore', label: '缓存', config: { action: 'set', key: 'cache:summary', scope: 'global' }, position: { x: 660, y: 200 } },
      { id: 'n4', type: 'notification', label: '完成', config: { title: 'HTTP+AI完成' }, position: { x: 880, y: 200 } },
    ],
    edges: [{ source: 't1', target: 'n1' }, { source: 'n1', target: 'n2' }, { source: 'n2', target: 'n3' }, { source: 'n3', target: 'n4' }] },
  { name: '[测试] T3-3 审批流', desc: 'AI生成→审批(auto)→两路通知', icon: '🏭',
    nodes: [
      { id: 't1', type: 'manualTrigger', label: '传title', config: {}, position: { x: 0, y: 220 } },
      { id: 'n1', type: 'ai', label: 'AI生成', position: { x: 220, y: 220 }, config: { operation: 'generate', prompt: '为以下标题写100字说明：{{ $input.title }}' } },
      { id: 'n2', type: 'approval', label: '审批', position: { x: 440, y: 220 }, config: { title: '审批', autoApprove: true } },
      { id: 'n3', type: 'notification', label: '通过✅', config: { title: '已通过' }, position: { x: 660, y: 100 } },
      { id: 'n4', type: 'notification', label: '拒绝❌', config: { title: '被拒绝' }, position: { x: 660, y: 360 } },
    ],
    edges: [{ source: 't1', target: 'n1' }, { source: 'n1', target: 'n2' }, { source: 'n2', target: 'n3', sourceOutput: 0 }, { source: 'n2', target: 'n4', sourceOutput: 1 }] },
]

export default function Workflows() {
  const [wfs, setWfs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState<string | null>(null)
  const [showTpls, setShowTpls] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const navigate = useNavigate()

  useEffect(() => { load(); getWorkflowStats(7).then(setStats).catch(() => {}) }, [])
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
      {stats && stats.total_executions > 0 && (
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
