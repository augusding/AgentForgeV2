import type { QualityStats as QStats } from '../../types/stats'

interface Props {
  data: QStats
}

export default function QualityStats({ data }: Props) {
  const items = [
    { label: 'Passed', count: data.passed, color: '#2ECC71' },
    { label: 'Retry', count: data.retry, color: '#F39C12' },
    { label: 'Failed', count: data.failed, color: '#E74C3C' },
    { label: 'Escalated', count: data.escalated, color: '#6366F1' },
  ]

  const total = data.total || 1

  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <h3 className="text-sm font-semibold text-text mb-4">质量门控统计</h3>

      {/* Pass rate */}
      <div className="text-center mb-5">
        <div className={`text-4xl font-bold ${data.pass_rate >= 80 ? 'text-success' : 'text-warning'}`}>
          {data.pass_rate.toFixed(1)}%
        </div>
        <div className="text-xs text-text-muted mt-1">通过率 ({data.total} 次检查)</div>
      </div>

      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden mb-4">
        {items.map(item => (
          item.count > 0 && (
            <div
              key={item.label}
              style={{ width: `${(item.count / total) * 100}%`, backgroundColor: item.color }}
              title={`${item.label}: ${item.count}`}
            />
          )
        ))}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-xs text-text-secondary">{item.label}</span>
            <span className="text-xs font-medium text-text ml-auto">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
