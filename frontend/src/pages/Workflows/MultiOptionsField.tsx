/**
 * MultiOptionsField — 多选字段渲染器（标签式复选）。
 *
 * 两种模式:
 *  1. 静态选项 — options 来自节点属性定义（如 builtin tools）
 *  2. 动态选项 — hint="customToolSelector" 时从 API 加载自定义工具列表
 */
import { useState, useEffect } from 'react'
import { Check, Loader2 } from 'lucide-react'
import type { NodePropertyDef } from '../../api/workflow'
import { getCustomTools, type CustomTool } from '../../api/customTools'

interface Props {
  property: NodePropertyDef
  value: any
  onChange: (value: string[]) => void
}

export default function MultiOptionsField({ property, value, onChange }: Props) {
  const selected: string[] = Array.isArray(value) ? value : []
  const isCustomToolSelector = property.hint === 'customToolSelector'

  // 动态加载自定义工具
  const [customTools, setCustomTools] = useState<CustomTool[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isCustomToolSelector) return
    setLoading(true)
    getCustomTools()
      .then(tools => setCustomTools(tools.filter(t => t.enabled)))
      .catch(() => setCustomTools([]))
      .finally(() => setLoading(false))
  }, [isCustomToolSelector])

  const toggle = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter(v => v !== val))
    } else {
      onChange([...selected, val])
    }
  }

  // 动态模式: 自定义工具
  if (isCustomToolSelector) {
    if (loading) {
      return (
        <div className="flex items-center gap-2 py-2 text-[11px] text-text-muted">
          <Loader2 size={12} className="animate-spin" />
          Loading custom tools...
        </div>
      )
    }
    if (customTools.length === 0) {
      return (
        <div className="py-2 text-[11px] text-text-muted">
          No custom tools available. Create tools in the Custom Tools panel.
        </div>
      )
    }
    return (
      <div className="space-y-1">
        {customTools.map(tool => {
          const isSelected = selected.includes(tool.id)
          return (
            <button
              key={tool.id}
              onClick={() => toggle(tool.id)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md border text-left transition-colors ${
                isSelected
                  ? 'border-accent/40 bg-accent/5'
                  : 'border-border hover:border-border/80 hover:bg-surface-hover'
              }`}
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                isSelected ? 'bg-accent border-accent' : 'border-border'
              }`}>
                {isSelected && <Check size={10} className="text-white" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium text-text truncate">{tool.name}</div>
                {tool.description && (
                  <div className="text-[10px] text-text-muted truncate">{tool.description}</div>
                )}
              </div>
              <span className="text-[9px] text-text-muted shrink-0 bg-surface-hover px-1.5 py-0.5 rounded">
                {tool.template_type}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  // 静态模式: 从 options 渲染
  const options = property.options || []
  if (options.length === 0) {
    return <div className="py-2 text-[11px] text-text-muted">No options available</div>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => {
        const isSelected = selected.includes(opt.value)
        return (
          <button
            key={opt.value}
            onClick={() => toggle(opt.value)}
            title={opt.description || opt.name}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[11px] transition-colors ${
              isSelected
                ? 'border-accent/40 bg-accent/10 text-accent font-medium'
                : 'border-border text-text-secondary hover:border-border/80 hover:bg-surface-hover'
            }`}
          >
            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
              isSelected ? 'bg-accent border-accent' : 'border-border'
            }`}>
              {isSelected && <Check size={8} className="text-white" />}
            </div>
            {opt.name}
          </button>
        )
      })}
    </div>
  )
}
