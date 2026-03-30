import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { MessageSquare, LayoutDashboard, BookOpen, Zap, Database, Settings, LogOut } from 'lucide-react'
import { useAuthStore } from '../stores/useAuthStore'
import { ErrorBoundary } from '../components/ErrorBoundary'

const NAV = [
  { path: '/', label: '工位', icon: LayoutDashboard },
  { path: '/chat', label: 'AI 对话', icon: MessageSquare },
  { path: '/knowledge', label: '知识库', icon: BookOpen },
  { path: '/workflows', label: '工作流', icon: Zap },
  { path: '/connectors', label: '数据源', icon: Database },
]

export default function MainLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="h-screen flex" style={{ background: 'var(--bg)' }}>
      <aside className="w-[200px] flex flex-col border-r" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <div className="p-4 text-lg font-bold" style={{ color: 'var(--accent)' }}>AgentForge</div>
        <nav className="flex-1 px-2 space-y-1">
          {NAV.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path} to={path} end={path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]'
                }`
              }
              style={({ isActive }) => isActive ? { background: 'var(--bg-hover)' } : {}}
            >
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t space-y-1" style={{ borderColor: 'var(--border)' }}>
          <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{user?.username || '用户'}</div>
          <NavLink to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-2 text-xs py-1 rounded transition-colors ${
                isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`
            }>
            <Settings size={14} /> 设置
          </NavLink>
          <button onClick={handleLogout} className="flex items-center gap-2 text-xs py-1 hover:text-[var(--error)] transition-colors" style={{ color: 'var(--text-muted)' }}>
            <LogOut size={14} /> 退出登录
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <ErrorBoundary><Outlet /></ErrorBoundary>
      </main>
    </div>
  )
}
