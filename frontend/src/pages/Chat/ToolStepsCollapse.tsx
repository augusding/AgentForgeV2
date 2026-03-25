import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ChevronDown, Zap, Loader2, Check } from 'lucide-react'
import type { SoloToolCall } from '../../types/chat'

interface Props {
  tools: SoloToolCall[]
  isStreaming?: boolean
}

export default function ToolStepsCollapse({ tools, isStreaming }: Props) {
  const [expanded, setExpanded] = useState(false)

  const doneCount = tools.filter(t => t.status === 'done').length
  const hasRunning = tools.some(t => t.status === 'running')
  const allDone = doneCount === tools.length && tools.length > 0

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors w-full text-left"
      >
        {hasRunning
          ? <Loader2 size={14} className="text-accent animate-spin shrink-0" />
          : <Zap size={14} className="text-accent shrink-0" />
        }
        <span className="text-sm font-medium text-text">
          {hasRunning
            ? `正在执行工具调用...`
            : `执行了 ${tools.length} 个工具调用`
          }
        </span>
        {expanded
          ? <ChevronDown size={14} className="text-text-muted" />
          : <ChevronRight size={14} className="text-text-muted" />
        }
        {allDone && !isStreaming && (
          <Check size={14} className="text-success ml-auto shrink-0" />
        )}
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
            <div className="pl-5 py-1">
              {tools.map((tool, i) => {
                const isLast = i === tools.length - 1
                const connector = isLast ? '└── ' : '├── '
                return (
                  <div key={`${tool.tool}-${i}`} className="flex items-center gap-1.5 py-0.5">
                    <span className="text-text-muted text-xs font-mono whitespace-pre">{connector}</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        tool.status === 'running'
                          ? 'bg-accent/10 text-accent'
                          : 'bg-success/10 text-success'
                      }`}
                    >
                      {tool.tool}
                    </span>
                    {tool.status === 'running'
                      ? <Loader2 size={10} className="animate-spin text-accent" />
                      : <Check size={10} className="text-success" />
                    }
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
