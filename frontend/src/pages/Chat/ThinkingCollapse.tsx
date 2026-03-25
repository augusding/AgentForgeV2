import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ChevronDown, Brain } from 'lucide-react'

interface Props {
  thoughts: string[]
  isStreaming?: boolean
}

export default function ThinkingCollapse({ thoughts, isStreaming = false }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (!thoughts || thoughts.length === 0) return null

  // 合并所有思考片段
  const combined = thoughts.join('\n\n')

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors w-full text-left"
      >
        <Brain size={14} className="text-amber-500 shrink-0" />
        <span className="text-sm font-medium text-text">
          思考过程
        </span>
        {isStreaming && (
          <span className="relative flex h-2 w-2 ml-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
        )}
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
            <div className="px-3 py-2 ml-5 border-l-2 border-amber-300/50 text-sm text-text-muted whitespace-pre-wrap">
              {combined}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
