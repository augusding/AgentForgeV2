import { useEffect, useRef } from 'react'
import { CheckCheck, X } from 'lucide-react'
import { useNotificationStore, type Notification } from '../stores/useNotificationStore'

function timeAgo(dateStr: string): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m}分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}小时前`
  return `${Math.floor(h / 24)}天前`
}

const TYPE_COLORS: Record<string, string> = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  warning: 'bg-yellow-500',
  info: 'bg-blue-500',
}

function NotifItem({ n, onRead }: { n: Notification; onRead: (id: number) => void }) {
  return (
    <div
      className={`px-4 py-3 border-b border-border last:border-0 hover:bg-bg/50 cursor-pointer transition-colors ${
        n.read ? 'opacity-60' : ''
      }`}
      onClick={() => !n.read && onRead(n.id)}
    >
      <div className="flex items-start gap-2.5">
        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${TYPE_COLORS[n.type] || 'bg-gray-400'}`} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text">{n.title}</div>
          {n.message && (
            <div className="text-xs text-text-muted mt-0.5 line-clamp-2">{n.message}</div>
          )}
          <div className="text-[11px] text-text-muted mt-1">{timeAgo(n.created_at)}</div>
        </div>
        {!n.read && (
          <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
        )}
      </div>
    </div>
  )
}

export default function NotificationPanel() {
  const { notifications, unreadCount, panelOpen, closePanel, markRead, markAllRead } = useNotificationStore()
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!panelOpen) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closePanel()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [panelOpen, closePanel])

  if (!panelOpen) return null

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-1 w-80 max-h-[480px] bg-card rounded-xl shadow-xl border border-border z-50 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="text-sm font-semibold text-text">
          通知
          {unreadCount > 0 && (
            <span className="ml-1.5 text-xs text-primary">({unreadCount})</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="p-1 text-text-muted hover:text-primary text-xs flex items-center gap-1"
              title="全部已读"
            >
              <CheckCheck size={14} />
            </button>
          )}
          <button onClick={closePanel} className="p-1 text-text-muted hover:text-text">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="text-center py-8 text-sm text-text-muted">暂无通知</div>
        ) : (
          notifications.map(n => (
            <NotifItem key={n.id} n={n} onRead={markRead} />
          ))
        )}
      </div>
    </div>
  )
}
