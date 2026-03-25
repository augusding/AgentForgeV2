import { useState, useRef, useEffect } from 'react'
import AgentAvatar from '../../components/AgentAvatar'
import { Check, X } from 'lucide-react'
import type { Agent } from '../../types/agent'

interface Props {
  agents: Agent[]
  selectedAgents: Agent[]
  onToggle: (agent: Agent) => void
  onClear: () => void
  open: boolean
  onClose: () => void
}

export default function AgentPicker({ agents, selectedAgents, onToggle, onClear, open, onClose }: Props) {
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, onClose])

  useEffect(() => {
    if (open) setSearch('')
  }, [open])

  if (!open) return null

  const selectedIds = new Set(selectedAgents.map(a => a.id))

  const filtered = search
    ? agents.filter(a => a.name.toLowerCase().includes(search.toLowerCase()) || a.role.toLowerCase().includes(search.toLowerCase()))
    : agents

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-2 w-72 bg-surface border border-border rounded-md shadow-md z-50 overflow-hidden"
    >
      {/* Header: search */}
      <div className="p-2 border-b border-border">
        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索 Agent..."
          className="w-full text-sm px-2.5 py-1.5 border border-border rounded-sm bg-bg focus:outline-none focus:border-primary placeholder:text-text-muted"
        />
      </div>

      {/* Selected chips */}
      {selectedAgents.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b border-border bg-bg/50">
          {selectedAgents.map(agent => (
            <button
              key={agent.id}
              onClick={() => onToggle(agent)}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-accent/10 text-accent rounded-full hover:bg-accent/20 transition-colors"
            >
              {agent.name}
              <X size={10} />
            </button>
          ))}
          {selectedAgents.length > 1 && (
            <button
              onClick={onClear}
              className="text-[10px] text-text-muted hover:text-text px-1"
            >
              清除
            </button>
          )}
        </div>
      )}

      {/* Agent list */}
      <div className="max-h-56 overflow-y-auto">
        {/* Auto-route option (clear all) */}
        <button
          onClick={() => { onClear(); onClose() }}
          className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-surface-hover transition-colors ${
            selectedAgents.length === 0 ? 'text-accent font-medium' : 'text-text-secondary'
          }`}
        >
          <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
            Auto
          </span>
          <div className="flex-1 text-left">
            <div>自动路由</div>
            <div className="text-[10px] text-text-muted">系统根据指令自动匹配 Agent</div>
          </div>
          {selectedAgents.length === 0 && <Check size={14} className="text-accent" />}
        </button>

        <div className="h-px bg-border mx-2" />

        {filtered.map(agent => {
          const isSelected = selectedIds.has(agent.id)
          return (
            <button
              key={agent.id}
              onClick={() => onToggle(agent)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-surface-hover transition-colors ${
                isSelected ? 'bg-accent/5' : ''
              }`}
            >
              <AgentAvatar agentId={agent.id} name={agent.name} size="sm" status={agent.status} />
              <div className="flex-1 text-left min-w-0">
                <div className={`truncate ${isSelected ? 'text-accent font-medium' : 'text-text'}`}>
                  {agent.name}
                </div>
                <div className="text-[11px] text-text-muted truncate">{agent.role}</div>
              </div>
              {isSelected && <Check size={14} className="text-accent shrink-0" />}
            </button>
          )
        })}

        {filtered.length === 0 && (
          <div className="py-6 text-center text-sm text-text-muted">无匹配 Agent</div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1.5 border-t border-border text-[10px] text-text-muted bg-bg/30">
        选择多个 Agent 可启动多人协作模式
      </div>
    </div>
  )
}
