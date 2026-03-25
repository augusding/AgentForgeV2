import { useRef, useEffect, useMemo } from 'react'
import { X } from 'lucide-react'
import type { QuickCommand } from '../../types/chat'

interface Props {
  commands: QuickCommand[]
  open: boolean
  onClose: () => void
  onSelect: (template: string) => void
}

export default function QuickCommands({ commands, open, onClose, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, onClose])

  const grouped = useMemo(() => {
    const map = new Map<string, QuickCommand[]>()
    for (const cmd of commands) {
      const list = map.get(cmd.category) || []
      list.push(cmd)
      map.set(cmd.category, list)
    }
    return Array.from(map.entries())
  }, [commands])

  if (!open) return null

  return (
    <div
      ref={ref}
      className="absolute bottom-full right-0 mb-2 w-80 bg-surface border border-border rounded-lg shadow-lg z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold text-text">快捷指令</span>
        <button onClick={onClose} className="text-text-muted hover:text-text transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Commands */}
      <div className="max-h-80 overflow-y-auto p-2">
        {grouped.map(([category, cmds]) => (
          <div key={category} className="mb-2">
            <div className="px-2 py-1 text-[11px] font-medium text-text-muted uppercase tracking-wide">
              {category}
            </div>
            {cmds.map(cmd => (
              <button
                key={cmd.id}
                onClick={() => { onSelect(cmd.template); onClose() }}
                className="w-full text-left px-3 py-2.5 rounded-md hover:bg-surface-hover transition-colors"
              >
                <div className="text-sm font-medium text-text">{cmd.label}</div>
                <div className="text-xs text-text-muted truncate mt-0.5">{cmd.template.slice(0, 60)}...</div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
