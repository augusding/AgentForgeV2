import { useState, type FormEvent } from 'react'
import { Lock, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import client from '../api/client'
import { useAuthStore } from '../stores/useAuthStore'

interface Props {
  forced?: boolean  // true = 不可关闭/绕过
  onClose?: () => void
}

export default function ChangePasswordDialog({ forced = false, onClose }: Props) {
  const clearMustChangePassword = useAuthStore(s => s.clearMustChangePassword)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('请填写所有字段')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('两次输入的新密码不一致')
      return
    }

    if (newPassword.length < 8) {
      toast.error('密码长度至少 8 个字符')
      return
    }

    if (!/[a-zA-Z]/.test(newPassword)) {
      toast.error('密码须包含至少一个字母')
      return
    }

    if (!/[0-9]/.test(newPassword)) {
      toast.error('密码须包含至少一个数字')
      return
    }

    setLoading(true)
    try {
      await client.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      })
      toast.success('密码修改成功')
      clearMustChangePassword()
      onClose?.()
    } catch (err: any) {
      toast.error(err?.message || '密码修改失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md bg-surface border border-border rounded-xl shadow-xl p-6 mx-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          {forced ? (
            <div className="p-2 bg-warning/10 rounded-lg">
              <AlertTriangle size={20} className="text-warning" />
            </div>
          ) : (
            <div className="p-2 bg-primary/10 rounded-lg">
              <Lock size={20} className="text-primary" />
            </div>
          )}
          <div>
            <h2 className="text-lg font-semibold text-text">
              {forced ? '安全提示: 请修改默认密码' : '修改密码'}
            </h2>
            {forced && (
              <p className="text-sm text-text-secondary mt-0.5">
                您正在使用默认密码，为安全起见请立即修改
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              当前密码
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="请输入当前密码"
              autoComplete="current-password"
              autoFocus
              className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              新密码
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="至少 8 个字符，包含字母和数字"
              autoComplete="new-password"
              className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              确认新密码
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="再次输入新密码"
              autoComplete="new-password"
              className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {!forced && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 text-text-secondary border border-border rounded-lg hover:bg-surface-hover transition-colors"
              >
                取消
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !currentPassword || !newPassword || !confirmPassword}
              className="flex-1 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '修改中...' : '确认修改'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
