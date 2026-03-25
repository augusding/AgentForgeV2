import { useState, useEffect, useCallback } from 'react'
import { Building2, Plus, Pencil, Trash2, Lock, Check, X, Loader2, ChevronRight } from 'lucide-react'
import {
  fetchAdminIndustries,
  createIndustry,
  updateIndustry,
  deleteIndustry,
  createSubIndustry,
  updateSubIndustry,
  deleteSubIndustry,
} from '../../api/admin'
import toast from 'react-hot-toast'

interface SubIndustry {
  id: string
  industry_id: string
  label: string
  sort_order: number
  is_system: number
}

interface Industry {
  id: string
  label: string
  sort_order: number
  is_system: number
  children: SubIndustry[]
}

export default function AdminIndustries() {
  const [industries, setIndustries] = useState<Industry[]>([])
  const [loading, setLoading] = useState(true)

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')

  // Inline editing for sub-industries
  const [editingSubId, setEditingSubId] = useState<string | null>(null)
  const [editingSubLabel, setEditingSubLabel] = useState('')

  // New industry creation
  const [showNewIndustry, setShowNewIndustry] = useState(false)
  const [newIndustryLabel, setNewIndustryLabel] = useState('')
  const [creating, setCreating] = useState(false)

  // New sub-industry creation (keyed by industry id)
  const [addingSubTo, setAddingSubTo] = useState<string | null>(null)
  const [newSubLabel, setNewSubLabel] = useState('')
  const [creatingSub, setCreatingSub] = useState(false)

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'industry' | 'sub'; id: string; label: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await fetchAdminIndustries()
      setIndustries(res.industries ?? res ?? [])
    } catch {
      toast.error('加载行业数据失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const totalSubs = industries.reduce((sum, ind) => sum + ind.children.length, 0)

  // ─── Industry CRUD handlers ───

  const handleCreateIndustry = async () => {
    const label = newIndustryLabel.trim()
    if (!label) return
    setCreating(true)
    try {
      await createIndustry(label)
      toast.success('行业已创建')
      setNewIndustryLabel('')
      setShowNewIndustry(false)
      load()
    } catch {
      toast.error('创建行业失败')
    } finally {
      setCreating(false)
    }
  }

  const handleUpdateIndustry = async (id: string) => {
    const label = editingLabel.trim()
    if (!label) return
    try {
      await updateIndustry(id, label)
      toast.success('行业已更新')
      setEditingId(null)
      load()
    } catch {
      toast.error('更新行业失败')
    }
  }

  const handleDeleteIndustry = async (id: string) => {
    try {
      await deleteIndustry(id)
      toast.success('行业已删除')
      setConfirmDelete(null)
      load()
    } catch {
      toast.error('删除行业失败')
    }
  }

  // ─── Sub-industry CRUD handlers ───

  const handleCreateSub = async (industryId: string) => {
    const label = newSubLabel.trim()
    if (!label) return
    setCreatingSub(true)
    try {
      await createSubIndustry(industryId, label)
      toast.success('子行业已创建')
      setNewSubLabel('')
      setAddingSubTo(null)
      load()
    } catch {
      toast.error('创建子行业失败')
    } finally {
      setCreatingSub(false)
    }
  }

  const handleUpdateSub = async (id: string) => {
    const label = editingSubLabel.trim()
    if (!label) return
    try {
      await updateSubIndustry(id, label)
      toast.success('子行业已更新')
      setEditingSubId(null)
      load()
    } catch {
      toast.error('更新子行业失败')
    }
  }

  const handleDeleteSub = async (id: string) => {
    try {
      await deleteSubIndustry(id)
      toast.success('子行业已删除')
      setConfirmDelete(null)
      load()
    } catch {
      toast.error('删除子行业失败')
    }
  }

  // ─── Render ───

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text">行业管理</h2>
          <span className="text-xs text-text-muted">
            共 {industries.length} 个行业，{totalSubs} 个子行业
          </span>
        </div>
        <button
          onClick={() => {
            setShowNewIndustry(true)
            setNewIndustryLabel('')
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <Plus size={16} />
          新增行业
        </button>
      </div>

      {/* New industry inline form */}
      {showNewIndustry && (
        <div className="p-4 rounded-xl bg-surface border border-border flex items-center gap-3">
          <Building2 size={18} className="text-accent shrink-0" />
          <input
            autoFocus
            type="text"
            value={newIndustryLabel}
            onChange={(e) => setNewIndustryLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateIndustry()
              if (e.key === 'Escape') setShowNewIndustry(false)
            }}
            placeholder="输入行业名称..."
            className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-surface text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent/40"
          />
          <button
            onClick={handleCreateIndustry}
            disabled={creating || !newIndustryLabel.trim()}
            className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 disabled:opacity-40 transition-colors"
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          </button>
          <button
            onClick={() => setShowNewIndustry(false)}
            className="p-1.5 rounded-md text-text-muted hover:bg-surface-hover transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Industry grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {industries.map((industry) => (
          <div key={industry.id} className="p-5 rounded-xl bg-surface border border-border">
            {/* Industry header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <Building2 size={18} className="text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                {editingId === industry.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateIndustry(industry.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="flex-1 px-2 py-1 rounded-md border border-border bg-surface text-sm text-text focus:outline-none focus:border-accent/40"
                    />
                    <button
                      onClick={() => handleUpdateIndustry(industry.id)}
                      className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1 rounded-md text-text-muted hover:bg-surface-hover transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-text truncate">{industry.label}</h3>
                      <p className="text-xs text-text-muted">{industry.children.length} 个子行业</p>
                    </div>
                    <div className="flex items-center gap-1 ml-auto shrink-0">
                      {!industry.is_system ? (
                        <>
                          <button
                            onClick={() => {
                              setEditingId(industry.id)
                              setEditingLabel(industry.label)
                            }}
                            className="p-1.5 rounded-md text-text-muted hover:text-accent hover:bg-surface-hover transition-colors"
                            title="编辑"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() =>
                              setConfirmDelete({ type: 'industry', id: industry.id, label: industry.label })
                            }
                            className="p-1.5 rounded-md text-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            title="删除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : (
                        <span className="p-1.5 text-text-muted" title="系统内置，不可删除">
                          <Lock size={14} />
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sub-industries list */}
            <div className="space-y-1.5">
              {industry.children.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface-hover group"
                >
                  {editingSubId === sub.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <ChevronRight size={12} className="text-text-muted shrink-0" />
                      <input
                        autoFocus
                        type="text"
                        value={editingSubLabel}
                        onChange={(e) => setEditingSubLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateSub(sub.id)
                          if (e.key === 'Escape') setEditingSubId(null)
                        }}
                        className="flex-1 px-2 py-0.5 rounded-md border border-border bg-surface text-sm text-text focus:outline-none focus:border-accent/40"
                      />
                      <button
                        onClick={() => handleUpdateSub(sub.id)}
                        className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        onClick={() => setEditingSubId(null)}
                        className="p-1 rounded-md text-text-muted hover:bg-surface-hover transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <ChevronRight size={12} className="text-text-muted shrink-0" />
                      <span className="flex-1 text-sm text-text-secondary truncate">{sub.label}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {!sub.is_system ? (
                          <>
                            <button
                              onClick={() => {
                                setEditingSubId(sub.id)
                                setEditingSubLabel(sub.label)
                              }}
                              className="p-1 rounded-md text-text-muted hover:text-accent hover:bg-white/50 dark:hover:bg-white/5 transition-colors"
                              title="编辑"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() =>
                                setConfirmDelete({ type: 'sub', id: sub.id, label: sub.label })
                              }
                              className="p-1 rounded-md text-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                              title="删除"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        ) : (
                          <span className="p-1 text-text-muted" title="系统内置，不可删除">
                            <Lock size={12} />
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}

              {/* Add sub-industry inline form */}
              {addingSubTo === industry.id ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface-hover">
                  <ChevronRight size={12} className="text-text-muted shrink-0" />
                  <input
                    autoFocus
                    type="text"
                    value={newSubLabel}
                    onChange={(e) => setNewSubLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateSub(industry.id)
                      if (e.key === 'Escape') {
                        setAddingSubTo(null)
                        setNewSubLabel('')
                      }
                    }}
                    placeholder="输入子行业名称..."
                    className="flex-1 px-2 py-0.5 rounded-md border border-border bg-surface text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent/40"
                  />
                  <button
                    onClick={() => handleCreateSub(industry.id)}
                    disabled={creatingSub || !newSubLabel.trim()}
                    className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 disabled:opacity-40 transition-colors"
                  >
                    {creatingSub ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  </button>
                  <button
                    onClick={() => {
                      setAddingSubTo(null)
                      setNewSubLabel('')
                    }}
                    className="p-1 rounded-md text-text-muted hover:bg-surface-hover transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setAddingSubTo(industry.id)
                    setNewSubLabel('')
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 w-full rounded-md text-xs text-text-muted hover:text-accent hover:bg-surface-hover transition-colors"
                >
                  <Plus size={12} />
                  新增子行业
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-surface border border-border rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-text mb-2">确认删除</h3>
            <p className="text-sm text-text-secondary mb-6">
              确定要删除{confirmDelete.type === 'industry' ? '行业' : '子行业'}
              <span className="font-medium text-text"> "{confirmDelete.label}" </span>
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
                onClick={() => {
                  if (confirmDelete.type === 'industry') {
                    handleDeleteIndustry(confirmDelete.id)
                  } else {
                    handleDeleteSub(confirmDelete.id)
                  }
                }}
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
