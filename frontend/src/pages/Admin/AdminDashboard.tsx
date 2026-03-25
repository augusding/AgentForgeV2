import { useEffect, useState } from 'react'
import { Users, FileText, Clock, TrendingUp } from 'lucide-react'
import { fetchAdminStats, type AdminStats } from '../../api/admin'

const STATUS_LABELS: Record<string, string> = {
  new: '新线索',
  contacted: '已联系',
  converted: '已转化',
  lost: '已流失',
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAdminStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!stats) return <p className="text-text-muted text-center py-20">加载失败</p>

  const cards = [
    { label: '总用户', value: stats.total_users, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: '总线索', value: stats.total_leads, icon: FileText, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: '活跃试用', value: stats.active_trials, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: '本周新增线索', value: stats.leads_this_week, icon: TrendingUp, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  ]

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold text-text">概览</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="p-5 rounded-xl bg-surface border border-border"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-text-secondary">{c.label}</span>
              <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center`}>
                <c.icon size={18} className={c.color} />
              </div>
            </div>
            <p className="text-2xl font-bold text-text">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Leads by status */}
      <div className="p-5 rounded-xl bg-surface border border-border">
        <h3 className="text-sm font-semibold text-text mb-4">线索状态分布</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(stats.leads_by_status).map(([key, count]) => (
            <div key={key} className="text-center">
              <p className="text-lg font-bold text-text">{count}</p>
              <p className="text-xs text-text-muted">{STATUS_LABELS[key] || key}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Users by role */}
      <div className="p-5 rounded-xl bg-surface border border-border">
        <h3 className="text-sm font-semibold text-text mb-4">用户角色分布</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(stats.users_by_role).map(([role, count]) => (
            <div key={role} className="text-center">
              <p className="text-lg font-bold text-text">{count}</p>
              <p className="text-xs text-text-muted">{role === 'admin' ? '管理员' : role === 'member' ? '成员' : role}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick stat row */}
      <div className="flex items-center gap-6 text-sm text-text-secondary">
        <span>今日新增线索: <strong className="text-text">{stats.leads_today}</strong></span>
        <span>本周新增线索: <strong className="text-text">{stats.leads_this_week}</strong></span>
      </div>
    </div>
  )
}
