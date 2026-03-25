import { useState } from 'react'
import { Download } from 'lucide-react'
import toast from 'react-hot-toast'
import client from '../../api/client'

function downloadJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function DataExport() {
  const [loading, setLoading] = useState<string | null>(null)

  const handleExport = async (type: 'conversations' | 'audit-logs') => {
    setLoading(type)
    try {
      const res = await client.get(`/export/${type}`) as any
      const timestamp = new Date().toISOString().slice(0, 10)
      downloadJSON(res, `agentforge-${type}-${timestamp}.json`)
      toast.success(`已导出 ${res.count} 条记录`)
    } catch (err: any) {
      toast.error(err?.message || '导出失败')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text mb-1">数据导出</h3>
        <p className="text-sm text-text-secondary">
          导出系统数据为 JSON 格式，用于备份或审计
        </p>
      </div>

      <div className="space-y-3">
        {/* Export Conversations */}
        <div className="flex items-center justify-between p-4 bg-surface border border-border rounded-lg">
          <div>
            <h4 className="text-sm font-medium text-text">会话记录</h4>
            <p className="text-xs text-text-muted mt-0.5">导出所有对话消息数据</p>
          </div>
          <button
            onClick={() => handleExport('conversations')}
            disabled={loading === 'conversations'}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Download size={14} />
            {loading === 'conversations' ? '导出中...' : '导出'}
          </button>
        </div>

        {/* Export Audit Logs */}
        <div className="flex items-center justify-between p-4 bg-surface border border-border rounded-lg">
          <div>
            <h4 className="text-sm font-medium text-text">审计日志</h4>
            <p className="text-xs text-text-muted mt-0.5">导出操作审计记录</p>
          </div>
          <button
            onClick={() => handleExport('audit-logs')}
            disabled={loading === 'audit-logs'}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Download size={14} />
            {loading === 'audit-logs' ? '导出中...' : '导出'}
          </button>
        </div>
      </div>
    </div>
  )
}
