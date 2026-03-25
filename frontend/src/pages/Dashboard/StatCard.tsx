import type { ReactNode } from 'react'

interface Props {
  label: string
  value: string
  unit?: string
  icon?: ReactNode
  trend?: number      // positive = up, negative = down
  trendLabel?: string
  color?: string
}

export default function StatCard({ label, value, unit, icon, trend, trendLabel, color }: Props) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</span>
        {icon && <span className="text-text-muted">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold" style={{ color: color || 'var(--color-primary)' }}>
          {value}
        </span>
        {unit && <span className="text-sm text-text-muted">{unit}</span>}
      </div>
      {trend != null && (
        <div className="mt-2 flex items-center gap-1 text-xs">
          <span className={trend > 0 ? 'text-danger' : trend < 0 ? 'text-success' : 'text-text-muted'}>
            {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend).toFixed(1)}%
          </span>
          {trendLabel && <span className="text-text-muted">{trendLabel}</span>}
        </div>
      )}
    </div>
  )
}
