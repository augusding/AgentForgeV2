import { useState, useEffect, useRef } from 'react'
import { PenLine, BarChart3, FileText, Database, ChevronUp, ChevronDown, Wrench } from 'lucide-react'
import client from '../api/client'

export interface ToolField {
  key: string; label: string; type: 'text' | 'textarea' | 'select' | 'file'
  placeholder?: string; options?: string[]; default?: string; required?: boolean
}
export interface ToolDef {
  id: string; label: string; description: string; icon: string
  category: string; sort: number; fields: ToolField[]
  prompt_template: string; tool_hint?: string; suffix?: string
}
interface Category { id: string; label: string; icon: string; sort: number }

const ICON_MAP: Record<string, any> = { PenLine, BarChart3, FileText, Database }

interface Props { onSelectTool: (tool: ToolDef) => void; expanded: boolean; onToggle: () => void }

export default function Toolbox({ onSelectTool, expanded, onToggle }: Props) {
  const [categories, setCategories] = useState<Category[]>([])
  const [tools, setTools] = useState<ToolDef[]>([])
  const [activeCat, setActiveCat] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    client.get('/toolbox/tools').then((data: any) => {
      const cats = data.categories || []
      setCategories(cats); setTools(data.tools || [])
      if (cats.length) setActiveCat(cats[0].id)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!expanded) return
    const h = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as HTMLElement)) onToggle() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [expanded, onToggle])

  if (!categories.length) return null
  const catTools = tools.filter(t => t.category === activeCat)

  return (
    <div ref={panelRef}>
      {expanded && (
        <div className="mb-2 rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-1 px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
            {categories.map(cat => {
              const Icon = ICON_MAP[cat.icon] || FileText
              const isActive = activeCat === cat.id
              return (
                <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
                  style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)', background: isActive ? 'var(--accent)10' : 'transparent', fontWeight: isActive ? 600 : 400 }}>
                  <Icon size={13} /><span>{cat.label}</span>
                  <span className="text-[9px] opacity-60">({tools.filter(t => t.category === cat.id).length})</span>
                </button>
              )
            })}
          </div>
          <div className="grid grid-cols-4 gap-1 p-2">
            {catTools.map(tool => (
              <button key={tool.id} onClick={() => { onSelectTool(tool); onToggle() }}
                className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-center">
                <span className="text-xl">{tool.icon}</span>
                <span className="text-[11px] leading-tight" style={{ color: 'var(--text)' }}>{tool.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <button onClick={onToggle}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] transition-colors"
        style={{ color: expanded ? 'var(--accent)' : 'var(--text-muted)', background: expanded ? 'var(--accent)10' : 'transparent' }}>
        <Wrench size={13} /><span>工具箱</span>
        {expanded ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
      </button>
    </div>
  )
}
