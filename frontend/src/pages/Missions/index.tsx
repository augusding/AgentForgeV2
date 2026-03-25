import { useEffect, useState } from 'react'
import PageHeader from '../../components/PageHeader'
import SearchInput from '../../components/SearchInput'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import MissionCard from './MissionCard'
import { useMissionStore } from '../../stores/useMissionStore'
import type { MissionStatus } from '../../types/mission'

const STATUS_FILTERS: { label: string; value: MissionStatus | 'all' }[] = [
  { label: '全部', value: 'all' },
  { label: '执行中', value: 'in_progress' },
  { label: '已完成', value: 'completed' },
  { label: '待审批', value: 'waiting_approval' },
  { label: '失败', value: 'failed' },
]

export default function Missions() {
  const { missions, loading, load } = useMissionStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<MissionStatus | 'all'>('all')

  useEffect(() => {
    if (missions.length === 0) load()
  }, [missions.length, load])

  const filtered = missions.filter(m => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return m.title.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)
    }
    return true
  })

  const counts = missions.reduce<Record<string, number>>((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1
    return acc
  }, {})

  if (loading) {
    return (
      <div>
        <PageHeader title="任务历史" description="查看所有 Mission 记录与追踪链" />
        <LoadingSpinner fullPage />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="任务历史" description="查看所有 Mission 记录与追踪链" />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <SearchInput value={search} onChange={setSearch} placeholder="搜索任务..." />
        <div className="flex gap-1.5">
          {STATUS_FILTERS.map(f => {
            const count = f.value === 'all' ? missions.length : (counts[f.value] || 0)
            const active = statusFilter === f.value
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  active
                    ? 'bg-primary text-white border-primary'
                    : 'bg-surface text-text-muted border-border hover:border-primary/40'
                }`}
              >
                {f.label} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          variant={search || statusFilter !== 'all' ? 'no-results' : 'empty'}
          title={search ? '未找到匹配的任务' : '暂无任务'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(m => (
            <MissionCard key={m.id} mission={m} />
          ))}
        </div>
      )}
    </div>
  )
}
