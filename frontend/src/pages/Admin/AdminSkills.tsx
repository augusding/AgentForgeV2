import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Pencil, Trash2, Loader2, X, Search,
  Sparkles, Brain, Target, Zap, Shield, Puzzle,
  Package, TrendingUp, MessageCircle, FileEdit,
  Users, Building2, BarChart3, Check,
} from 'lucide-react'
import {
  fetchSkillPacks, createSkillPack, updateSkillPack, deleteSkillPack,
  fetchSkillPackAssignments, createSkillAssignment, deleteSkillAssignment,
  fetchSkillPackStats,
  type SkillPack, type SkillAssignment, type SkillPackStats,
} from '../../api/admin'
import { fetchUsers, type UserInfo } from '../../api/users'
import { useIndustries } from '../../hooks/useIndustries'
import toast from 'react-hot-toast'

// ─── Constants ───

const CATEGORY_LABELS: Record<string, string> = {
  analysis: '分析', service: '服务', marketing: '营销',
  security: '安全', custom: '自定义', general: '通用',
}

const TIER_LABELS: Record<string, string> = {
  free: '免费', pro: 'Pro', enterprise: 'Enterprise',
}

const TIER_COLORS: Record<string, string> = {
  free: 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-300',
  pro: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
  enterprise: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Sparkles, Brain, Target, Zap, Shield, Puzzle,
  Package, TrendingUp, MessageCircle, FileEdit,
}

const ICON_NAMES = Object.keys(ICON_MAP)

const PRESET_COLORS = [
  '#4ECDC4', '#FF6B6B', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
]

const TABS = [
  { key: 'packs', label: '技能包管理', icon: Package },
  { key: 'assign', label: '客户分配', icon: Users },
  { key: 'stats', label: '使用概览', icon: BarChart3 },
] as const

type TabKey = typeof TABS[number]['key']

// ─── Helpers ───

function getIcon(name: string) {
  return ICON_MAP[name] || Package
}

// ─── Tag Input Component ───

function TagInput({ value, onChange, placeholder }: {
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault()
      if (!value.includes(input.trim())) {
        onChange([...value, input.trim()])
      }
      setInput('')
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-border bg-surface min-h-[38px]">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/10 text-accent text-xs"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="hover:text-red-500 transition-colors"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[100px] bg-transparent text-sm text-text placeholder:text-text-muted outline-none"
      />
    </div>
  )
}

// ─── Skill Pack Editor Modal ───

interface EditorProps {
  initial?: SkillPack | null
  onSave: (data: Partial<SkillPack>) => Promise<void>
  onClose: () => void
  industryOptions: { id: string; label: string }[]
}

