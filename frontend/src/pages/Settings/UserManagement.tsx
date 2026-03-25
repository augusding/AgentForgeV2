import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchUsers, createUser, updateUser, deleteUser, type UserInfo } from '../../api/users'
import { useAuthStore } from '../../stores/useAuthStore'

// ── Dialog 组件 ──────────────────────────────────────────

interface UserDialogProps {
  open: boolean
  user: UserInfo | null  // null = create, object = edit
  onClose: () => void
  onSaved: () => void
}

function UserDialog({ open, user, onClose, onSaved }: UserDialogProps) {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      if (user) {
        setUsername(user.username)
        setDisplayName(user.display_name || '')
        setRole(user.role as 'admin' | 'member')
        setPassword('')
      } else {
        setUsername('')
        setDisplayName('')
        setPassword('')
        setRole('member')
      }
    }
  }, [open, user])

  const handleSubmit = async () => {
    if (!user && (!username.trim() || !password)) {
      toast.error('用户名和密码不能为空')
      return
    }
    setSaving(true)
    try {
      if (user) {
        const data: any = { display_name: displayName, role }
        if (password) data.password = password
        await updateUser(user.id, data)
        toast.success('用户已更新')
      } else {
        await createUser({
          username: username.trim(),
          password,
          display_name: displayName.trim() || username.trim(),
          role,
        })
        toast.success('用户已创建')
      }
      onSaved()
      onClose()
    } catch (e: any) {
      toast.error(e?.message || '操作失败')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-text">
            {user ? '编辑用户' : '新建用户'}
          </h3>
          <button onClick={onClose} className="text-text-muted hover:text-text">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">用户名</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              disabled={!!user}
              placeholder="输入用户名"
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">显示名称</label>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="输入显示名称"
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">
              {user ? '新密码（留空不修改）' : '密码'}
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={user ? '留空则不修改' : '输入密码'}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">角色</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as 'admin' | 'member')}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="admin">管理员 (Admin)</option>
              <option value="member">成员 (Member)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-border text-text-muted hover:bg-bg"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 删除确认 Dialog ──────────────────────────────────────

interface DeleteDialogProps {
  open: boolean
  user: UserInfo | null
  onClose: () => void
  onConfirm: () => void
  deleting: boolean
}

function DeleteDialog({ open, user, onClose, onConfirm, deleting }: DeleteDialogProps) {
  if (!open || !user) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-lg font-semibold text-text mb-3">确认删除</h3>
        <p className="text-sm text-text-muted mb-5">
          确定要删除用户 <span className="font-medium text-text">{user.username}</span> 吗？此操作不可撤销。
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-border text-text-muted hover:bg-bg"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? '删除中...' : '删除'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────

export default function UserManagement() {
  const currentUser = useAuthStore(s => s.user)
  const [users, setUsers] = useState<UserInfo[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserInfo | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserInfo | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadUsers = useCallback(async () => {
    try {
      const data = await fetchUsers()
      setUsers(data)
    } catch {
      // toast handled by client interceptor
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  const handleCreate = () => {
    setEditUser(null)
    setDialogOpen(true)
  }

  const handleEdit = (u: UserInfo) => {
    setEditUser(u)
    setDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteUser(deleteTarget.id)
      toast.success('用户已删除')
      setDeleteTarget(null)
      loadUsers()
    } catch (e: any) {
      toast.error(e?.message || '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  const roleBadge = (role: string) => {
    if (role === 'admin') {
      return <span className="px-2 py-0.5 text-xs rounded-full bg-primary/15 text-primary font-medium">Admin</span>
    }
    return <span className="px-2 py-0.5 text-xs rounded-full bg-bg text-text-muted font-medium">Member</span>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-text mb-1">用户管理</h3>
          <p className="text-sm text-text-muted">管理系统用户账号和权限</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90"
        >
          <Plus size={16} />
          新建用户
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-text-muted text-sm">加载中...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-text-muted text-sm">暂无用户</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-text-muted">用户名</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted">显示名称</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted">角色</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted">最后登录</th>
                <th className="text-right px-4 py-3 font-medium text-text-muted">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-bg/50">
                  <td className="px-4 py-3 text-text font-medium">{u.username}</td>
                  <td className="px-4 py-3 text-text">{u.display_name || '-'}</td>
                  <td className="px-4 py-3">{roleBadge(u.role)}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleString('zh-CN') : '从未登录'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(u)}
                        className="p-1.5 rounded-md text-text-muted hover:text-primary hover:bg-primary/10"
                        title="编辑"
                      >
                        <Pencil size={15} />
                      </button>
                      {u.id !== currentUser?.id && (
                        <button
                          onClick={() => setDeleteTarget(u)}
                          className="p-1.5 rounded-md text-text-muted hover:text-red-500 hover:bg-red-50"
                          title="删除"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UserDialog
        open={dialogOpen}
        user={editUser}
        onClose={() => setDialogOpen(false)}
        onSaved={loadUsers}
      />

      <DeleteDialog
        open={!!deleteTarget}
        user={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
      />
    </div>
  )
}
