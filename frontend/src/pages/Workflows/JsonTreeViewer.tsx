/**
 * JsonTreeViewer — 可折叠的 JSON 树形展示组件。
 * 支持对象、数组、基础类型，点击 key 可折叠/展开。
 */
import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'

interface JsonNodeProps {
  value: any
  depth?: number
  defaultExpanded?: boolean
}

function JsonNode({ value, depth = 0, defaultExpanded = true }: JsonNodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded && depth < 2)

  if (value === null) return <span className="text-text-muted">null</span>
  if (value === undefined) return <span className="text-text-muted">undefined</span>

  if (typeof value === 'boolean') {
    return <span className={value ? 'text-success' : 'text-error'}>{String(value)}</span>
  }
  if (typeof value === 'number') {
    return <span className="text-blue-400">{value}</span>
  }
  if (typeof value === 'string') {
    return <span className="text-amber-400 break-all">"{value}"</span>
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-text-muted">[]</span>
    return (
      <span>
        <button
          onClick={() => setExpanded(e => !e)}
          className="inline-flex items-center gap-0.5 text-text-muted hover:text-text transition-colors"
        >
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          <span className="text-text-muted">[{value.length}]</span>
        </button>
        {expanded && (
          <div className="ml-3 border-l border-border/40 pl-2 mt-0.5 space-y-0.5">
            {value.map((item, i) => (
              <div key={i} className="flex gap-1.5 items-start">
                <span className="text-text-muted shrink-0 text-[10px] pt-px">{i}</span>
                <JsonNode value={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    )
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value)
    if (keys.length === 0) return <span className="text-text-muted">{'{}'}</span>
    return (
      <span>
        <button
          onClick={() => setExpanded(e => !e)}
          className="inline-flex items-center gap-0.5 text-text-muted hover:text-text transition-colors"
        >
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          <span className="text-text-muted">{`{${keys.length}}`}</span>
        </button>
        {expanded && (
          <div className="ml-3 border-l border-border/40 pl-2 mt-0.5 space-y-0.5">
            {keys.map(key => (
              <div key={key} className="flex gap-1.5 items-start">
                <span className="text-accent/80 shrink-0 text-[10px] font-medium pt-px">{key}:</span>
                <JsonNode value={value[key]} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    )
  }

  return <span className="text-text-muted">{String(value)}</span>
}

interface JsonTreeViewerProps {
  data: Record<string, any>[] | null | undefined
  emptyText?: string
}

export default function JsonTreeViewer({ data, emptyText = '暂无数据' }: JsonTreeViewerProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-16 text-xs text-text-muted">
        {emptyText}
      </div>
    )
  }

  return (
    <div className="font-mono text-[11px] leading-relaxed space-y-2">
      {data.map((item, i) => (
        <div key={i} className="bg-bg rounded-md p-2.5 border border-border/50">
          {data.length > 1 && (
            <div className="text-[10px] text-text-muted mb-1 font-sans">Item {i + 1}</div>
          )}
          <JsonNode value={item} depth={0} defaultExpanded={true} />
        </div>
      ))}
    </div>
  )
}
