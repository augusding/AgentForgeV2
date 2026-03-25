import { Fragment, useEffect, useState, useCallback } from 'react'
import { Search, Pencil, Users, X, Plus, Trash2, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  fetchAdminOrgs,
  getAdminOrgDetail,
  updateAdminOrg,
  updateAdminOrgStatus,
  addAdminOrgMember,
  updateAdminOrgMemberRole,
  removeAdminOrgMember,
  type OrgInfo,
  type OrgMember,
} from '../../api/adminOrgs'

const PLAN_LABELS: Record<string, string> = {
  free: '免费版',
  trial: '试用中',
  starter: '入门版',
  pro: '专业版',
  enterprise: '企业版',
}

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-gray-500/20 text-gray-300',
  trial: 'bg-amber-500/20 text-amber-300',
  starter: 'bg-blue-500/20 text-blue-300',
  pro: 'bg-purple-500/20 text-purple-300',
  enterprise: 'bg-emerald-500/20 text-emerald-300',
}

const ROLE_LABELS: Record<string, string> = {
  owner: '所有者',
  admin: '管理员',
  member: '成员',
}

// ── 编辑组织 Dialog ──────────────────────────────────────

interface EditOrgDialogProps {
  open: boolean
  org: OrgInfo | null
  onClose: () => void
  onSaved: () => void
}

