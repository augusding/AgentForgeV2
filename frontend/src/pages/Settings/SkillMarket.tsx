/**
 * Skill 市场管理 — 浏览/创建/审核/分配 Skill
 */
import { useState, useEffect } from 'react'
import {
  Sparkles, Plus, Shield, CheckCircle2, XCircle, Clock,
  AlertTriangle, Loader2, ChevronDown, ChevronRight,
  Zap, Eye, Pause, FileText, BarChart3, BookOpen, ListChecks, Wand2, Pencil,
} from 'lucide-react'
import {
  fetchSkills, fetchMySkills, createSkill, updateSkill,
  submitForReview, reviewSkill, suspendSkill, assignSkillToPosition,
  fetchSkillAudits, extractSkillFromContent,
} from '../../api/skills'
import type { SkillPack, SkillAudit } from '../../types/skill'
import { useAuthStore } from '../../stores/useAuthStore'
import { useWorkstationStore } from '../../stores/useWorkstationStore'
import toast from 'react-hot-toast'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  active: { label: '已发布', color: 'text-success', icon: CheckCircle2 },
  draft: { label: '草稿', color: 'text-text-muted', icon: FileText },
  review: { label: '审核中', color: 'text-warning', icon: Clock },
  suspended: { label: '已冻结', color: 'text-danger', icon: Pause },
  rejected: { label: '已拒绝', color: 'text-danger', icon: XCircle },
  deprecated: { label: '已废弃', color: 'text-text-muted', icon: AlertTriangle },
}

const ICON_MAP: Record<string, typeof Sparkles> = {
  FileText, BarChart3, BookOpen, ListChecks, ShieldAlert: Shield, Sparkles, Zap,
}

type TabKey = 'market' | 'my' | 'manage'

export default function SkillMarket() {
  const [tab, setTab] = useState<TabKey>('market')
  const [skills, setSkills] = useState<SkillPack[]>([])
  const [mySkills, setMySkills] = useState<SkillPack[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showExtract, setShowExtract] = useState(false)
  const isAdmin = useAuthStore(s => s.user?.role === 'admin' || s.user?.role === 'superadmin')

  const loadSkills = async () => {
    setLoading(true)
    try {
      const [all, my] = await Promise.all([fetchSkills(), fetchMySkills()])
      setSkills(all)
      setMySkills(my)
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { loadSkills() }, [])

  const TABS: { key: TabKey; label: string; show: boolean }[] = [
    { key: 'market', label: 'Skill 市场', show: true },
    { key: 'my', label: '我的 Skill', show: true },
    { key: 'manage', label: '管理审核', show: !!isAdmin },
  ]

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.filter(t => t.show).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        {isAdmin && (<>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent border border-accent/30 rounded-md hover:bg-accent/5 transition-colors"
          >
            <Plus size={14} /> 创建 Skill
          </button>
          <button
            onClick={() => setShowExtract(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-info border border-info/30 rounded-md hover:bg-info/5 transition-colors"
          >
            <Wand2 size={14} /> 从内容生成
          </button>
        </>)}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-text-muted" />
        </div>
      ) : (
        <>
          {/* Market tab */}
          {tab === 'market' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {skills.filter(s => s.status === 'active').map(skill => (
                <SkillCard key={skill.id} skill={skill} onAction={loadSkills} showInstall />
              ))}
              {skills.filter(s => s.status === 'active').length === 0 && (
                <div className="col-span-full text-center py-12 text-text-muted text-sm">
                  暂无可用 Skill
                </div>
              )}
            </div>
          )}

          {/* My skills tab */}
          {tab === 'my' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mySkills.map(skill => (
                <SkillCard key={skill.id} skill={skill} onAction={loadSkills} />
              ))}
              {mySkills.length === 0 && (
                <div className="col-span-full text-center py-12 text-text-muted text-sm">
                  暂无已安装的 Skill，去市场浏览安装
                </div>
              )}
            </div>
          )}

          {/* Manage tab (admin) */}
          {tab === 'manage' && isAdmin && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-text">待审核</h3>
              {skills.filter(s => s.status === 'review').map(skill => (
                <SkillCard key={skill.id} skill={skill} onAction={loadSkills} showReview />
              ))}
              {skills.filter(s => s.status === 'review').length === 0 && (
                <p className="text-sm text-text-muted">暂无待审核 Skill</p>
              )}

              <h3 className="text-sm font-semibold text-text mt-6">全部 Skill</h3>
              {skills.map(skill => (
                <SkillCard key={skill.id} skill={skill} onAction={loadSkills} showReview showInstall />
              ))}
            </div>
          )}
        </>
      )}

      {/* Create dialog */}
      {showCreate && (
        <CreateSkillDialog onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadSkills() }} />
      )}

      {/* Extract from content dialog */}
      {showExtract && (
        <ExtractSkillDialog onClose={() => setShowExtract(false)} onCreated={() => { setShowExtract(false); loadSkills() }} />
      )}
    </div>
  )
}

