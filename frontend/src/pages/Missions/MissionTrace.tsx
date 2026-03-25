import type { MissionStep } from '../../types/mission'
import AgentAvatar from '../../components/AgentAvatar'
import StatusBadge from '../../components/StatusBadge'
import { formatTokenCount, formatDuration } from '../../utils/formatToken'
import { CheckCircle, XCircle, RotateCcw, AlertTriangle } from 'lucide-react'

interface Props {
  steps: MissionStep[]
}

const QG_ICON: Record<string, { icon: React.ReactNode; color: string }> = {
  passed: { icon: <CheckCircle size={14} />, color: '#2ECC71' },
  failed: { icon: <XCircle size={14} />, color: '#E74C3C' },
  retry: { icon: <RotateCcw size={14} />, color: '#F39C12' },
  escalate: { icon: <AlertTriangle size={14} />, color: '#6366F1' },
}

export default function MissionTrace({ steps }: Props) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <h3 className="text-sm font-semibold text-text mb-4">执行追踪</h3>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-6 bottom-6 w-px bg-border" />

        <div className="space-y-6">
          {steps.map((step, i) => {
            const qg = step.quality_decision ? QG_ICON[step.quality_decision] : null
            return (
              <div key={step.id} className="relative flex gap-4">
                {/* Node */}
                <div className="shrink-0 relative z-10">
                  <AgentAvatar agentId={step.agent_id} name={step.agent_name} size="md" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 bg-bg rounded-lg p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-xs text-text-muted">Step {step.step_number}</span>
                      <h4 className="text-sm font-medium text-text">{step.description}</h4>
                      <span className="text-xs text-text-muted">{step.agent_name}</span>
                    </div>
                    <StatusBadge status={step.status} />
                  </div>

                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted mt-2">
                    <span className="px-1.5 py-0.5 bg-surface rounded text-text-secondary">{step.model_used}</span>
                    <span>{formatTokenCount(step.tokens_used)} tokens</span>
                    <span>{formatDuration(step.duration_ms)}</span>
                    {step.quality_score != null && (
                      <span>质量: {(step.quality_score * 100).toFixed(0)}%</span>
                    )}
                    {qg && (
                      <span className="inline-flex items-center gap-1" style={{ color: qg.color }}>
                        {qg.icon}
                        {step.quality_decision}
                      </span>
                    )}
                  </div>

                  {/* Quality feedback */}
                  {step.quality_feedback && (
                    <div className="mt-2 text-xs text-warning bg-warning/5 rounded px-2 py-1">
                      {step.quality_feedback}
                    </div>
                  )}

                  {/* Output preview */}
                  {step.output && (
                    <div className="mt-2 text-xs text-text-secondary bg-surface rounded px-2 py-1.5 line-clamp-2">
                      {step.output}
                    </div>
                  )}

                  {/* Connector label */}
                  {i < steps.length - 1 && (
                    <div className="absolute -left-1 bottom-0 translate-y-[calc(100%+4px)] text-[10px] text-text-muted pl-12">
                      →
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
