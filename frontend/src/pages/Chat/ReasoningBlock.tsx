import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ChevronDown, Sparkles } from 'lucide-react'

const PHASE_LABELS: Record<string, string> = {
  planning: '规划推理',
  executing: '执行推理',
  reflecting: '反思推理',
}

interface Props {
  content: string
  phase?: string
  isStreaming?: boolean
}

export default function ReasoningBlock({ content, phase, isStreaming = false }: Props) {
  const [expanded, setExpanded] = useState(false)
  const wasStreamingRef = useRef(isStreaming)

  // Auto-expand during streaming, auto-collapse when done
  useEffect(() => {
    if (isStreaming && !wasStreamingRef.current) {
      setExpanded(true)
    }
    if (!isStreaming && wasStreamingRef.current) {
      setExpanded(false)
    }
    wasStreamingRef.current = isStreaming
  }, [isStreaming])

  if (!content) return null

  const label = (phase && PHASE_LABELS[phase]) || '深度推理'

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/10 hover:bg-violet-500/15 transition-colors w-full text-left"
      >
        <Sparkles size={14} className="text-violet-500 shrink-0" />
        <span className="text-sm font-medium text-violet-400">
          {label}
        </span>
        {isStreaming && (
          <span className="relative flex h-2 w-2 ml-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
          </span>
        )}
        <span className="ml-auto text-[11px] text-text-muted">
          {content.length} 字
        </span>
        {expanded
          ? <ChevronDown size={14} className="text-text-muted" />
          : <ChevronRight size={14} className="text-text-muted" />
        }
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 py-2 ml-5 border-l-2 border-violet-300/50 text-sm text-text-muted whitespace-pre-wrap font-mono leading-relaxed max-h-[400px] overflow-y-auto">
              {content}
              {isStreaming && (
                <span className="inline-block w-0.5 h-3.5 bg-violet-400 ml-0.5 align-text-bottom animate-pulse" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
