import { TrendingDown } from 'lucide-react'
import type { SavingsStats } from '../../types/stats'
import { formatTokenCount, formatCost } from '../../utils/formatToken'

interface Props {
  data: SavingsStats
}

export default function SavingsCard({ data }: Props) {
  return (
    <div className="bg-gradient-to-r from-primary-dark to-primary rounded-lg p-6 text-white shadow-lg">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={20} className="text-accent" />
            <span className="text-sm font-medium text-white/80">AgentForge 三级上下文为你节省了</span>
          </div>
          <div className="text-xs text-white/60 space-y-0.5 mt-3">
            <div>全量加载预估: {formatTokenCount(data.full_load_estimate)} tokens → {formatCost(data.full_load_estimate * 0.000015)}</div>
            <div>实际消耗: {formatTokenCount(data.actual_used)} tokens → {formatCost(data.actual_used * 0.000015)}</div>
          </div>
        </div>

        {/* Right — savings highlight */}
        <div className="text-right shrink-0">
          <div className="text-4xl md:text-5xl font-bold text-accent">
            {formatCost(data.cost_saved)}
          </div>
          <div className="text-lg font-semibold text-accent/80 mt-1">
            节省 {data.savings_percentage.toFixed(1)}%
          </div>
          <div className="text-xs text-white/50 mt-1">
            {formatTokenCount(data.tokens_saved)} tokens saved
          </div>
        </div>
      </div>
    </div>
  )
}
