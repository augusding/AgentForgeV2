import { useState, useEffect, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, Check, Loader2, Wrench } from 'lucide-react'
import AgentAvatar from '../../components/AgentAvatar'
import MarkdownRenderer from '../../components/MarkdownRenderer'
import { formatTokenCount, formatDuration } from '../../utils/formatToken'
import type { StepState } from '../../types/chat'

// ── 轮播等待提示语 ──
const STEP_WAITING_PHRASES = [
  '思考中...',
  '处理中...',
  '分析中...',
  '努力工作中...',
  '马上就好...',
]

function StepWaitingText() {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => {
      setIndex(i => (i + 1) % STEP_WAITING_PHRASES.length)
    }, 2500)
    return () => clearInterval(timer)
  }, [])
  return (
    <div className="flex items-center gap-1.5 mt-3 py-1">
      <span className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      <span className="text-xs text-text-muted ml-1">{STEP_WAITING_PHRASES[index]}</span>
    </div>
  )
}

interface Props {
  step: StepState
  stepNumber: number
  totalSteps: number
  onToggleCollapse: () => void
}

function StepCard({ step, stepNumber, totalSteps, onToggleCollapse }: Props) {
  const isRunning = step.status === 'running'
  const isDone = step.status === 'done'
  const isError = step.status === 'error'

  return (
    <div
      className={`border rounded-lg mb-2 transition-all duration-300 ${
        isRunning
          ? 'border-accent/50 bg-accent/5 shadow-sm'
          : isDone
            ? 'border-border bg-surface'
            : isError
              ? 'border-danger/50 bg-danger/5'
              : 'border-border bg-surface'
      }`}
    >
      {/* ── 可点击 Header ── */}
      <button
        onClick={onToggleCollapse}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-surface-hover/50 transition-colors rounded-lg"
      >
        {/* 状态图标 */}
        <div className="shrink-0 w-5 h-5 flex items-center justify-center">
          {isRunning && <Loader2 size={15} className="animate-spin text-accent" />}
          {isDone && <Check size={15} className="text-success" />}
          {isError && <span className="w-3 h-3 rounded-full bg-danger" />}
        </div>

        {/* Agent 头像 */}
        <AgentAvatar
          agentId={step.agent_id}
          name={step.agent_name}
          size="sm"
          status={isRunning ? 'executing' : isDone ? 'idle' : 'waiting'}
        />

        {/* 步骤信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-text-muted">
              {stepNumber}/{totalSteps}
            </span>
            <span className="text-sm font-semibold text-text truncate">
              {step.agent_name}
            </span>
            {isRunning && (
              <span className="inline-flex items-center gap-1 text-[11px] text-accent">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
                </span>
                执行中
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted truncate mt-0.5">{step.instruction}</p>
        </div>

        {/* 右侧元信息 + 折叠箭头 */}
        <div className="flex items-center gap-2 shrink-0">
          {isDone && step.duration_ms != null && (
            <span className="text-[10px] text-text-muted">
              {formatDuration(step.duration_ms)}
            </span>
          )}
          {(isDone || isRunning) ? (
            step.collapsed
              ? <ChevronRight size={14} className="text-text-muted" />
              : <ChevronDown size={14} className="text-text-muted" />
          ) : null}
        </div>
      </button>

      {/* ── 可折叠内容区 ── */}
      <AnimatePresence initial={false}>
        {!step.collapsed && (isRunning || isDone || isError) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 border-t border-border/30">
              {/* 工具调用标签 */}
              {step.tools.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {step.tools.map((t, i) => (
                    <span
                      key={`${t.tool}-${i}`}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        t.status === 'running'
                          ? 'bg-accent/10 text-accent'
                          : 'bg-success/10 text-success'
                      }`}
                    >
                      <Wrench size={10} />
                      {t.tool}
                      {t.status === 'running' && (
                        <Loader2 size={10} className="animate-spin" />
                      )}
                    </span>
                  ))}
                </div>
              )}

              {/* 流式内容 */}
              {step.content ? (
                <div className="mt-2 text-sm">
                  <MarkdownRenderer content={step.content} />
                  {isRunning && (
                    <span className="inline-block w-0.5 h-4 bg-accent ml-0.5 align-text-bottom animate-pulse" />
                  )}
                </div>
              ) : isRunning ? (
                <StepWaitingText />
              ) : null}

              {/* 完成后元数据 — 默认只显示耗时，hover 显示详细 */}
              {isDone && (step.duration_ms != null || step.model || step.tokens_used != null) && (
                <div className="group/meta flex items-center gap-3 mt-2 pt-2 border-t border-border/20 text-[10px] text-text-muted">
                  {step.duration_ms != null && (
                    <span>{formatDuration(step.duration_ms)}</span>
                  )}
                  <div className="hidden group-hover/meta:flex items-center gap-3 transition-opacity">
                    {step.model && <span>{step.model}</span>}
                    {step.tokens_used != null && (
                      <span>{formatTokenCount(step.tokens_used)} tokens</span>
                    )}
                    {step.quality_score != null && (
                      <span className={step.quality_score >= 0.7 ? 'text-success' : 'text-warning'}>
                        质量: {(step.quality_score * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// P2 Task 7: React.memo — step 引用不变时跳过重渲染
export default memo(StepCard, (prev, next) => {
  return (
    prev.step === next.step &&
    prev.stepNumber === next.stepNumber &&
    prev.totalSteps === next.totalSteps
  )
})
