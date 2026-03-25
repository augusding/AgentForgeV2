/**
 * FeatureTip — 板块功能提示气泡
 *
 * 点击 ? 图标弹出浮层，介绍板块功能亮点和使用引导。
 */
import { useState, useRef, useEffect } from 'react'
import { HelpCircle, X, Sparkles } from 'lucide-react'

interface TipSection {
  title: string
  items: string[]
}

interface Props {
  sections: TipSection[]
  smartNote?: string  // 智能涌现提示
}

export default function FeatureTip({ sections, smartNote }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Click outside to close
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className="p-0.5 text-text-muted/40 hover:text-accent transition-colors"
        title="功能说明"
      >
        <HelpCircle size={13} />
      </button>

      {open && (
        <div className="absolute top-6 left-0 z-50 w-72 bg-surface border border-border rounded-xl shadow-xl animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
            <span className="text-xs font-semibold text-text">功能说明</span>
            <button onClick={() => setOpen(false)} className="text-text-muted hover:text-text">
              <X size={13} />
            </button>
          </div>

          {/* Content */}
          <div className="px-3.5 py-3 space-y-3 max-h-[320px] overflow-y-auto">
            {sections.map((section, i) => (
              <div key={i}>
                <p className="text-[11px] font-semibold text-text mb-1.5">{section.title}</p>
                <ul className="space-y-1">
                  {section.items.map((item, j) => (
                    <li key={j} className="text-[11px] text-text-secondary leading-relaxed flex gap-1.5">
                      <span className="text-accent shrink-0 mt-0.5">-</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Smart emergence note */}
            {smartNote && (
              <div className="flex gap-2 px-2.5 py-2 rounded-lg bg-accent/5 border border-accent/15">
                <Sparkles size={12} className="text-accent shrink-0 mt-0.5" />
                <p className="text-[10px] text-accent/90 leading-relaxed">{smartNote}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
