import { useState, useRef, useEffect, useCallback } from 'react'

interface Suggestion { label: string; insert: string; description: string; type: 'variable' | 'field' }
interface Props {
  value: string; onChange: (v: string) => void
  upstreamFields?: Array<{ name: string; type: string }>
  nodeLabels?: string[]; multiline?: boolean; rows?: number
  placeholder?: string; className?: string; style?: React.CSSProperties
}

export default function ExprAutocomplete({ value, onChange, upstreamFields = [], nodeLabels = [], multiline, rows, placeholder, className, style }: Props) {
  const [show, setShow] = useState(false)
  const [items, setItems] = useState<Suggestion[]>([])
  const [sel, setSel] = useState(0)
  const [cpos, setCpos] = useState(0)
  const ref = useRef<any>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const base: Suggestion[] = [
    { label: '$input', insert: '$input.', description: '上游输出', type: 'variable' },
    { label: '$vars', insert: '$vars.', description: '工作流变量', type: 'variable' },
    { label: '$env', insert: '$env.', description: '环境变量', type: 'variable' },
    ...nodeLabels.map(n => ({ label: `$node["${n}"]`, insert: `$node["${n}"].`, description: `节点: ${n}`, type: 'variable' as const })),
  ]
  const fields: Suggestion[] = upstreamFields.map(f => ({ label: `$input.${f.name}`, insert: `$input.${f.name}`, description: f.type, type: 'field' as const }))

  const handleInput = useCallback((nv: string, cp: number) => {
    onChange(nv); setCpos(cp)
    const before = nv.slice(0, cp); const lo = before.lastIndexOf('{{'); const lc = before.lastIndexOf('}}')
    if (lo > lc) {
      const expr = before.slice(lo + 2).trim()
      if (expr === '$' || expr === '') { setItems(base); setShow(true); setSel(0) }
      else if (expr.startsWith('$input.')) { const t = expr.slice(7); const f = fields.filter(s => !t || s.label.toLowerCase().includes(t.toLowerCase()))
        f.length ? (setItems(f), setShow(true), setSel(0)) : setShow(false) }
      else if (expr.startsWith('$')) { const f = base.filter(s => s.label.toLowerCase().startsWith(expr.toLowerCase()))
        f.length ? (setItems(f), setShow(true), setSel(0)) : setShow(false) }
      else setShow(false)
    } else setShow(false)
  }, [base, fields, onChange])

  const apply = useCallback((s: Suggestion) => {
    const before = value.slice(0, cpos); const after = value.slice(cpos)
    const lo = before.lastIndexOf('{{'); let start = lo + 2
    while (start < before.length && before[start] === ' ') start++
    const nv = before.slice(0, start) + s.insert + after; onChange(nv); setShow(false)
    setTimeout(() => { const el = ref.current; if (el) { el.focus(); const np = start + s.insert.length; el.setSelectionRange(np, np) } }, 10)
  }, [value, cpos, onChange])

  const onKey = useCallback((e: React.KeyboardEvent) => {
    if (!show) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(i => Math.min(i + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(i => Math.max(i - 1, 0)) }
    else if ((e.key === 'Enter' || e.key === 'Tab') && show) { e.preventDefault(); if (items[sel]) apply(items[sel]) }
    else if (e.key === 'Escape') setShow(false)
  }, [show, items, sel, apply])

  useEffect(() => { const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) setShow(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [])

  const tc: Record<string, string> = { variable: '#a855f7', field: '#22c55e' }
  const ip = { ref, value, onChange: (e: any) => handleInput(e.target.value, e.target.selectionStart || 0), onKeyDown: onKey,
    onClick: (e: any) => setCpos(e.target.selectionStart || 0), placeholder,
    className: className || 'w-full px-3 py-2 rounded-lg text-xs outline-none',
    style: style || { background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' } }

  return <div className="relative">
    {multiline ? <textarea {...ip} rows={rows || 4} className={`${ip.className} resize-y font-mono`} style={{ ...ip.style, minHeight: rows ? rows * 18 : 60 } as any} />
      : <input type="text" {...ip} />}
    {show && items.length > 0 && <div ref={menuRef} className="absolute left-0 right-0 z-50 mt-1 rounded-lg shadow-xl overflow-hidden max-h-[200px] overflow-y-auto"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', top: '100%' }}>
      {items.map((s, i) => <button key={i} onClick={() => apply(s)} onMouseEnter={() => setSel(i)}
        className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left ${i === sel ? 'bg-[var(--bg-hover)]' : ''}`}>
        <span className="text-[9px] px-1 rounded font-bold" style={{ color: tc[s.type] || '#999', background: `${tc[s.type] || '#999'}15` }}>
          {s.type === 'variable' ? '$' : '·'}</span>
        <span className="font-mono" style={{ color: 'var(--accent)' }}>{s.label}</span>
        <span className="flex-1 text-[9px] truncate" style={{ color: 'var(--text-muted)' }}>{s.description}</span></button>)}
      <div className="px-3 py-1 text-[9px] border-t" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>↑↓ Tab/Enter Esc</div>
    </div>}
  </div>
}

export function extractFields(data: any): Array<{ name: string; type: string }> {
  if (!data || typeof data !== 'object') return []
  const t = Array.isArray(data) ? (data[0] || {}) : data
  return typeof t === 'object' ? Object.entries(t).map(([k, v]) => ({ name: k, type: typeof v })).slice(0, 20) : []
}
