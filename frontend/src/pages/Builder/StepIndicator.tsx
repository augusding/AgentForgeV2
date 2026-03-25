import type { BuildPhase } from '../../types/builder'
import { useBuilderStore } from '../../stores/useBuilderStore'
import { Check } from 'lucide-react'

const STEPS: { phase: BuildPhase; label: string }[] = [
  { phase: 'intake', label: '信息采集' },
  { phase: 'review', label: '配置预览' },
  { phase: 'calibration', label: '场景校准' },
  { phase: 'finalized', label: '定稿导出' },
  { phase: 'deployed', label: '已部署' },
]

const PHASE_ORDER: BuildPhase[] = ['intake', 'generation', 'review', 'calibration', 'finalized', 'deployed']

function phaseIndex(phase: BuildPhase): number {
  return PHASE_ORDER.indexOf(phase)
}

export default function StepIndicator({ phase }: { phase: BuildPhase }) {
  const { goToPhase } = useBuilderStore()
  const currentIdx = phaseIndex(phase)

  const handleStepClick = (stepPhase: BuildPhase) => {
    const stepIdx = phaseIndex(stepPhase)
    // 只允许点击已完成的步骤（返回）
    if (stepIdx < currentIdx) {
      goToPhase(stepPhase)
    }
  }

  return (
    <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
      {STEPS.map((step, i) => {
        const stepIdx = phaseIndex(step.phase)
        const isCompleted = currentIdx > stepIdx
        // 'generation' is part of intake step visually
        const isCurrent = step.phase === phase || (step.phase === 'intake' && phase === 'generation')
        const isClickable = isCompleted

        return (
          <div key={step.phase} className="flex items-center">
            {i > 0 && (
              <div
                className={`w-8 h-px mx-1 ${
                  isCompleted ? 'bg-accent' : 'bg-border'
                }`}
              />
            )}
            <button
              onClick={() => handleStepClick(step.phase)}
              disabled={!isClickable}
              className={`flex items-center gap-1.5 ${isClickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                  isCompleted
                    ? 'bg-accent text-white'
                    : isCurrent
                      ? 'bg-accent/10 text-accent border-2 border-accent'
                      : 'bg-surface border border-border text-text-muted'
                }`}
              >
                {isCompleted ? <Check size={12} /> : i + 1}
              </div>
              <span
                className={`text-xs whitespace-nowrap ${
                  isCurrent ? 'text-accent font-medium' : isCompleted ? 'text-text' : 'text-text-muted'
                } ${isClickable ? 'underline decoration-dotted underline-offset-2' : ''}`}
              >
                {step.label}
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
