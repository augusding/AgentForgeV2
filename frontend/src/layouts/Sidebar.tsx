import { NavLink, useLocation } from 'react-router-dom'
import {
  MessageSquare, BarChart3, BookOpen,
  Zap, Settings, ChevronsLeft, ChevronsRight, Menu, X,
  ShieldCheck, LayoutDashboard,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/useAuthStore'

interface NavItem {
  path: string
  label: string
  icon: React.ReactNode
  badge?: number
}

interface Props {
  approvalCount?: number
}

export default function Sidebar({ approvalCount = 0 }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const isAdmin = useAuthStore(s => s.user)?.role === 'admin'

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // V7: Simplified navigation — workstation-centric
  const navItems: NavItem[] = [
    { path: '/workstation', label: '我的工位', icon: <LayoutDashboard size={20} />, badge: approvalCount },
    { path: '/chat', label: 'AI 助手', icon: <MessageSquare size={20} /> },
    { path: '/workflows', label: '工作流', icon: <Zap size={20} /> },
    { path: '/knowledge', label: '知识库', icon: <BookOpen size={20} /> },
    { path: '/dashboard', label: 'AI效能', icon: <BarChart3 size={20} /> },
  ]

  const isActive = (path: string) => {
    if (path === '/workstation') return location.pathname === '/workstation'
    if (path === '/chat') return location.pathname.startsWith('/chat')
    if (path === '/settings') return location.pathname.startsWith('/settings')
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const sidebarContent = (
    <>
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <div key={item.path}>
            <NavLink
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors relative ${
                isActive(item.path)
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text'
              }`}
            >
              <span className="shrink-0">{item.icon}</span>
              {(!collapsed || mobileOpen) && <span className="truncate">{item.label}</span>}
              {item.badge != null && item.badge > 0 && (
                <span
                  className={`bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center ${
                    collapsed && !mobileOpen ? 'absolute top-1 right-1 w-4 h-4' : 'ml-auto w-5 h-5'
                  }`}
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </NavLink>

          </div>
        ))}
      </nav>

      <div className="border-t border-border px-2 py-3 space-y-1">
        {isAdmin && (
          <NavLink
            to="/admin"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
              location.pathname.startsWith('/admin')
                ? 'bg-accent/10 text-accent'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text'
            }`}
          >
            <ShieldCheck size={20} />
            {(!collapsed || mobileOpen) && <span>管理后台</span>}
          </NavLink>
        )}
        <NavLink
          to="/settings"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
            isActive('/settings')
              ? 'bg-accent/10 text-accent'
              : 'text-text-secondary hover:bg-surface-hover hover:text-text'
          }`}
        >
          <Settings size={20} />
          {(!collapsed || mobileOpen) && <span>设置</span>}
        </NavLink>

        {/* Collapse toggle — desktop only */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex items-center gap-3 px-3 py-2 rounded-md text-sm text-text-muted hover:bg-surface-hover hover:text-text transition-colors w-full"
        >
          {collapsed ? <ChevronsRight size={20} /> : <ChevronsLeft size={20} />}
          {!collapsed && <span>收起</span>}
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-[58px] left-2 z-40 p-1.5 bg-surface border border-border rounded-lg shadow-sm text-text-muted hover:text-text"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-surface border-r border-border flex flex-col animate-slide-in-left">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold text-text">导航</span>
              <button onClick={() => setMobileOpen(false)} className="text-text-muted hover:text-text">
                <X size={20} />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex h-full bg-surface border-r border-border flex-col transition-all duration-200"
        style={{ width: collapsed ? 64 : 220 }}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
