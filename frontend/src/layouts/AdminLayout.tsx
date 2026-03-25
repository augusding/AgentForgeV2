import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { BarChart3, FileText, Users, Building2, Layers, Puzzle, ArrowLeft } from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'

const NAV_ITEMS = [
  { path: '/admin', label: '概览', icon: BarChart3, end: true },
  { path: '/admin/leads', label: '线索管理', icon: FileText },
  { path: '/admin/orgs', label: '组织管理', icon: Building2 },
  { path: '/admin/users', label: '用户管理', icon: Users },
  { path: '/admin/industries', label: '行业管理', icon: Layers },
  { path: '/admin/skills', label: 'Skill 管理', icon: Puzzle },
]

export default function AdminLayout() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex bg-bg">
      {/* Sidebar */}
      <aside className="w-60 bg-surface border-r border-border flex flex-col shrink-0">
        {/* Header */}
        <div className="h-14 flex items-center gap-2 px-4 border-b border-border">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-white font-bold text-xs">AF</span>
          </div>
          <span className="font-semibold text-text text-sm">管理中心</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-1">
          {NAV_ITEMS.map(({ path, label, icon: Icon, end }) => (
            <NavLink
              key={path}
              to={path}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text'
                }`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-border px-2 py-3 space-y-1">
          <button
            onClick={() => navigate('/chat')}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text transition-colors w-full"
          >
            <ArrowLeft size={18} />
            <span>返回应用</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-surface border-b border-border flex items-center justify-between px-6 shrink-0">
          <h1 className="text-sm font-semibold text-text">管理后台</h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
