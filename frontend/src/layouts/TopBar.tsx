import { Bell, Settings, LogOut, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import { useNotificationStore } from '../stores/useNotificationStore'
import NotificationPanel from '../components/NotificationPanel'
import ThemeToggle from '../components/ThemeToggle'

export default function TopBar() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const togglePanel = useNotificationStore((s) => s.togglePanel)

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="h-14 bg-surface border-b border-border flex items-center justify-between px-4 shrink-0">
      {/* Left: Logo + Name */}
      <div className="flex items-center gap-3">
        <img src="/logo.svg" alt="智能工位" className="w-8 h-8" />
        <span className="text-base font-semibold text-primary font-heading hidden sm:inline">智能工位</span>
      </div>

      {/* Right: Notifications + Theme + Settings + User */}
      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={togglePanel}
            className="relative p-1.5 text-text-secondary hover:text-text transition-colors"
            title="通知"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-danger text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <NotificationPanel />
        </div>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Settings */}
        <button
          onClick={() => navigate('/settings')}
          className="p-1.5 text-text-secondary hover:text-text transition-colors"
          title="设置"
        >
          <Settings size={20} />
        </button>

        {/* User info + Logout */}
        {user && (
          <div className="flex items-center gap-2 ml-1 pl-3 border-l border-border">
            <div className="flex items-center gap-1.5 text-sm text-text-secondary">
              <User size={16} />
              <span className="hidden sm:inline">{user.display_name || user.username}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-text-muted hover:text-danger transition-colors"
              title="退出登录"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
