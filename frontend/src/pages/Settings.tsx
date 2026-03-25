import { useAuthStore } from '../stores/useAuthStore'

export default function Settings() {
  const { user } = useAuthStore()
  return (
    <div className="p-6 max-w-[600px]">
      <h1 className="text-lg font-bold mb-4">设置</h1>
      <div className="p-4 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <p className="text-sm">用户名: {user?.username || '-'}</p>
        <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>角色: {user?.role || '-'}</p>
      </div>
    </div>
  )
}
