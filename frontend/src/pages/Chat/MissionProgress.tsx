import { formatTokenCount } from '../../utils/formatToken'

interface Props {
  title: string
  currentStep: number
  totalSteps: number
  currentAgent?: string
  description?: string
  tokens?: number
}

export default function MissionProgress({ title, currentStep, totalSteps, currentAgent, description, tokens }: Props) {
  const pct = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0

  return (
    <div className="bg-primary/5 border-b border-border px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold text-text truncate">{title}</span>
        <span className="text-xs text-text-secondary shrink-0">
          Step {currentStep}/{totalSteps}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-border rounded-full mb-2">
        <div
          className="h-full bg-accent rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>
          {currentAgent && `${currentAgent}: `}
          {description || '处理中...'}
        </span>
        {tokens != null && <span>{formatTokenCount(tokens)} tokens</span>}
      </div>
    </div>
  )
}
