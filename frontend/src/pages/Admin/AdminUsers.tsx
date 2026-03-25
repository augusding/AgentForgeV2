import { useEffect, useState } from 'react'
import { Search, Plus, Pencil, Trash2, Loader2, X } from 'lucide-react'
import { fetchUsers, createUser, updateUser, deleteUser, type UserInfo } from '../../api/users'
import toast from 'react-hot-toast'

const PLAN_BADGES: Record<string, string> = {
  trial: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  free: 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-300',
  starter: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  pro: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
  enterprise: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', display_name: '', password: '', role: 'member' })

  // Edit state
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null)
  const [editForm, setEditForm] = useState({ display_name: '', role: '' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchUsers()
      setUsers(data)
    } catch {
      toast.error('加载用户失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Filtered users
  const filtered = users.filter((u) => {
    const q = search.toLowerCase()
    return !q || u.username.toLowerCase().includes(q) || (u.display_name || '').toLowerCase().includes(q)
  })

  const handleCreate = async () => {
    if (!newUser.username.trim() || !newUser.password) return
    setCreating(true)
    try {
      await createUser(newUser)
      toast.success('创建成功')
      setShowCreate(false)
      setNewUser({ username: '', display_name: '', password: '', role: 'member' })
      load()
    } catch (err: any) {
      toast.error(err?.message || '创建失败')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (userId: string, username: string) => {
    if (!confirm(`确认删除用户 "${username}"？`)) return
    try {
      await deleteUser(userId)
      toast.success('已删除')
      load()
    } catch (err: any) {
      toast.error(err?.message || '删除失败')
    }
  }

  const openEdit = (u: UserInfo) => {
    setEditingUser(u)
    setEditForm({
      display_name: u.display_name || '',
      role: u.role || 'member',
    })
  }

  const handleSaveEdit = async () => {
    if (!editingUser) return
    setSaving(true)
    try {
      await updateUser(editingUser.id, editForm)
      toast.success('更新成功')
      setEditingUser(null)
      load()
    } catch (err: any) {
      toast.error(err?.message || '更新失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text">用户管理</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <Plus size={16} />
          新建用户
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="p-5 rounded-xl bg-surface border border-border space-y-4">
          <h3 className="text-sm font-semibold text-text">新建用户</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} placeholder="用户名 *" className="px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text placeholder:text-text-muted" />
            <input value={newUser.display_name} onChange={(e) => setNewUser({ ...newUser, display_name: e.target.value })} placeholder="显示名称" className="px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text placeholder:text-text-muted" />
            <input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="密码 *" className="px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text placeholder:text-text-muted" />
            <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text">
              <option value="member">成员</option>
              <option value="admin">管理员</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={creating || !newUser.username.trim() || !newUser.password} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2">
              {creating && <Loader2 size={14} className="animate-spin" />}
              创建
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-surface-hover">
              取消
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索用户名/名称..." className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-surface text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent/40" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-hover">
                <th className="text-left px-4 py-3 font-medium text-text-secondary">用户名</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">显示名称</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">角色</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">套餐</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">最后登录</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">操作</th>
              </tr>
            </thead>
            <tbody className="bg-surface divide-y divide-border">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-text-muted">加载中...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-text-muted">暂无数据</td></tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3 text-text font-medium">{u.username}</td>
                    <td className="px-4 py-3 text-text-secondary">{u.display_name || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-surface-hover text-text-secondary'}`}>
                        {u.role === 'admin' ? '管理员' : '成员'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${PLAN_BADGES[(u as any).plan || 'free'] || ''}`}>
                        {(u as any).plan || 'free'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-muted text-xs">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('zh-CN') : '从未'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(u)} className="p-1.5 text-text-muted hover:text-accent transition-colors" title="编辑">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(u.id, u.username)} className="p-1.5 text-text-muted hover:text-danger transition-colors" title="删除">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-text">编辑用户 — {editingUser.username}</h3>
              <button onClick={() => setEditingUser(null)} className="p-1 text-text-muted hover:text-text"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-secondary mb-1 block">显示名称</label>
                <input value={editForm.display_name} onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text" />
              </div>
              <div>
                <label className="text-xs text-text-secondary mb-1 block">角色</label>
                <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text">
                  <option value="member">成员</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditingUser(null)} className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-surface-hover">取消</button>
              <button onClick={handleSaveEdit} disabled={saving} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