function EditOrgDialog({ open, org, onClose, onSaved }: EditOrgDialogProps) {
  const [form, setForm] = useState({
    name: '', contact_name: '', contact_phone: '', contact_email: '',
    industry: '', sub_industry: '', plan: 'free', max_seats: 5,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && org) {
      setForm({
        name: org.name || '',
        contact_name: org.contact_name || '',
        contact_phone: org.contact_phone || '',
        contact_email: org.contact_email || '',
        industry: org.industry || '',
        sub_industry: org.sub_industry || '',
        plan: org.plan || 'free',
        max_seats: org.max_seats || 5,
      })
    }
  }, [open, org])

  const handleSave = async () => {
    if (!org) return
    setSaving(true)
    try {
      await updateAdminOrg(org.id, form)
      toast.success('组织信息已更新')
      onSaved()
      onClose()
    } catch (e: any) {
      toast.error(e?.message || '更新失败')
    } finally {
      setSaving(false)
    }
  }

  if (!open || !org) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-lg shadow-xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-text">编辑组织</h3>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-secondary mb-1 block">组织名称</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-secondary mb-1 block">负责人姓名</label>
              <input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text" />
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">负责人手机号</label>
              <input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text" />
            </div>
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1 block">负责人邮箱</label>
            <input value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-secondary mb-1 block">套餐</label>
              <select value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text">
                <option value="free">免费版</option>
                <option value="trial">试用</option>
                <option value="starter">入门版</option>
                <option value="pro">专业版</option>
                <option value="enterprise">企业版</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">坐席上限</label>
              <input type="number" value={form.max_seats} onChange={e => setForm({ ...form, max_seats: parseInt(e.target.value) || 5 })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-surface-hover">取消</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 添加成员 Dialog ──────────────────────────────────────

interface AddMemberDialogProps {
  open: boolean
  orgId: string
  onClose: () => void
  onSaved: () => void
}

function AddMemberDialog({ open, orgId, onClose, onSaved }: AddMemberDialogProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState('member')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setUsername('')
      setPassword('')
      setDisplayName('')
      setRole('member')
    }
  }, [open])

  const handleSave = async () => {
    if (!username.trim() || !password) {
      toast.error('用户名和密码不能为空')
      return
    }
    setSaving(true)
    try {
      await addAdminOrgMember(orgId, {
        username: username.trim(),
        password,
        display_name: displayName.trim() || username.trim(),
        role,
      })
      toast.success('成员已添加')
      onSaved()
      onClose()
    } catch (e: any) {
      toast.error(e?.message || '添加失败')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md shadow-xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-text">添加成员</h3>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-secondary mb-1 block">用户名 *</label>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="3-32位字母、数字或下划线"
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text" />
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1 block">显示名称</label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="选填"
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text" />
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1 block">密码 *</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="至少8位"
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text" />
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1 block">角色</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text">
              <option value="member">成员</option>
              <option value="admin">管理员</option>
              <option value="owner">所有者</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-surface-hover">取消</button>
          <button onClick={handleSave} disabled={saving || !username.trim() || !password} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            添加
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────

export default function AdminOrgs() {
  const [orgs, setOrgs] = useState<OrgInfo[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // Expanded org detail
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [members, setMembers] = useState<OrgMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)

  // Dialogs
  const [editOrg, setEditOrg] = useState<OrgInfo | null>(null)
  const [addMemberOrgId, setAddMemberOrgId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchAdminOrgs(search, page)
      setOrgs(result.items)
      setTotal(result.total)
    } catch {
      toast.error('加载组织列表失败')
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { load() }, [load])

  const toggleExpand = async (orgId: string) => {
    if (expandedId === orgId) {
      setExpandedId(null)
      return
    }
    setExpandedId(orgId)
    setMembersLoading(true)
    try {
      const detail = await getAdminOrgDetail(orgId)
      setMembers(detail.members || [])
    } catch {
      setMembers([])
    } finally {
      setMembersLoading(false)
    }
  }

  const handleStatusToggle = async (org: OrgInfo) => {
    const newStatus = org.status === 'active' ? 'suspended' : 'active'
    try {
      await updateAdminOrgStatus(org.id, newStatus)
      toast.success(newStatus === 'active' ? '已激活' : '已停用')
      load()
    } catch (e: any) {
      toast.error(e?.message || '操作失败')
    }
  }

  const handleMemberRoleChange = async (orgId: string, userId: string, newRole: string) => {
    try {
      await updateAdminOrgMemberRole(orgId, userId, newRole)
      toast.success('角色已更新')
      // Refresh members
      const detail = await getAdminOrgDetail(orgId)
      setMembers(detail.members || [])
    } catch (e: any) {
      toast.error(e?.message || '更新失败')
    }
  }

  const handleMemberRemove = async (orgId: string, userId: string, username: string) => {
    if (!confirm(`确认移除成员 "${username}"？`)) return
    try {
      await removeAdminOrgMember(orgId, userId)
      toast.success('已移除')
      const detail = await getAdminOrgDetail(orgId)
      setMembers(detail.members || [])
    } catch (e: any) {
      toast.error(e?.message || '移除失败')
    }
  }

  const totalPages = Math.ceil(total / 50)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text">组织管理</h2>
        <span className="text-sm text-text-muted">共 {total} 个组织</span>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="搜索组织名称/负责人/手机号..."
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-surface text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent/40"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-hover">
                <th className="w-8 px-3 py-3" />
                <th className="text-left px-4 py-3 font-medium text-text-secondary">组织名称</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">负责人</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">联系电话</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">行业</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">成员数</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">套餐</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">状态</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">操作</th>
              </tr>
            </thead>
            <tbody className="bg-surface divide-y divide-border">
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12 text-text-muted">加载中...</td></tr>
              ) : orgs.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-text-muted">暂无组织</td></tr>
              ) : (
                orgs.map((org) => (
                  <Fragment key={org.id}>
                    <tr className="hover:bg-surface-hover transition-colors cursor-pointer"
                      onClick={() => toggleExpand(org.id)}>
                      <td className="px-3 py-3 text-text-muted">
                        {expandedId === org.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="px-4 py-3 text-text font-medium">{org.name}</td>
                      <td className="px-4 py-3 text-text-secondary">{org.contact_name || '-'}</td>
                      <td className="px-4 py-3 text-text-secondary">{org.contact_phone || '-'}</td>
                      <td className="px-4 py-3 text-text-secondary">{org.industry || '-'}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        <span className="inline-flex items-center gap-1">
                          <Users size={12} />
                          {org.member_count ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${PLAN_COLORS[org.plan] || PLAN_COLORS.free}`}>
                          {PLAN_LABELS[org.plan] || org.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          org.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-red-500/20 text-red-300'
                        }`}>
                          {org.status === 'active' ? '正常' : '已停用'}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditOrg(org)} className="p-1.5 text-text-muted hover:text-accent transition-colors" title="编辑">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleStatusToggle(org)}
                            className={`px-2 py-1 text-xs rounded ${org.status === 'active' ? 'text-red-400 hover:bg-red-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'}`}
                            title={org.status === 'active' ? '停用' : '激活'}>
                            {org.status === 'active' ? '停用' : '激活'}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded: members */}
                    {expandedId === org.id && (
                      <tr>
                        <td colSpan={9} className="bg-bg/50 px-6 py-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-text">
                              成员列表
                              {org.contact_email && (
                                <span className="ml-3 text-xs text-text-muted font-normal">
                                  邮箱: {org.contact_email}
                                </span>
                              )}
                            </h4>
                            <button
                              onClick={() => setAddMemberOrgId(org.id)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-accent text-white hover:bg-accent/90"
                            >
                              <Plus size={12} /> 添加成员
                            </button>
                          </div>
                          {membersLoading ? (
                            <div className="text-center py-4 text-text-muted text-sm">加载中...</div>
                          ) : members.length === 0 ? (
                            <div className="text-center py-4 text-text-muted text-sm">暂无成员</div>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-border">
                                  <th className="text-left py-2 px-3 font-medium text-text-muted">用户名</th>
                                  <th className="text-left py-2 px-3 font-medium text-text-muted">显示名称</th>
                                  <th className="text-left py-2 px-3 font-medium text-text-muted">角色</th>
                                  <th className="text-left py-2 px-3 font-medium text-text-muted">加入时间</th>
                                  <th className="text-left py-2 px-3 font-medium text-text-muted">最后登录</th>
                                  <th className="text-right py-2 px-3 font-medium text-text-muted">操作</th>
                                </tr>
                              </thead>
                              <tbody>
                                {members.map((m) => (
                                  <tr key={m.user_id} className="border-b border-border/50 last:border-0">
                                    <td className="py-2 px-3 text-text">{m.username}</td>
                                    <td className="py-2 px-3 text-text-secondary">{m.display_name || '-'}</td>
                                    <td className="py-2 px-3">
                                      <select
                                        value={m.org_role}
                                        onChange={e => handleMemberRoleChange(org.id, m.user_id, e.target.value)}
                                        className="px-2 py-0.5 rounded border border-border bg-bg text-text text-xs"
                                      >
                                        <option value="owner">所有者</option>
                                        <option value="admin">管理员</option>
                                        <option value="member">成员</option>
                                      </select>
                                    </td>
                                    <td className="py-2 px-3 text-text-muted">
                                      {m.joined_at ? new Date(m.joined_at).toLocaleDateString('zh-CN') : '-'}
                                    </td>
                                    <td className="py-2 px-3 text-text-muted">
                                      {m.last_login_at ? new Date(m.last_login_at).toLocaleDateString('zh-CN') : '从未'}
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                      <button
                                        onClick={() => handleMemberRemove(org.id, m.user_id, m.username)}
                                        className="p-1 text-text-muted hover:text-red-400 transition-colors"
                                        title="移除"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1 rounded text-sm ${
                p === page
                  ? 'bg-accent text-white'
                  : 'text-text-muted hover:bg-surface-hover'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <EditOrgDialog
        open={!!editOrg}
        org={editOrg}
        onClose={() => setEditOrg(null)}
        onSaved={load}
      />

      <AddMemberDialog
        open={!!addMemberOrgId}
        orgId={addMemberOrgId || ''}
        onClose={() => setAddMemberOrgId(null)}
        onSaved={() => {
          if (expandedId) toggleExpand(expandedId).then(() => toggleExpand(expandedId!))
          load()
        }}
      />
    </div>
  )
}
