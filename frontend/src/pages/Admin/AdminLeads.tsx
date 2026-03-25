import { useEffect, useState, useCallback } from 'react'
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchAdminLeads, updateLeadStatus, exportLeads, type LeadRecord, type LeadsQuery } from '../../api/admin'
import { useIndustries } from '../../hooks/useIndustries'
import toast from 'react-hot-toast'

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'new', label: '新线索' },
  { value: 'contacted', label: '已联系' },
  { value: 'converted', label: '已转化' },
  { value: 'lost', label: '已流失' },
]

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  contacted: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  converted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  lost: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
}

export default function AdminLeads() {
  const { industries, getIndustryLabel, getSubIndustryLabel } = useIndustries()
  const [items, setItems] = useState<LeadRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState<LeadsQuery>({ page: 1, limit: 20 })
  const [searchInput, setSearchInput] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchAdminLeads(query)
      setItems(res.items)
      setTotal(res.total)
    } catch {
      toast.error('加载线索失败')
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => { load() }, [load])

  const handleSearch = () => {
    setQuery((q) => ({ ...q, search: searchInput, page: 1 }))
  }

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      await updateLeadStatus(leadId, newStatus)
      toast.success('状态已更新')
      load()
    } catch {
      toast.error('更新失败')
    }
  }

  const handleExport = async () => {
    try {
      const blob = await exportLeads(query)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'leads_export.csv'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('导出成功')
    } catch {
      toast.error('导出失败')
    }
  }

  const totalPages = Math.ceil(total / (query.limit || 20))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text">线索管理</h2>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <Download size={16} />
          导出 CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索姓名/手机/公司..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-surface text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent/40"
          />
        </div>
        <select
          value={query.status || ''}
          onChange={(e) => setQuery((q) => ({ ...q, status: e.target.value, page: 1 }))}
          className="px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={query.industry || ''}
          onChange={(e) => setQuery((q) => ({ ...q, industry: e.target.value, page: 1 }))}
          className="px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text"
        >
          <option value="">全部行业</option>
          {industries.map((ind) => (
            <option key={ind.id} value={ind.id}>{ind.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-hover">
                <th className="text-left px-4 py-3 font-medium text-text-secondary">姓名</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">手机号</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">公司</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">行业</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">状态</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">时间</th>
              </tr>
            </thead>
            <tbody className="bg-surface divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-text-muted">加载中...</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-text-muted">暂无数据</td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3 text-text font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-text-secondary">{item.phone}</td>
                    <td className="px-4 py-3 text-text-secondary">{item.company || '-'}</td>
                    <td className="px-4 py-3 text-text-secondary text-xs">
                      {item.industry ? getIndustryLabel(item.industry) : '-'}
                      {item.sub_industry ? ` / ${getSubIndustryLabel(item.industry, item.sub_industry)}` : ''}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={item.status}
                        onChange={(e) => handleStatusChange(item.id, e.target.value)}
                        className={`px-2 py-1 rounded-md text-xs font-medium border-0 cursor-pointer ${STATUS_COLORS[item.status] || ''}`}
                      >
                        {STATUS_OPTIONS.filter((o) => o.value).map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-text-muted text-xs">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString('zh-CN') : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span>共 {total} 条，第 {query.page || 1}/{totalPages} 页</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuery((q) => ({ ...q, page: Math.max(1, (q.page || 1) - 1) }))}
              disabled={(query.page || 1) <= 1}
              className="p-1.5 rounded-lg border border-border hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setQuery((q) => ({ ...q, page: Math.min(totalPages, (q.page || 1) + 1) }))}
              disabled={(query.page || 1) >= totalPages}
              className="p-1.5 rounded-lg border border-border hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
