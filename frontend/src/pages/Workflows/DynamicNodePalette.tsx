/**
 * 动态节点面板 — 从后端获取节点类型目录。
 * 支持拖拽添加到画布。
 */
import { useState, useMemo } from 'react'
import {
  Play, Webhook, Clock, Bot, Globe, GitBranch, Pencil,
  Filter, Merge, Code, Repeat, Bell, UserCheck, Timer,
  Search, ChevronDown, ChevronRight,
  Mail, MessageSquare, Database, Sparkles, FileSpreadsheet, FileText, Table,
} from 'lucide-react'
import type { NodeTypeDef } from '../../api/workflow'

const ICON_MAP: Record<string, any> = {
  Play, Webhook, Clock, Bot, Globe, GitBranch, Pencil,
  Filter, Merge, Code, Repeat, Bell, UserCheck, Timer,
  Mail, MessageSquare, Database, Sparkles, FileSpreadsheet, FileText, Table,
}

const GROUP_LABELS: Record<string, string> = {
  trigger: '触发器',
  transform: '数据处理',
  flow: '流程控制',
  communication: '通讯',
  database: '数据库',
  ai: 'AI / LLM',
  document: '文档',
}

const GROUP_ORDER = ['trigger', 'transform', 'flow', 'communication', 'database', 'ai', 'document']

interface Props {
  nodeTypes: NodeTypeDef[]
  onAdd: (typeName: string) => void
}

export default function DynamicNodePalette({ nodeTypes, onAdd }: Props) {
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const filtered = useMemo(() => {
    if (!search) return nodeTypes
    const q = search.toLowerCase()
    return nodeTypes.filter(
      nt => nt.displayName.toLowerCase().includes(q) ||
            nt.description.toLowerCase().includes(q)
    )
  }, [nodeTypes, search])

  const grouped = useMemo(() => {
    const groups: Record<string, NodeTypeDef[]> = {}
    for (const nt of filtered) {
      const g = nt.group || 'transform'
      if (!groups[g]) groups[g] = []
      groups[g].push(nt)
    }
    return groups
  }, [filtered])

  const handleDragStart = (e: React.DragEvent, typeName: string) => {
    e.dataTransfer.setData('application/workflow-node-type', typeName)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="w-56 border-r border-border bg-surface h-full overflow-y-auto">
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-2.5 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search nodes..."
            className="w-full pl-8 pr-3 py-2 text-xs bg-bg border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent text-text placeholder:text-text-muted"
          />
        </div>
      </div>

      <div className="p-2">
        {GROUP_ORDER.filter(g => grouped[g]).map(group => {
          const isCollapsed = collapsed[group]
          const items = grouped[group]

          return (
            <div key={group} className="mb-2">
              <button
                onClick={() => setCollapsed(c => ({ ...c, [group]: !c[group] }))}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider hover:text-text transition-colors"
              >
                {isCollapsed
                  ? <ChevronRight size={11} />
                  : <ChevronDown size={11} />
                }
                {GROUP_LABELS[group] || group}
                <span className="ml-auto text-text-muted/50">{items.length}</span>
              </button>

              {!isCollapsed && (
                <div className="space-y-1">
                  {items.map(nt => {
                    const Icon = ICON_MAP[nt.icon] || Bot
                    return (
                      <div
                        key={nt.name}
                        draggable
                        onDragStart={e => handleDragStart(e, nt.name)}
                        onClick={() => onAdd(nt.name)}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-md cursor-grab hover:bg-surface-hover active:cursor-grabbing transition-colors group"
                        title={nt.description}
                      >
                        <div
                          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                          style={{ backgroundColor: (nt.color || '#6366f1') + '20' }}
                        >
                          <Icon size={14} style={{ color: nt.color || '#6366f1' }} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-text truncate">
                            {nt.displayName}
                          </div>
                          <div className="text-[10px] text-text-muted truncate">
                            {nt.description}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