function SkillPackEditor({ initial, onSave, onClose, industryOptions }: EditorProps) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    description: initial?.description || '',
    category: initial?.category || 'general',
    tier: initial?.tier || 'free',
    icon: initial?.icon || 'Package',
    color: initial?.color || PRESET_COLORS[0],
    required_tools: initial?.required_tools || [] as string[],
    capabilities: initial?.capabilities || [] as string[],
    knowledge_template: initial?.knowledge_template || '',
    target_industries: initial?.target_industries || [] as string[],
  })
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof typeof form>(key: K, val: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: val }))

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('请输入名称')
      return
    }
    setSaving(true)
    try {
      await onSave(form)
    } finally {
      setSaving(false)
    }
  }

  const toggleIndustry = (id: string) => {
    set('target_industries',
      form.target_industries.includes(id)
        ? form.target_industries.filter((i) => i !== id)
        : [...form.target_industries, id],
    )
  }

  const SelectedIcon = getIcon(form.icon)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8">
      <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-text">
            {initial ? '编辑技能包' : '新建技能包'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-md text-text-muted hover:bg-surface-hover transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">名称 *</label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent/40"
              placeholder="例如：高级数据分析"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">描述</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent/40 resize-none"
              placeholder="简述技能包的用途"
            />
          </div>

          {/* Category + Tier row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">类别</label>
              <select
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text focus:outline-none focus:border-accent/40"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">套餐等级</label>
              <select
                value={form.tier}
                onChange={(e) => set('tier', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text focus:outline-none focus:border-accent/40"
              >
                {Object.entries(TIER_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Icon + Color row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">图标</label>
              <div className="flex flex-wrap gap-1.5">
                {ICON_NAMES.map((name) => {
                  const Ic = ICON_MAP[name]
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => set('icon', name)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors ${
                        form.icon === name
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-text-muted hover:border-accent/40'
                      }`}
                      title={name}
                    >
                      <Ic size={16} />
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">品牌色</label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set('color', c)}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      form.color === c ? 'border-accent scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => set('color', e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0"
                />
                <span className="text-xs text-text-muted">{form.color}</span>
              </div>
            </div>
          </div>

          {/* Required tools */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">关联工具</label>
            <TagInput
              value={form.required_tools}
              onChange={(v) => set('required_tools', v)}
              placeholder="输入工具名称后回车添加..."
            />
          </div>

          {/* Target industries */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">目标行业</label>
            <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-border bg-surface max-h-[120px] overflow-y-auto">
              {industryOptions.length === 0 && (
                <span className="text-xs text-text-muted">暂无行业数据</span>
              )}
              {industryOptions.map((ind) => (
                <label key={ind.id} className="flex items-center gap-1.5 text-sm text-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.target_industries.includes(ind.id)}
                    onChange={() => toggleIndustry(ind.id)}
                    className="rounded border-border text-accent focus:ring-accent/40"
                  />
                  {ind.label}
                </label>
              ))}
            </div>
          </div>

          {/* Capabilities */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">能力标签</label>
            <TagInput
              value={form.capabilities}
              onChange={(v) => set('capabilities', v)}
              placeholder="输入能力标签后回车添加..."
            />
          </div>

          {/* Knowledge template */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">知识/方法论</label>
            <textarea
              value={form.knowledge_template}
              onChange={(e) => set('knowledge_template', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent/40 resize-none"
              placeholder="定义该技能包使用的知识体系和方法论..."
            />
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-hover">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: form.color + '20' }}
            >
              <SelectedIcon size={20} style={{ color: form.color }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-text">{form.name || '技能包名称'}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${TIER_COLORS[form.tier] || ''}`}>
                  {TIER_LABELS[form.tier] || form.tier}
                </span>
                <span className="text-[10px] text-text-muted">{CATEGORY_LABELS[form.category] || form.category}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-surface-hover transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.name.trim()}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {initial ? '保存' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tab 1: Pack Management ───

function PacksTab({ packs, loading, onEdit, onToggle, onDelete, onRefresh }: {
  packs: SkillPack[]
  loading: boolean
  onEdit: (p: SkillPack | null) => void
  onToggle: (p: SkillPack) => void
  onDelete: (p: SkillPack) => void
  onRefresh: () => void
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">共 {packs.length} 个技能包</span>
        <button
          onClick={() => onEdit(null)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <Plus size={16} />
          新建技能包
        </button>
      </div>

      {packs.length === 0 ? (
        <div className="text-center py-16 text-text-muted text-sm">暂无技能包，点击右上角创建</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packs.map((pack) => {
            const Icon = getIcon(pack.icon)
            return (
              <div key={pack.id} className="p-5 rounded-xl bg-surface border border-border flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: (pack.color || '#4ECDC4') + '20' }}
                  >
                    <Icon size={20} style={{ color: pack.color || '#4ECDC4' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-text truncate">{pack.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${TIER_COLORS[pack.tier] || ''}`}>
                        {TIER_LABELS[pack.tier] || pack.tier}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {CATEGORY_LABELS[pack.category] || pack.category}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-text-muted leading-relaxed mb-3 line-clamp-2 flex-1">
                  {pack.description || '暂无描述'}
                </p>

                {/* Info row */}
                <div className="text-[11px] text-text-muted mb-3">
                  {(pack.required_tools?.length || 0)} 工具
                  {' \u00B7 '}
                  {(pack.target_industries?.length || 0)} 行业
                  {' \u00B7 '}
                  {(pack.capabilities?.length || 0)} 能力
                </div>

                {/* Actions row */}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  {/* Toggle */}
                  <button
                    onClick={() => onToggle(pack)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      pack.enabled ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                        pack.enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
                      }`}
                    />
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEdit(pack)}
                      className="p-1.5 rounded-md text-text-muted hover:text-accent hover:bg-surface-hover transition-colors"
                      title="编辑"
                    >
                      <Pencil size={14} />
                    </button>
                    {!pack.is_system && (
                      <button
                        onClick={() => onDelete(pack)}
                        className="p-1.5 rounded-md text-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        title="删除"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Tab 2: Assignments ───

function AssignTab({ packs }: { packs: SkillPack[] }) {
  const { industries, getIndustryLabel } = useIndustries()
  const [users, setUsers] = useState<UserInfo[]>([])
  const [selectedPack, setSelectedPack] = useState<SkillPack | null>(null)
  const [assignments, setAssignments] = useState<SkillAssignment[]>([])
  const [loadingAssign, setLoadingAssign] = useState(false)
  const [assignIndustry, setAssignIndustry] = useState('')
  const [assignUser, setAssignUser] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    fetchUsers().then(setUsers).catch(() => {})
  }, [])

  const loadAssignments = useCallback(async (packId: string) => {
    setLoadingAssign(true)
    try {
      const res = await fetchSkillPackAssignments(packId)
      setAssignments(res.assignments ?? [])
    } catch {
      toast.error('加载分配数据失败')
    } finally {
      setLoadingAssign(false)
    }
  }, [])

  const selectPack = (pack: SkillPack) => {
    setSelectedPack(pack)
    loadAssignments(pack.id)
  }

  const handleAssign = async (targetType: string, targetId: string) => {
    if (!selectedPack || !targetId) return
    setAssigning(true)
    try {
      await createSkillAssignment({
        skill_pack_id: selectedPack.id,
        target_type: targetType,
        target_id: targetId,
      })
      toast.success('分配成功')
      setAssignIndustry('')
      setAssignUser('')
      loadAssignments(selectedPack.id)
    } catch (err: any) {
      toast.error(err?.message || '分配失败')
    } finally {
      setAssigning(false)
    }
  }

  const handleRemoveAssignment = async (id: string) => {
    try {
      await deleteSkillAssignment(id)
      toast.success('已移除')
      if (selectedPack) loadAssignments(selectedPack.id)
    } catch (err: any) {
      toast.error(err?.message || '移除失败')
    }
  }

  const filteredUsers = userSearch.trim()
    ? users.filter((u) =>
        u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.display_name || '').toLowerCase().includes(userSearch.toLowerCase()),
      )
    : users

  const getTargetLabel = (a: SkillAssignment) => {
    if (a.target_type === 'industry') return getIndustryLabel(a.target_id)
    const user = users.find((u) => u.id === a.target_id)
    return user ? (user.display_name || user.username) : a.target_id
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[400px]">
      {/* Left panel - pack list */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-text">选择技能包</h3>
        </div>
        <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
          {packs.map((pack) => {
            const Icon = getIcon(pack.icon)
            return (
              <button
                key={pack.id}
                onClick={() => selectPack(pack)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors ${
                  selectedPack?.id === pack.id ? 'bg-accent/5 border-l-2 border-l-accent' : ''
                }`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: (pack.color || '#4ECDC4') + '20' }}
                >
                  <Icon size={16} style={{ color: pack.color || '#4ECDC4' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text truncate">{pack.name}</p>
                  <p className="text-[11px] text-text-muted">
                    {TIER_LABELS[pack.tier] || pack.tier}
                  </p>
                </div>
              </button>
            )
          })}
          {packs.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-text-muted">暂无技能包</div>
          )}
        </div>
      </div>

      {/* Right panel - assignments */}
      <div className="lg:col-span-2 rounded-xl border border-border bg-surface overflow-hidden">
        {!selectedPack ? (
          <div className="flex items-center justify-center h-full py-24 text-text-muted text-sm">
            <div className="text-center">
              <Package size={32} className="mx-auto mb-2 opacity-40" />
              <p>请从左侧选择一个技能包</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* Selected pack header */}
            <div className="px-5 py-4 flex items-center gap-3">
              {(() => {
                const Icon = getIcon(selectedPack.icon)
                return (
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: (selectedPack.color || '#4ECDC4') + '20' }}
                  >
                    <Icon size={20} style={{ color: selectedPack.color || '#4ECDC4' }} />
                  </div>
                )
              })()}
              <div>
                <h3 className="text-sm font-semibold text-text">{selectedPack.name}</h3>
                <p className="text-xs text-text-muted">{assignments.length} 个分配</p>
              </div>
            </div>

            {/* Current assignments */}
            <div className="px-5 py-4">
              <h4 className="text-xs font-semibold text-text-secondary mb-3">当前分配</h4>
              {loadingAssign ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 size={18} className="animate-spin text-accent" />
                </div>
              ) : assignments.length === 0 ? (
                <p className="text-xs text-text-muted py-3">暂无分配</p>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {assignments.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-hover"
                    >
                      <div className="flex items-center gap-2">
                        {a.target_type === 'industry' ? (
                          <Building2 size={14} className="text-accent" />
                        ) : (
                          <Users size={14} className="text-purple-500" />
                        )}
                        <span className="text-sm text-text">{getTargetLabel(a)}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted">
                          {a.target_type === 'industry' ? '行业' : '客户'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveAssignment(a.id)}
                        className="p-1 rounded-md text-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        title="移除分配"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assign by industry */}
            <div className="px-5 py-4">
              <h4 className="text-xs font-semibold text-text-secondary mb-3">按行业分配</h4>
              <div className="flex items-center gap-2">
                <select
                  value={assignIndustry}
                  onChange={(e) => setAssignIndustry(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text focus:outline-none focus:border-accent/40"
                >
                  <option value="">选择行业...</option>
                  {industries.map((ind) => (
                    <option key={ind.id} value={ind.id}>{ind.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => handleAssign('industry', assignIndustry)}
                  disabled={assigning || !assignIndustry}
                  className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                >
                  {assigning && <Loader2 size={14} className="animate-spin" />}
                  分配
                </button>
              </div>
            </div>

            {/* Assign by user */}
            <div className="px-5 py-4">
              <h4 className="text-xs font-semibold text-text-secondary mb-3">按客户分配</h4>
              <div className="space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="搜索用户..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-surface text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent/40"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={assignUser}
                    onChange={(e) => setAssignUser(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text focus:outline-none focus:border-accent/40"
                  >
                    <option value="">选择用户...</option>
                    {filteredUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.display_name || u.username} ({u.username})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleAssign('user', assignUser)}
                    disabled={assigning || !assignUser}
                    className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                  >
                    {assigning && <Loader2 size={14} className="animate-spin" />}
                    分配
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab 3: Stats ───

function StatsTab() {
  const [stats, setStats] = useState<SkillPackStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSkillPackStats()
      .then(setStats)
      .catch(() => toast.error('加载统计数据失败'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-accent" />
      </div>
    )
  }

  if (!stats) {
    return <div className="text-center py-16 text-text-muted text-sm">暂无统计数据</div>
  }

  const maxAssignCount = Math.max(1, ...stats.assignments_by_pack.map((p) => p.count))

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-surface border border-border">
          <p className="text-xs text-text-muted mb-1">总技能包</p>
          <p className="text-2xl font-bold text-text">{stats.total_packs}</p>
        </div>
        <div className="p-5 rounded-xl bg-surface border border-border">
          <p className="text-xs text-text-muted mb-1">总分配数</p>
          <p className="text-2xl font-bold text-text">{stats.total_assignments}</p>
        </div>
        <div className="p-5 rounded-xl bg-surface border border-border">
          <p className="text-xs text-text-muted mb-1">行业分配</p>
          <p className="text-2xl font-bold text-text">{stats.assignments_by_type?.industry || 0}</p>
        </div>
        <div className="p-5 rounded-xl bg-surface border border-border">
          <p className="text-xs text-text-muted mb-1">客户分配</p>
          <p className="text-2xl font-bold text-text">{stats.assignments_by_type?.user || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Assignments by pack */}
        <div className="p-5 rounded-xl bg-surface border border-border">
          <h4 className="text-sm font-semibold text-text mb-4">技能包分配排名</h4>
          {stats.assignments_by_pack.length === 0 ? (
            <p className="text-xs text-text-muted py-4">暂无分配数据</p>
          ) : (
            <div className="space-y-3">
              {stats.assignments_by_pack.map((item) => (
                <div key={item.skill_pack_id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-text">{item.name}</span>
                    <span className="text-xs text-text-muted">{item.count}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface-hover">
                    <div
                      className="h-2 rounded-full bg-accent transition-all"
                      style={{ width: `${(item.count / maxAssignCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category & tier distribution */}
        <div className="space-y-4">
          {/* By category */}
          <div className="p-5 rounded-xl bg-surface border border-border">
            <h4 className="text-sm font-semibold text-text mb-3">类别分布</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.by_category).map(([cat, count]) => (
                <div
                  key={cat}
                  className="px-3 py-1.5 rounded-lg bg-surface-hover text-sm"
                >
                  <span className="text-text-secondary">{CATEGORY_LABELS[cat] || cat}</span>
                  <span className="ml-2 font-semibold text-text">{count}</span>
                </div>
              ))}
              {Object.keys(stats.by_category).length === 0 && (
                <span className="text-xs text-text-muted">暂无数据</span>
              )}
            </div>
          </div>

          {/* By tier */}
          <div className="p-5 rounded-xl bg-surface border border-border">
            <h4 className="text-sm font-semibold text-text mb-3">等级分布</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.by_tier).map(([tier, count]) => (
                <div
                  key={tier}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${TIER_COLORS[tier] || ''}`}
                >
                  {TIER_LABELS[tier] || tier}: {count}
                </div>
              ))}
              {Object.keys(stats.by_tier).length === 0 && (
                <span className="text-xs text-text-muted">暂无数据</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───

export default function AdminSkills() {
  const [tab, setTab] = useState<TabKey>('packs')
  const [packs, setPacks] = useState<SkillPack[]>([])
  const [loading, setLoading] = useState(true)
  const [editorTarget, setEditorTarget] = useState<SkillPack | null | undefined>(undefined) // undefined = closed
  const [confirmDelete, setConfirmDelete] = useState<SkillPack | null>(null)

  const { industries } = useIndustries()

  const loadPacks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchSkillPacks()
      setPacks(res.skill_packs ?? [])
    } catch {
      toast.error('加载技能包失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPacks()
  }, [loadPacks])

  // ─── Pack CRUD handlers ───

  const handleSavePack = async (data: Partial<SkillPack>) => {
    try {
      if (editorTarget) {
        await updateSkillPack(editorTarget.id, data)
        toast.success('技能包已更新')
      } else {
        await createSkillPack(data)
        toast.success('技能包已创建')
      }
      setEditorTarget(undefined)
      loadPacks()
    } catch (err: any) {
      toast.error(err?.message || '保存失败')
      throw err
    }
  }

  const handleToggle = async (pack: SkillPack) => {
    try {
      await updateSkillPack(pack.id, { enabled: pack.enabled ? 0 : 1 } as any)
      toast.success(pack.enabled ? '已禁用' : '已启用')
      loadPacks()
    } catch {
      toast.error('操作失败')
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      await deleteSkillPack(confirmDelete.id)
      toast.success('技能包已删除')
      setConfirmDelete(null)
      loadPacks()
    } catch (err: any) {
      toast.error(err?.message || '删除失败')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-text">Skill 管理</h2>
        <p className="text-sm text-text-muted mt-1">通过 Skill 包为客户提供定制增值服务</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.key
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'packs' && (
        <PacksTab
          packs={packs}
          loading={loading}
          onEdit={(p) => setEditorTarget(p)}
          onToggle={handleToggle}
          onDelete={setConfirmDelete}
          onRefresh={loadPacks}
        />
      )}

      {tab === 'assign' && <AssignTab packs={packs} />}

      {tab === 'stats' && <StatsTab />}

      {/* Editor modal */}
      {editorTarget !== undefined && (
        <SkillPackEditor
          initial={editorTarget}
          onSave={handleSavePack}
          onClose={() => setEditorTarget(undefined)}
          industryOptions={industries.map((i) => ({ id: i.id, label: i.label }))}
        />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-surface border border-border rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-text mb-2">确认删除</h3>
            <p className="text-sm text-text-secondary mb-6">
              确定要删除技能包
              <span className="font-medium text-text"> "{confirmDelete.name}" </span>
              吗？此操作不可恢复。
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-surface-hover transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
