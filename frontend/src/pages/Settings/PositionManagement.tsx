import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../stores/useAuthStore'
import {
  fetchPositions, fetchPosition, createPosition, updatePosition, deletePosition,
  type PositionDetail, type QuickWorkflowConfig, type DashboardMetric,
} from '../../api/positions'

// ── 空模板 ──

const EMPTY_POSITION: PositionDetail = {
  position_id: '', display_name: '', icon: 'briefcase', color: '#6366f1',
  department: '', domain: '', description: '',
  role: '', goal: '', context: '',
  default_model: 'sonnet', complex_model: 'opus',
  tools: [], quick_workflows: [], dashboard_metrics: [], knowledge_scope: [],
}

const EMPTY_WORKFLOW: QuickWorkflowConfig = {
  id: '', name: '', description: '', icon: 'zap',
  trigger: 'manual', schedule: '', workflow_ref: '', keywords: [], default_params: {},
}

const EMPTY_METRIC: DashboardMetric = {
  key: '', name: '', unit: '', target: '', direction: '',
}

const MODEL_OPTIONS = ['sonnet', 'opus', 'haiku']

const AVAILABLE_TOOLS = [
  'data_analysis', 'excel_processor', 'text_processor', 'calculator',
  'web_search', 'http_request', 'code_executor', 'email_sender',
  'ppt_generator', 'word_generator', 'pdf_reader', 'image_generator',
  'file_manager', 'json_processor', 'csv_processor', 'translator', 'summarizer',
]

// ── Tag Input ──

