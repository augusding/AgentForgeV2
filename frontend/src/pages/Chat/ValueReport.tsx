import { motion } from 'framer-motion'
import {
  CheckCircle2, Clock, Users, FileText,
  TrendingUp, TrendingDown, Sparkles, ArrowRight
} from 'lucide-react'
import type { Scenario, KpiImpact } from '../../types/scenario'
import { formatTokenCount, formatDuration } from '../../utils/formatToken'

interface Props {
  scenario: Scenario
  agentCount: number
  durationMs?: number
  tokensUsed?: number
  onTryAnother: () => void
  onFreeExplore: () => void
}

export default function ValueReport({
  scenario,
  agentCount,
  durationMs,
  tokensUsed,
  onTryAnother,
  onFreeExplore,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="mx-auto w-full max-w-xl my-4"
    >
      <div className="rounded-xl border border-success/30 bg-success/5 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-success/20">
          <div className="w-9 h-9 rounded-full bg-success/15 flex items-center justify-center">
            <CheckCircle2 size={20} className="text-success" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text">
              任务完成：{scenario.name}
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              AI 团队已完成所有协作步骤
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 px-5 py-4 border-b border-success/10">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-primary shrink-0" />
            <div>
              <p className="text-sm font-semibold text-text">{agentCount}</p>
              <p className="text-[10px] text-text-muted">Agent 协作</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-primary shrink-0" />
            <div>
              <p className="text-sm font-semibold text-text">
                {durationMs ? formatDuration(durationMs) : `~${scenario.estimated_minutes}min`}
              </p>
              <p className="text-[10px] text-text-muted">耗时</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-primary shrink-0" />
            <div>
              <p className="text-sm font-semibold text-text">{scenario.expected_outputs.length}</p>
              <p className="text-[10px] text-text-muted">项交付物</p>
            </div>
          </div>
        </div>

        {/* Expected Outputs Checklist */}
        <div className="px-5 py-4 border-b border-success/10">
          <h4 className="text-xs font-semibold text-text-secondary mb-2.5">交付清单</h4>
          <div className="space-y-1.5">
            {scenario.expected_outputs.map((output, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + idx * 0.1 }}
                className="flex items-center gap-2 text-sm"
              >
                <CheckCircle2 size={14} className="text-success shrink-0" />
                <span className="text-text">{output}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* KPI Impact */}
        {scenario.kpi_impact && scenario.kpi_impact.length > 0 && (
          <div className="px-5 py-4 border-b border-success/10">
            <h4 className="text-xs font-semibold text-text-secondary mb-2.5 flex items-center gap-1.5">
              <Sparkles size={12} className="text-warning" />
              业务价值
            </h4>
            <div className="space-y-2">
              {scenario.kpi_impact.map((kpi: KpiImpact, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-bg text-sm"
                >
                  {kpi.direction === 'up' ? (
                    <TrendingUp size={16} className="text-success shrink-0" />
                  ) : (
                    <TrendingDown size={16} className="text-warning shrink-0" />
                  )}
                  <span className="text-text-secondary">{kpi.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Token usage */}
        {tokensUsed != null && tokensUsed > 0 && (
          <div className="px-5 py-2.5 border-b border-success/10 text-[11px] text-text-muted">
            消耗 {formatTokenCount(tokensUsed)} tokens
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 px-5 py-4">
          <button
            onClick={onTryAnother}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg
                       text-sm font-medium text-primary bg-primary/10 border border-primary/20
                       hover:bg-primary/15 transition-colors"
          >
            再试一个场景
            <ArrowRight size={14} />
          </button>
          <button
            onClick={onFreeExplore}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg
                       text-sm font-medium text-text-secondary bg-surface border border-border
                       hover:bg-surface-hover transition-colors"
          >
            自由探索
          </button>
        </div>
      </div>
    </motion.div>
  )
}
