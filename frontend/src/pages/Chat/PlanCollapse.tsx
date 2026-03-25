import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ChevronDown, ClipboardList } from 'lucide-react'
import MarkdownRenderer from '../../components/MarkdownRenderer'

interface Props {
  plan: string
}

export default function PlanCollapse({ plan }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors w-full text-left"
      >
        <ClipboardList size={14} className="text-primary shrink-0" />
        <span className="text-sm font-medium text-text">执行计划</span>
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
            <div className="px-3 py-2 ml-5 border-l-2 border-border/50 text-sm text-text-muted">
              <MarkdownRenderer content={plan} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
