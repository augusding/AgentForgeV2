import { useAuthStore } from '../stores/useAuthStore'
import { AlertTriangle, Clock, XCircle } from 'lucide-react'

export default function TrialBanner() {
  const user = useAuthStore((s) => s.user)

  if (!user || user.plan !== 'trial') return null

  const remaining = user.trial_remaining_days ?? 0

  // Trial expired
  if (remaining <= 0) {
    return (
      <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center justify-center gap-2 text-sm">
        <XCircle size={14} className="text-red-400 shrink-0" />
        <span className="text-red-300">试用已到期</span>
        <button
          onClick={() => window.open('mailto:contact@agentforge.ai', '_blank')}
          className="ml-2 px-3 py-0.5 rounded-full bg-red-500/20 text-red-300 text-xs font-medium hover:bg-red-500/30 transition-colors"
        >
          联系销售
        </button>
      </div>
    )
  }

  // Trial expiring soon (≤ 1 day)
  if (remaining <= 1) {
    return (
      <div className="bg-orange-500/10 border-b border-orange-500/20 px-4 py-2 flex items-center justify-center gap-2 text-sm">
        <AlertTriangle size={14} className="text-orange-400 shrink-0" />
        <span className="text-orange-300">
          试用即将到期，剩余不足 1 天
        </span>
        <button
          onClick={() => window.open('mailto:contact@agentforge.ai', '_blank')}
          className="ml-2 px-3 py-0.5 rounded-full bg-orange-500/20 text-orange-300 text-xs font-medium hover:bg-orange-500/30 transition-colors"
        >
          升级方案
        </button>
      </div>
    )
  }

  // Trial active
  return (
    <div className="bg-sky-500/10 border-b border-sky-500/20 px-4 py-2 flex items-center justify-center gap-2 text-sm">
      <Clock size={14} className="text-sky-400 shrink-0" />
      <span className="text-sky-300">
        您正在免费试用中，剩余 {Math.ceil(remaining)} 天
      </span>
    </div>
  )
}
