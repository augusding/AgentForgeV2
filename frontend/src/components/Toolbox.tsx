import { useState, useEffect } from 'react'
import { PenLine, BarChart3, FileText, Database, ChevronDown } from 'lucide-react'
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

interface Props { onSelectTool: (tool: ToolDef) => void }

export default function Toolbox({ onSelectTool }: Props) {
  const [categories, setCategories] = useState<Category[]>([])
  const [tools, setTools] = useState<ToolDef[]>([])
  const [openCat, setOpenCat] = useState<string | null>(null)

  useEffect(() => {
    client.get('/toolbox/tools').then((data: any) => {
      setCategories(data.categories || []); setTools(data.tools || [])
    }).catch(() => {})
  }, [])

  if (!categories.length) return null
  return (
    <div className="flex items-center gap-1 px-1">
      {categories.map(cat => {
        const Icon = ICON_MAP[cat.icon] || FileText
        const catTools = tools.filter(t => t.category === cat.id)
        const isOpen = openCat === cat.id
        if (!catTools.length) return null
        return (
          <div key={cat.id} className="relative">
            <button onClick={() => setOpenCat(isOpen ? null : cat.id)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors"
              style={{ color: isOpen ? 'var(--accent)' : 'var(--text-muted)', background: isOpen ? 'var(--accent)10' : 'transparent' }}>
              <Icon size={13} /><span>{cat.label}</span>
              <ChevronDown size={10} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <div className="absolute bottom-full left-0 mb-1 w-[220px] rounded-xl shadow-xl overflow-hidden z-50"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                {catTools.map(tool => (
                  <button key={tool.id} onClick={() => { onSelectTool(tool); setOpenCat(null) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-[var(--bg-hover)] transition-colors">
                    <span className="text-base">{tool.icon}</span>
                    <div>
                      <div className="text-xs font-medium" style={{ color: 'var(--text)' }}>{tool.label}</div>
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{tool.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
