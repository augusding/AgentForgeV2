import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Bell, ArrowRight, Zap, Target, Users } from 'lucide-react'
import { useAuthStore } from '../stores/useAuthStore'

interface Notif {
  id: string; category: string; title: string; body: string
  urgency: 'high' | 'medium' | 'low'
  action?: { type: string; label: string; metadata?: Record<string, any> }
}

const UC: Record<string, { bg: string; border: string; fg: string }> = {
  high:   { bg: '#ef444410', border: '#ef444440', fg: '#ef4444' },
  medium: { bg: '#f59e0b10', border: '#f59e0b40', fg: '#f59e0b' },
  low:    { bg: '#3b82f610', border: '#3b82f640', fg: '#3b82f6' },
}
const CI: Record<string, any> = { task_overdue: Target, task_due: Target, followup_overdue: Users, workflow_failed: Zap, daily_brief: Bell }

export default function NotificationBanner() {
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const wsRef = useRef<WebSocket | null>(null)
  const navigate = useNavigate()
  const { user } = useAuthStore()

  useEffect(() => {
    if (!user) return
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${proto}//${location.host}/ws`)
    wsRef.current = ws
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', user_id: user.id || 'default' }))
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'proactive_notification' && msg.data) {
          const n: Notif = { id: `${msg.data.category}_${msg.data.created_at}`, ...msg.data }
          setNotifs(prev => prev.some(x => x.id === n.id) ? prev : [n, ...prev].slice(0, 10))
        }
      } catch {}
    }
    ws.onclose = () => { setTimeout(() => { if (wsRef.current === ws) wsRef.current = null }, 5000) }
    return () => { ws.close(); wsRef.current = null }
  }, [user])

  const dismiss = useCallback((id: string) => setHidden(p => new Set([...p, id])), [])

  const act = useCallback((n: Notif) => {
    dismiss(n.id)
    const a = n.action
    if (!a) return
    if (a.type === 'chat') navigate(`/chat?prompt=${encodeURIComponent(a.metadata?.prompt || n.title)}`)
    else if (a.type === 'workflow') navigate(a.metadata?.workflowId ? `/workflows/${a.metadata.workflowId}` : '/workflows')
    else if (a.type === 'workstation') navigate('/')
    else navigate(`/chat?prompt=${encodeURIComponent(n.title)}`)
  }, [navigate, dismiss])

  const visible = notifs.filter(n => !hidden.has(n.id))
  if (!visible.length) return null

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 max-w-[380px]">
      {visible.slice(0, 3).map(n => {
        const c = UC[n.urgency] || UC.low
        const Icon = CI[n.category] || Bell
        return (
          <div key={n.id} className="rounded-xl shadow-2xl overflow-hidden animate-[slideIn_0.3s_ease-out]"
            style={{ background: 'var(--bg-surface)', border: `1px solid ${c.border}` }}>
            <div className="h-1" style={{ background: c.fg }} />
            <div className="p-3">
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: c.bg, color: c.fg }}><Icon size={14} /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium" style={{ color: 'var(--text)' }}>{n.title}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{n.body}</div>
                </div>
                <button onClick={() => dismiss(n.id)} className="p-1 rounded hover:bg-[var(--bg-hover)] shrink-0"
                  style={{ color: 'var(--text-muted)' }}><X size={12} /></button>
              </div>
              {n.action && (
                <button onClick={() => act(n)}
                  className="flex items-center gap-1.5 mt-2 ml-9 px-3 py-1.5 rounded-lg text-[10px] font-medium hover:opacity-80"
                  style={{ background: c.fg, color: 'white' }}>
                  {n.action.label} <ArrowRight size={10} />
                </button>
              )}
            </div>
          </div>
        )
      })}
      {visible.length > 3 && <div className="text-center text-[10px] py-1" style={{ color: 'var(--text-muted)' }}>还有 {visible.length - 3} 条通知</div>}
    </div>
  )
}
