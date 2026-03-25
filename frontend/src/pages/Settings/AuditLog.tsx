import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import client from '../../api/client'

interface AuditEntry {
  id: number
  user_id: string
  username: string
  action: string
  target: string
  details: string
  ip_address: string
  created_at: string
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  login: { label: '登录', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  logout: { label: '登出', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  user_create: { label: '创建用户', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  user_update: { label: '更新用户', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  user_delete: { label: '删除用户', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  config_update: { label: '配置变更', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  session_delete: { label: '删除会话', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  profile_switch: { label: '切换模板', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
}

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('')
  const limit = 20

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (actionFilter) params.set('action', actionFilter)
      const res = await client.get(`/audit-logs?${params}`) as any
      setLogs(res.items || [])
      setTotal(res.total || 0)
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false)
    }
  }, [page, actionFilter])

  useEffect(() => { loadLogs() }, [loadLogs])

  const totalPages = Math.ceil(total / limit) || 1

  const getActionBadge = (action: string) => {
    const info = ACTION_LABELS[action] || { label: action, color: 'bg-gray-100 text-gray-600' }
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${info.color}`}>
        {info.label}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-text mb-1">操作日志</h3>
          <p className="text-sm text-text-muted">查看系统操作审计记录</p>
        </div>
        <select
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(1) }}
          className="px-3 py-1.5 text-sm rounded-lg border border-border bg-bg text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">全部操作</option>
          {Object.entries(ACTION_LABELS).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-text-muted text-sm">加载中...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-text-muted text-sm">暂无操作日志</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg border-b border-border">
                  <th className="text-left px-4 py-3 font-medium text-text-muted">时间</th>
                  <th className="text-left px-4 py-3 font-medium text-text-muted">用户</th>
                  <th className="text-left px-4 py-3 font-medium text-text-muted">操作</th>
                  <th className="text-left px-4 py-3 font-medium text-text-muted">目标</th>
                  <th className="text-left px-4 py-3 font-medium text-text-muted">详情</th>
                  <th className="text-left px-4 py-3 font-medium text-text-muted">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-bg/50">
                    <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-4 py-3 text-text font-medium">{log.username || '-'}</td>
                    <td className="px-4 py-3">{getActionBadge(log.action)}</td>
                    <td className="px-4 py-3 text-text truncate max-w-[150px]">{log.target || '-'}</td>
                    <td className="px-4 py-3 text-text-muted truncate max-w-[200px]">{log.details || '-'}</td>
                    <td className="px-4 py-3 text-text-muted">{log.ip_address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-text-muted">
            <span>共 {total} 条记录</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-md hover:bg-bg disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <span>{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-md hover:bg-bg disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