function TagInput({ value, onChange, placeholder }: {
  value: string[]; onChange: (v: string[]) => void; placeholder?: string
}) {
  const [input, setInput] = useState('')
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault()
      if (!value.includes(input.trim())) {
        onChange([...value, input.trim()])
      }
      setInput('')
    }
  }
  return (
    <div className="flex flex-wrap gap-1.5 p-2 border border-border rounded-lg bg-bg min-h-[38px]">
      {value.map((tag, i) => (
        <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-md">
          {tag}
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="hover:text-red-500">
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
        placeholder={value.length === 0 ? placeholder : ''} className="flex-1 min-w-[120px] bg-transparent text-sm outline-none"
      />
    </div>
  )
}

// ── 表单区块 ──

function Section({ title, children, collapsible, defaultOpen = true }: {
  title: string; children: React.ReactNode; collapsible?: boolean; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-border rounded-lg">
      <button
        type="button"
        onClick={() => collapsible && setOpen(!open)}
        className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-text ${collapsible ? 'cursor-pointer hover:bg-surface-hover' : 'cursor-default'}`}
      >
        {title}
        {collapsible && (open ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  )
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-sm text-text-muted">{label}</span>
      {hint && <span className="text-xs text-text-muted/60 ml-2">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  )
}

const inputCls = "w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg focus:outline-none focus:ring-1 focus:ring-primary"
const textareaCls = `${inputCls} resize-y min-h-[80px]`

// ── 岗位表单 ──

function PositionForm({ position, isNew, onSave, onCancel }: {
  position: PositionDetail; isNew: boolean; onSave: (p: PositionDetail) => Promise<void>; onCancel: () => void
}) {
  const [form, setForm] = useState<PositionDetail>({ ...position })
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof PositionDetail>(key: K, val: PositionDetail[K]) =>
    setForm(prev => ({ ...prev, [key]: val }))

  const handleSubmit = async () => {
    if (!form.display_name.trim()) { toast.error('岗位名称不能为空'); return }
    if (isNew && !form.position_id.trim()) { toast.error('岗位ID不能为空'); return }
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  // ── Workflow 子表单 ──
  const setWf = (idx: number, patch: Partial<QuickWorkflowConfig>) =>
    set('quick_workflows', form.quick_workflows.map((w, i) => i === idx ? { ...w, ...patch } : w))
  const addWf = () => set('quick_workflows', [...form.quick_workflows, { ...EMPTY_WORKFLOW }])
  const removeWf = (idx: number) => set('quick_workflows', form.quick_workflows.filter((_, i) => i !== idx))

  // ── Metric 子表单 ──
  const setMetric = (idx: number, patch: Partial<DashboardMetric>) =>
    set('dashboard_metrics', form.dashboard_metrics.map((m, i) => i === idx ? { ...m, ...patch } : m))
  const addMetric = () => set('dashboard_metrics', [...form.dashboard_metrics, { ...EMPTY_METRIC }])
  const removeMetric = (idx: number) => set('dashboard_metrics', form.dashboard_metrics.filter((_, i) => i !== idx))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{isNew ? '新建岗位' : `编辑: ${form.display_name}`}</h3>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-surface-hover">取消</button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-4 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {/* 基本信息 */}
      <Section title="基本信息">
        <div className="grid grid-cols-2 gap-3">
          <Field label="岗位ID" hint={isNew ? '小写字母+数字+连字符' : '不可修改'}>
            <input value={form.position_id} onChange={e => set('position_id', e.target.value)}
              disabled={!isNew} className={`${inputCls} ${!isNew ? 'opacity-60' : ''}`} placeholder="e.g. data-analyst" />
          </Field>
          <Field label="岗位名称">
            <input value={form.display_name} onChange={e => set('display_name', e.target.value)} className={inputCls} placeholder="e.g. 数据分析师" />
          </Field>
          <Field label="部门">
            <input value={form.department} onChange={e => set('department', e.target.value)} className={inputCls} />
          </Field>
          <Field label="业务域">
            <input value={form.domain} onChange={e => set('domain', e.target.value)} className={inputCls} />
          </Field>
          <Field label="图标">
            <input value={form.icon} onChange={e => set('icon', e.target.value)} className={inputCls} placeholder="lucide icon name" />
          </Field>
          <Field label="颜色">
            <div className="flex gap-2 items-center">
              <input type="color" value={form.color} onChange={e => set('color', e.target.value)} className="w-10 h-10 rounded border border-border cursor-pointer" />
              <input value={form.color} onChange={e => set('color', e.target.value)} className={inputCls} />
            </div>
          </Field>
        </div>
        <Field label="简短描述">
          <textarea value={form.description} onChange={e => set('description', e.target.value)} className={textareaCls} rows={2} />
        </Field>
      </Section>

      {/* 核心三要素 */}
      <Section title="核心三要素 (驱动 LLM 输出质量)">
        <Field label="Role (角色定位)" hint="你是...的AI助手">
          <textarea value={form.role} onChange={e => set('role', e.target.value)} className={textareaCls} rows={3} placeholder="你是一位..." />
        </Field>
        <Field label="Goal (工作目标)" hint="你的目标是...">
          <textarea value={form.goal} onChange={e => set('goal', e.target.value)} className={textareaCls} rows={2} placeholder="确保..." />
        </Field>
        <Field label="Context (背景约束)" hint="工作原则、领域知识、注意事项">
          <textarea value={form.context} onChange={e => set('context', e.target.value)} className={`${inputCls} resize-y min-h-[120px]`} rows={6} placeholder="你的工作领域：&#10;- ...&#10;&#10;工作原则：&#10;1. ..." />
        </Field>
      </Section>

      {/* 模型配置 */}
      <Section title="模型配置">
        <div className="grid grid-cols-2 gap-3">
          <Field label="默认模型">
            <select value={form.default_model} onChange={e => set('default_model', e.target.value)} className={inputCls}>
              {MODEL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="复杂任务模型">
            <select value={form.complex_model} onChange={e => set('complex_model', e.target.value)} className={inputCls}>
              {MODEL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      {/* 工具 */}
      <Section title="可用工具" collapsible>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {AVAILABLE_TOOLS.map(tool => (
            <label key={tool} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.tools.includes(tool)}
                onChange={e => set('tools', e.target.checked ? [...form.tools, tool] : form.tools.filter(t => t !== tool))}
                className="rounded border-border" />
              <span className="truncate">{tool}</span>
            </label>
          ))}
        </div>
      </Section>

      {/* 知识范围 */}
      <Section title="知识范围" collapsible>
        <TagInput value={form.knowledge_scope} onChange={v => set('knowledge_scope', v)} placeholder="输入知识标签后按 Enter" />
      </Section>

      {/* 看板指标 */}
      <Section title={`看板指标 (${form.dashboard_metrics.length})`} collapsible defaultOpen={false}>
        {form.dashboard_metrics.map((m, idx) => (
          <div key={idx} className="border border-border/50 rounded-lg p-2.5 bg-bg/50 space-y-2">
            {/* 基本信息行 */}
            <div className="flex items-end gap-2">
              <Field label="Key"><input value={m.key} onChange={e => setMetric(idx, { key: e.target.value })} className={inputCls} /></Field>
              <Field label="名称"><input value={m.name} onChange={e => setMetric(idx, { name: e.target.value })} className={inputCls} /></Field>
              <Field label="单位"><input value={m.unit} onChange={e => setMetric(idx, { unit: e.target.value })} className={`${inputCls} w-20`} /></Field>
              <Field label="目标"><input value={m.target} onChange={e => setMetric(idx, { target: e.target.value })} className={`${inputCls} w-24`} placeholder=">90" /></Field>
              <Field label="方向">
                <select value={m.direction} onChange={e => setMetric(idx, { direction: e.target.value as DashboardMetric['direction'] })} className={inputCls}>
                  <option value="">-</option><option value="higher_is_better">越高越好</option><option value="lower_is_better">越低越好</option>
                </select>
              </Field>
              <button type="button" onClick={() => removeMetric(idx)} className="text-red-500 hover:text-red-700 mb-2"><Trash2 size={14} /></button>
            </div>
            {/* 数据来源行 */}
            <div className="flex items-end gap-2 pl-1">
              <Field label="数据来源">
                <select
                  value={m.source?.type || 'manual'}
                  onChange={e => setMetric(idx, { source: { ...m.source, type: e.target.value as 'manual' | 'computed' | 'api' } })}
                  className={`${inputCls} w-28`}
                >
                  <option value="manual">手动录入</option>
                  <option value="computed">系统计算</option>
                  <option value="api">外部 API</option>
                </select>
              </Field>
              {m.source?.type === 'api' && (
                <>
                  <Field label="连接器名称">
                    <input value={m.source?.endpoint || ''} onChange={e => setMetric(idx, { source: { ...m.source!, endpoint: e.target.value } })} className={inputCls} placeholder="如 bi-system" />
                  </Field>
                  <Field label="查询路径">
                    <input value={m.source?.query || ''} onChange={e => setMetric(idx, { source: { ...m.source!, query: e.target.value } })} className={inputCls} placeholder="/metrics/revenue" />
                  </Field>
                  <Field label="值路径">
                    <input value={m.source?.value_path || ''} onChange={e => setMetric(idx, { source: { ...m.source!, value_path: e.target.value } })} className={`${inputCls} w-28`} placeholder="data.value" />
                  </Field>
                  <Field label="刷新频率">
                    <select value={m.source?.refresh || '1h'} onChange={e => setMetric(idx, { source: { ...m.source!, refresh: e.target.value } })} className={`${inputCls} w-20`}>
                      <option value="5m">5分钟</option>
                      <option value="15m">15分钟</option>
                      <option value="30m">30分钟</option>
                      <option value="1h">1小时</option>
                      <option value="6h">6小时</option>
                      <option value="1d">每天</option>
                    </select>
                  </Field>
                </>
              )}
            </div>
          </div>
        ))}
        <button type="button" onClick={addMetric} className="flex items-center gap-1 text-sm text-primary hover:text-primary/80">
          <Plus size={14} /> 添加指标
        </button>
      </Section>
    </div>
  )
}

// ── 主组件 ──

export default function PositionManagement() {
  const currentUser = useAuthStore(s => s.user)
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin'

  return isAdmin ? <AdminPositionList /> : <UserPositionEditor />
}

// ── 管理员模式：全部岗位列表管理 ──

function AdminPositionList() {
  const [positions, setPositions] = useState<PositionDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<PositionDetail | null>(null)
  const [isNew, setIsNew] = useState(false)

  const loadPositions = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetchPositions()
      setPositions(res.positions || [])
    } catch (e: any) {
      toast.error('加载岗位列表失败: ' + (e.message || e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPositions() }, [loadPositions])

  const handleCreate = () => {
    setEditing({ ...EMPTY_POSITION })
    setIsNew(true)
  }

  const handleEdit = (p: PositionDetail) => {
    setEditing({ ...p })
    setIsNew(false)
  }

  const handleDelete = async (p: PositionDetail) => {
    if (!confirm(`确认删除岗位「${p.display_name}」？此操作不可撤销。`)) return
    try {
      await deletePosition(p.position_id)
      toast.success('已删除')
      loadPositions()
    } catch (e: any) {
      toast.error('删除失败: ' + (e.message || e))
    }
  }

  const handleSave = async (form: PositionDetail) => {
    try {
      if (isNew) {
        await createPosition(form)
        toast.success('岗位已创建')
      } else {
        await updatePosition(form.position_id, form)
        toast.success('岗位已更新')
      }
      setEditing(null)
      loadPositions()
    } catch (e: any) {
      toast.error('保存失败: ' + (e.message || e))
    }
  }

  if (editing) {
    return <PositionForm position={editing} isNew={isNew} onSave={handleSave} onCancel={() => setEditing(null)} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">岗位管理</h3>
          <p className="text-sm text-text-muted mt-0.5">管理岗位模板的 AI 身份、工具、工作流等配置</p>
        </div>
        <button onClick={handleCreate} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">
          <Plus size={14} /> 新建岗位
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-text-muted">加载中...</div>
      ) : positions.length === 0 ? (
        <div className="text-center py-12 text-text-muted">暂无岗位，点击上方按钮创建</div>
      ) : (
        <div className="grid gap-3">
          {positions.map(p => (
            <div key={p.position_id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-surface-hover/50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg shrink-0" style={{ backgroundColor: p.color }}>
                  {p.icon === 'briefcase' ? '💼' : p.display_name[0]}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.display_name}</span>
                    <span className="text-xs text-text-muted bg-bg px-1.5 py-0.5 rounded">{p.position_id}</span>
                    {p.department && <span className="text-xs text-text-muted">{p.department}</span>}
                  </div>
                  <p className="text-sm text-text-muted truncate mt-0.5">{p.description || '暂无描述'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-4">
                <span className="text-xs text-text-muted mr-2">{p.tools.length} 工具</span>
                <button onClick={() => handleEdit(p)} className="p-1.5 rounded-md hover:bg-bg text-text-muted hover:text-text" title="编辑">
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDelete(p)} className="p-1.5 rounded-md hover:bg-red-50 text-text-muted hover:text-red-500" title="删除">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 普通用户模式：仅编辑自己当前岗位 ──

function UserPositionEditor() {
  const [position, setPosition] = useState<PositionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  const loadMyPosition = useCallback(async () => {
    try {
      setLoading(true)
      // 通过 workstation/home 获取当前用户的岗位信息
      const res = await fetch('/api/v1/workstation/home', {
        headers: { 'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)agentforge_token\s*=\s*([^;]*).*$)|^.*$/, '$1')}` },
        credentials: 'include',
      })
      if (!res.ok) throw new Error('获取岗位信息失败')
      const data = await res.json()
      const posId = data.position?.position_id
      if (posId) {
        const posDetail = await fetchPosition(posId)
        setPosition(posDetail)
      }
    } catch (e: any) {
      toast.error('加载岗位配置失败: ' + (e.message || e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadMyPosition() }, [loadMyPosition])

  const handleSave = async (form: PositionDetail) => {
    try {
      await updatePosition(form.position_id, form)
      toast.success('岗位配置已更新')
      setEditing(false)
      loadMyPosition()
    } catch (e: any) {
      toast.error('保存失败: ' + (e.message || e))
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-text-muted">加载中...</div>
  }

  if (!position) {
    return (
      <div className="text-center py-12 text-text-muted">
        <p>暂未分配岗位，请联系管理员分配。</p>
      </div>
    )
  }

  if (editing) {
    return <PositionForm position={position} isNew={false} onSave={handleSave} onCancel={() => setEditing(false)} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">我的岗位配置</h3>
          <p className="text-sm text-text-muted mt-0.5">查看和编辑当前岗位的 AI 助手配置</p>
        </div>
        <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">
          <Pencil size={14} /> 编辑配置
        </button>
      </div>

      <div className="border border-border rounded-lg p-5 space-y-4">
        {/* 基本信息 */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-xl shrink-0" style={{ backgroundColor: position.color }}>
            {position.display_name[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">{position.display_name}</span>
              <span className="text-xs text-text-muted bg-bg px-1.5 py-0.5 rounded">{position.position_id}</span>
            </div>
            <p className="text-sm text-text-muted">{position.department} · {position.domain}</p>
          </div>
        </div>

        <p className="text-sm text-text-secondary">{position.description}</p>

        {/* 核心配置摘要 */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-3 bg-bg rounded-lg">
            <div className="text-text-muted mb-1">默认模型</div>
            <div className="font-medium">{position.default_model}</div>
          </div>
          <div className="p-3 bg-bg rounded-lg">
            <div className="text-text-muted mb-1">工具数量</div>
            <div className="font-medium">{position.tools.length} 个</div>
          </div>
          <div className="p-3 bg-bg rounded-lg">
            <div className="text-text-muted mb-1">知识范围</div>
            <div className="font-medium">{position.knowledge_scope.length} 个标签</div>
          </div>
          <div className="p-3 bg-bg rounded-lg">
            <div className="text-text-muted mb-1">看板指标</div>
            <div className="font-medium">{position.dashboard_metrics.length} 个</div>
          </div>
        </div>

        {/* Role/Goal 预览 */}
        {position.role && (
          <div className="p-3 bg-bg rounded-lg">
            <div className="text-xs text-text-muted mb-1">AI 角色设定</div>
            <p className="text-sm whitespace-pre-wrap line-clamp-4">{position.role}</p>
          </div>
        )}

        {/* 工具列表 */}
        {position.tools.length > 0 && (
          <div className="p-3 bg-bg rounded-lg">
            <div className="text-xs text-text-muted mb-1.5">已配置工具</div>
            <div className="flex flex-wrap gap-1.5">
              {position.tools.map(t => (
                <span key={t} className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-md">{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* 知识范围 */}
        {position.knowledge_scope.length > 0 && (
          <div className="p-3 bg-bg rounded-lg">
            <div className="text-xs text-text-muted mb-1.5">知识范围</div>
            <div className="flex flex-wrap gap-1.5">
              {position.knowledge_scope.map(k => (
                <span key={k} className="px-2 py-0.5 text-xs bg-accent/10 text-accent rounded-md">{k}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