/* ── Skill Card ── */

function SkillCard({
  skill, onAction, showInstall, showReview,
}: {
  skill: SkillPack
  onAction: () => void
  showInstall?: boolean
  showReview?: boolean
}) {
  const [detailOpen, setDetailOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [audits, setAudits] = useState<SkillAudit[]>([])
  const [editing, setEditing] = useState(false)
  const isAdmin = useAuthStore(s => s.user?.role === 'admin' || s.user?.role === 'superadmin')
  const home = useWorkstationStore(s => s.home)
  const positionId = home?.position?.position_id || ''
  const statusCfg = STATUS_CONFIG[skill.status] || STATUS_CONFIG.draft
  const StatusIcon = statusCfg.icon

  // Parse JSON fields safely
  const triggers: string[] = (() => {
    try {
      const v = skill.trigger_patterns
      return typeof v === 'string' ? JSON.parse(v) : (Array.isArray(v) ? v : [])
    } catch { return [] }
  })()
  const tools: string[] = (() => {
    try {
      const v = skill.tools_required
      return typeof v === 'string' ? JSON.parse(v) : (Array.isArray(v) ? v : [])
    } catch { return [] }
  })()
  const positions: string[] = (() => {
    try {
      const v = skill.recommended_positions
      return typeof v === 'string' ? JSON.parse(v) : (Array.isArray(v) ? v : [])
    } catch { return [] }
  })()

  const handleAssign = async () => {
    if (!positionId) { toast.error('请先选择岗位'); return }
    const res = await assignSkillToPosition(skill.id, positionId)
    toast[res.ok ? 'success' : 'error'](res.message || (res.ok ? '已安装' : '安装失败'))
    onAction()
  }

  const handleReview = async (action: 'approve' | 'reject') => {
    const notes = action === 'reject' ? prompt('拒绝原因:') || '' : ''
    await reviewSkill(skill.id, action, notes)
    toast.success(action === 'approve' ? '已批准' : '已拒绝')
    onAction()
  }

  const handleSuspend = async () => {
    await suspendSkill(skill.id)
    toast.success('已冻结')
    onAction()
  }

  const toggleAudit = async () => {
    if (!auditOpen && audits.length === 0) {
      const a = await fetchSkillAudits(skill.id)
      setAudits(a)
    }
    setAuditOpen(!auditOpen)
  }

  const hasDetail = !!(skill.guidance || triggers.length || tools.length)

  return (
    <div
      className={`bg-surface border rounded-lg p-4 flex flex-col transition-all ${
        detailOpen ? 'border-accent/30' : 'border-border hover:border-border'
      }`}
    >
      {/* Header — clickable */}
      <div className="flex items-start gap-3 mb-3 cursor-pointer" onClick={() => hasDetail && setDetailOpen(!detailOpen)}>
        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
          <Sparkles size={20} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text truncate">{skill.display_name || skill.name}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${statusCfg.color} bg-current/10 font-medium flex items-center gap-0.5`}>
              <StatusIcon size={9} /> {statusCfg.label}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">{skill.description}</p>
        </div>
        {hasDetail && (
          <div className="shrink-0 text-text-muted mt-1">
            {detailOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1 mb-3">
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-info/10 text-info">{skill.category}</span>
        {skill.source === 'learned' && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">涌现</span>
        )}
        {skill.source === 'preset' && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/10 text-success">预制</span>
        )}
        {skill.source === 'user_created' && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warning/10 text-warning">自建</span>
        )}
        <span className="text-[10px] text-text-muted">{skill.used_count || 0} 次使用</span>
      </div>

      {/* Detail panel — expanded */}
      {detailOpen && (
        <div className="mb-3 space-y-3 bg-bg rounded-lg p-3">
          {/* Triggers */}
          {triggers.length > 0 && (
            <div>
              <p className="text-[10px] text-text-muted font-medium mb-1">触发关键词</p>
              <div className="flex flex-wrap gap-1">
                {triggers.map((t, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/15">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Tools */}
          {tools.length > 0 && (
            <div>
              <p className="text-[10px] text-text-muted font-medium mb-1">使用工具</p>
              <div className="flex flex-wrap gap-1">
                {tools.map((t, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-info/10 text-info border border-info/15">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Recommended positions */}
          {positions.length > 0 && (
            <div>
              <p className="text-[10px] text-text-muted font-medium mb-1">推荐岗位</p>
              <div className="flex flex-wrap gap-1">
                {positions.map((p, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-border text-text-secondary">{p}</span>
                ))}
              </div>
            </div>
          )}

          {/* Guidance */}
          {skill.guidance && (
            <div>
              <p className="text-[10px] text-text-muted font-medium mb-1">执行策略</p>
              <pre className="text-[11px] text-text-secondary leading-relaxed whitespace-pre-wrap">
                {skill.guidance}
              </pre>
            </div>
          )}

          {/* Meta */}
          <div className="flex items-center gap-3 text-[9px] text-text-muted pt-2 border-t border-border">
            <span>ID: {skill.id}</span>
            {skill.version && <span>v{skill.version}</span>}
            {skill.security_level && <span>安全: {skill.security_level}</span>}
          </div>
        </div>
      )}

      {/* Guidance preview (when collapsed) */}
      {!detailOpen && skill.guidance && (
        <div
          className="text-[11px] text-text-secondary bg-bg rounded-md px-3 py-2 mb-3 max-h-16 overflow-hidden cursor-pointer hover:bg-bg/80"
          onClick={() => setDetailOpen(true)}
        >
          {skill.guidance.slice(0, 120)}{skill.guidance.length > 120 ? '...' : ''}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-border">
        {showInstall && skill.status === 'active' && (
          <button onClick={handleAssign} className="text-[10px] px-2.5 py-1 rounded-md bg-accent/10 text-accent hover:bg-accent/20 transition-colors">
            安装到我的岗位
          </button>
        )}
        {showReview && skill.status === 'review' && isAdmin && (<>
          <button onClick={() => handleReview('approve')} className="text-[10px] px-2.5 py-1 rounded-md bg-success/10 text-success hover:bg-success/20">
            批准
          </button>
          <button onClick={() => handleReview('reject')} className="text-[10px] px-2.5 py-1 rounded-md bg-danger/10 text-danger hover:bg-danger/20">
            拒绝
          </button>
        </>)}
        {isAdmin && skill.status === 'active' && (
          <button onClick={handleSuspend} className="text-[10px] px-2.5 py-1 rounded-md bg-warning/10 text-warning hover:bg-warning/20">
            冻结
          </button>
        )}
        {isAdmin && (
          <button onClick={() => setEditing(true)} className="text-[10px] px-2.5 py-1 rounded-md bg-bg border border-border text-text-secondary hover:text-text hover:border-accent/30 transition-colors flex items-center gap-0.5">
            <Pencil size={9} /> 编辑
          </button>
        )}
        <button onClick={toggleAudit} className="ml-auto text-[10px] text-text-muted hover:text-text flex items-center gap-0.5">
          {auditOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          日志
        </button>
      </div>

      {/* Audit logs */}
      {auditOpen && (
        <div className="mt-2 space-y-1 text-[10px]">
          {audits.length === 0 ? (
            <span className="text-text-muted">暂无日志</span>
          ) : audits.map(a => (
            <div key={a.id} className="flex items-center gap-2 text-text-muted">
              <span>{a.created_at?.slice(0, 16)}</span>
              <span className="text-text">{a.action}</span>
              {a.detail && <span className="truncate">{a.detail}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      {editing && (
        <EditSkillDialog skill={skill} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onAction() }} />
      )}
    </div>
  )
}

/* ── Edit Skill Dialog ── */

function EditSkillDialog({ skill, onClose, onSaved }: { skill: SkillPack; onClose: () => void; onSaved: () => void }) {
  const parseSafe = (v: any): string => {
    if (!v) return ''
    if (typeof v === 'string') {
      try { const arr = JSON.parse(v); return Array.isArray(arr) ? arr.join(', ') : v } catch { return v }
    }
    return Array.isArray(v) ? v.join(', ') : String(v)
  }

  const [form, setForm] = useState({
    display_name: skill.display_name || skill.name || '',
    description: skill.description || '',
    category: skill.category || '',
    trigger_patterns: parseSafe(skill.trigger_patterns),
    guidance: skill.guidance || '',
    tools_required: parseSafe(skill.tools_required),
    recommended_positions: parseSafe(skill.recommended_positions),
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const data: any = {
        display_name: form.display_name,
        description: form.description,
        category: form.category,
        trigger_patterns: JSON.stringify(form.trigger_patterns.split(',').map(s => s.trim()).filter(Boolean)),
        guidance: form.guidance,
        tools_required: JSON.stringify(form.tools_required.split(',').map(s => s.trim()).filter(Boolean)),
        recommended_positions: JSON.stringify(form.recommended_positions.split(',').map(s => s.trim()).filter(Boolean)),
      }
      const res = await updateSkill(skill.id, data)
      if (res.ok) {
        toast.success('已保存')
        onSaved()
      } else {
        toast.error('保存失败')
      }
    } catch { toast.error('保存失败') }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-text flex items-center gap-1.5">
            <Pencil size={14} className="text-accent" /> 编辑 Skill
          </h3>
          <button onClick={onClose} className="text-text-muted hover:text-text text-lg">&times;</button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Skill 名称" required value={form.display_name} onChange={v => setForm(f => ({ ...f, display_name: v }))} />
          <Field label="描述" value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} />
          <Field label="分类" value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} />
          <Field label="触发关键词" value={form.trigger_patterns} onChange={v => setForm(f => ({ ...f, trigger_patterns: v }))} placeholder="逗号分隔" />
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">执行策略</label>
            <textarea
              value={form.guidance}
              onChange={e => setForm(f => ({ ...f, guidance: e.target.value }))}
              rows={8}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg text-text focus:border-accent focus:outline-none resize-y"
            />
          </div>
          <Field label="需要的工具" value={form.tools_required} onChange={v => setForm(f => ({ ...f, tools_required: v }))} placeholder="逗号分隔" />
          <Field label="推荐岗位" value={form.recommended_positions} onChange={v => setForm(f => ({ ...f, recommended_positions: v }))} placeholder="逗号分隔" />

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-xs text-text-muted hover:text-text rounded-lg">取消</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-xs text-white bg-accent rounded-lg hover:bg-accent/90 disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Create Skill Dialog ── */

function CreateSkillDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    display_name: '',
    name: '',
    description: '',
    category: '通用',
    trigger_patterns: '',
    guidance: '',
    tools_required: '',
    recommended_positions: '',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.display_name || !form.guidance) {
      toast.error('名称和策略文本必填')
      return
    }
    setSaving(true)
    try {
      const data: any = {
        display_name: form.display_name,
        name: form.name || form.display_name.toLowerCase().replace(/\s+/g, '-'),
        description: form.description,
        category: form.category,
        trigger_patterns: JSON.stringify(form.trigger_patterns.split(',').map(s => s.trim()).filter(Boolean)),
        guidance: form.guidance,
        tools_required: JSON.stringify(form.tools_required.split(',').map(s => s.trim()).filter(Boolean)),
        recommended_positions: JSON.stringify(form.recommended_positions.split(',').map(s => s.trim()).filter(Boolean)),
      }
      const res = await createSkill(data)
      if (res.ok && res.id) {
        // 自动提交审核
        await submitForReview(res.id)
        toast.success('已创建并提交审核')
        onCreated()
      } else {
        toast.error('创建失败')
      }
    } catch {
      toast.error('创建失败')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-text">创建 Skill</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text text-lg">&times;</button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Skill 名称" required value={form.display_name} onChange={v => setForm(f => ({ ...f, display_name: v }))} placeholder="如：项目周报生成" />
          <Field label="描述" value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} placeholder="简要描述这个 Skill 做什么" />
          <Field label="分类" value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} placeholder="报告/分析/文档/规划" />
          <Field label="触发关键词" value={form.trigger_patterns} onChange={v => setForm(f => ({ ...f, trigger_patterns: v }))} placeholder="逗号分隔，如：周报,weekly report" />
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">策略文本 <span className="text-danger">*</span></label>
            <textarea
              value={form.guidance}
              onChange={e => setForm(f => ({ ...f, guidance: e.target.value }))}
              rows={6}
              placeholder="告诉 AI 该如何执行此类任务的详细步骤和注意事项..."
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg text-text focus:border-accent focus:outline-none resize-y"
            />
          </div>
          <Field label="需要的工具" value={form.tools_required} onChange={v => setForm(f => ({ ...f, tools_required: v }))} placeholder="逗号分隔，如：search_knowledge,excel_processor" />
          <Field label="推荐岗位" value={form.recommended_positions} onChange={v => setForm(f => ({ ...f, recommended_positions: v }))} placeholder="逗号分隔，如：project-manager,product-ops" />

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-xs text-text-muted hover:text-text rounded-lg">取消</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-xs text-white bg-accent rounded-lg hover:bg-accent/90 disabled:opacity-50"
            >
              {saving ? '创建中...' : '创建并提交审核'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-secondary mb-1">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg text-text focus:border-accent focus:outline-none"
      />
    </div>
  )
}

/* ── Extract from Content Dialog ── */

function ExtractSkillDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [content, setContent] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const handleExtract = async () => {
    if (!content.trim()) { toast.error('请粘贴内容'); return }
    setExtracting(true)
    setResult(null)
    try {
      const res = await extractSkillFromContent(content)
      if (res.should_create) {
        setResult(res)
        toast.success('提取成功，请确认信息')
      } else {
        toast.error(res.reason || '未能从内容中提取技能')
      }
    } catch { toast.error('提取失败') }
    setExtracting(false)
  }

  const handleSave = async () => {
    if (!result) return
    setSaving(true)
    try {
      const data: any = {
        display_name: result.display_name,
        name: result.name,
        description: result.description,
        category: '内容提取',
        trigger_patterns: JSON.stringify(result.trigger_patterns || []),
        guidance: result.guidance,
        tools_required: JSON.stringify(result.tools_required || []),
      }
      const res = await createSkill(data)
      if (res.ok && res.id) {
        await submitForReview(res.id)
        toast.success('已创建并提交审核')
        onCreated()
      }
    } catch { toast.error('保存失败') }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-text flex items-center gap-1.5">
            <Wand2 size={16} className="text-info" /> 从内容生成 Skill
          </h3>
          <button onClick={onClose} className="text-text-muted hover:text-text text-lg">&times;</button>
        </div>
        <div className="p-5 space-y-4">
          {!result ? (
            <>
              <p className="text-xs text-text-muted">
                粘贴 SOP、操作指南、方案文档等内容，AI 会自动提取为结构化的 Skill 定义。
              </p>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={10}
                placeholder="在此粘贴内容...&#10;&#10;示例：&#10;竞品分析 SOP：&#10;1. 确定分析对象和维度&#10;2. 收集竞品公开数据&#10;3. 多维度对比分析&#10;4. 生成结构化报告"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg text-text focus:border-accent focus:outline-none resize-y"
              />
              <div className="flex justify-end gap-2">
                <button onClick={onClose} className="px-4 py-2 text-xs text-text-muted hover:text-text rounded-lg">取消</button>
                <button
                  onClick={handleExtract}
                  disabled={extracting || !content.trim()}
                  className="px-4 py-2 text-xs text-white bg-info rounded-lg hover:bg-info/90 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {extracting ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                  {extracting ? 'AI 提取中...' : '开始提取'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-success text-xs">
                  <CheckCircle2 size={14} /> AI 已提取以下 Skill 定义，请确认：
                </div>
                <div className="bg-bg rounded-lg p-3 space-y-2 text-xs">
                  <div><span className="text-text-muted">名称：</span><span className="text-text font-medium">{result.display_name}</span></div>
                  <div><span className="text-text-muted">描述：</span><span className="text-text">{result.description}</span></div>
                  <div><span className="text-text-muted">触发词：</span><span className="text-accent">{(result.trigger_patterns || []).join('、')}</span></div>
                  <div><span className="text-text-muted">工具：</span><span className="text-text">{(result.tools_required || []).join('、')}</span></div>
                  <div className="pt-2 border-t border-border">
                    <span className="text-text-muted">策略：</span>
                    <pre className="mt-1 text-text whitespace-pre-wrap text-[11px] leading-relaxed">{result.guidance}</pre>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setResult(null)} className="px-4 py-2 text-xs text-text-muted hover:text-text rounded-lg">重新提取</button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-xs text-white bg-accent rounded-lg hover:bg-accent/90 disabled:opacity-50"
                >
                  {saving ? '保存中...' : '确认创建并提交审核'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
