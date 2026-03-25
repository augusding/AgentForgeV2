/**
 * ExpressionEditor — 参数框的表达式模式编辑器（V1）。
 *
 * 交互:
 *  1. 参数输入框右侧有 "fx" 切换按钮
 *  2. 切换到表达式模式后，显示:
 *     - 上方: 可用节点列表 → 展开后显示该节点的输出字段树 → 点击字段自动插入表达式
 *     - 下方: 表达式文本框 + 实时预览
 *
 * 使用方式：替换 PropertyPanel 中的 StringField，通过 expressionEnabled prop 控制。
 */
import { useState, useRef } from 'react'
import { Code2, ChevronRight, ChevronDown, X } from 'lucide-react'
import type { WFNodeExecState } from '../../api/workflow'

// 从节点执行状态提取字段路径（深度递归，最多 2 层）
function extractFields(obj: any, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return []
  return Object.keys(obj).flatMap(key => {
    const path = prefix ? `${prefix}.${key}` : key
    const val = obj[key]
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return [path, ...extractFields(val, path)]
    }
    return [path]
  })
}

export interface NodeFieldTree {
  nodeId: string
  nodeName: string
  fields: string[]           // e.g. ["output", "statusCode", "data.id"]
  sampleData: any
}

interface ExpressionEditorProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  nodeContexts: NodeFieldTree[]   // 上游节点的字段信息
}

export function ExpressionEditor({
  value, onChange, placeholder, rows = 1, nodeContexts,
}: ExpressionEditorProps) {
  const [exprMode, setExprMode] = useState(() => value.includes('{{'))
  const [expandedNode, setExpandedNode] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 插入字段引用到光标位置
  const insertField = (nodeName: string, fieldPath: string) => {
    const expr = `{{ $node["${nodeName}"].json.${fieldPath} }}`
    const el = textareaRef.current
    if (!el) {
      onChange(value + expr)
      return
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    const newVal = value.slice(0, start) + expr + value.slice(end)
    onChange(newVal)
    // 恢复焦点并移动光标到插入点之后
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + expr.length, start + expr.length)
    }, 0)
  }

  if (!exprMode) {
    // 普通文本模式
    return (
      <div className="relative flex items-start gap-1">
        {rows > 1 ? (
          <textarea
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            rows={rows}
            placeholder={placeholder}
            className="flex-1 px-2.5 py-1.5 text-xs bg-bg border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-accent text-text placeholder:text-text-muted font-mono resize-y"
          />
        ) : (
          <input
            type="text"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="flex-1 px-2.5 py-1.5 text-xs bg-bg border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-accent text-text placeholder:text-text-muted"
          />
        )}
        {nodeContexts.length > 0 && (
          <button
            onClick={() => setExprMode(true)}
            title="切换到表达式模式"
            className="mt-0.5 p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded transition-colors shrink-0"
          >
            <Code2 size={12} />
          </button>
        )}
      </div>
    )
  }

  // 表达式模式
  return (
    <div className="border border-accent/40 rounded-md overflow-hidden bg-bg">
      {/* 模式标题栏 */}
      <div className="flex items-center gap-1.5 px-2 py-1 bg-accent/10 border-b border-accent/20">
        <Code2 size={11} className="text-accent" />
        <span className="text-[10px] text-accent font-medium flex-1">表达式模式</span>
        <button
          onClick={() => setExprMode(false)}
          className="p-0.5 text-text-muted hover:text-text rounded transition-colors"
        >
          <X size={11} />
        </button>
      </div>

      {/* 上游节点字段树 */}
      {nodeContexts.length > 0 && (
        <div className="border-b border-border/50 max-h-40 overflow-y-auto">
          {nodeContexts.map(ctx => (
            <div key={ctx.nodeId}>
              <button
                onClick={() => setExpandedNode(expandedNode === ctx.nodeId ? null : ctx.nodeId)}
                className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] hover:bg-surface-hover transition-colors"
              >
                {expandedNode === ctx.nodeId ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                <span className="text-text font-medium truncate">{ctx.nodeName}</span>
                <span className="text-text-muted ml-auto shrink-0">{ctx.fields.length} 字段</span>
              </button>
              {expandedNode === ctx.nodeId && (
                <div className="pl-6 pb-1 space-y-px">
                  {ctx.fields.map(field => (
                    <button
                      key={field}
                      onClick={() => insertField(ctx.nodeName, field)}
                      className="w-full text-left px-2 py-0.5 text-[10px] text-accent/80 hover:text-accent hover:bg-accent/5 rounded transition-colors font-mono truncate block"
                      title={`插入: $node["${ctx.nodeName}"].json.${field}`}
                    >
                      .{field}
                    </button>
                  ))}
                  {ctx.fields.length === 0 && (
                    <p className="px-2 py-0.5 text-[10px] text-text-muted">先执行该节点以获取字段</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 表达式输入框 */}
      <textarea
        ref={textareaRef}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        rows={Math.max(rows, 2)}
        placeholder={`{{ $node["上一节点名"].json.字段名 }}`}
        className="w-full px-2.5 py-2 text-[11px] bg-transparent font-mono text-text placeholder:text-text-muted resize-y focus:outline-none"
        spellCheck={false}
      />

      {/* 表达式预览 hint */}
      <div className="px-2.5 py-1 border-t border-border/30 bg-surface/50">
        <span className="text-[10px] text-text-muted">
          支持: {'{{ $node["节点名"].json.字段 }}'} · {'{{ $input.item.字段 }}'} · {'{{ $vars.变量 }}'}
        </span>
      </div>
    </div>
  )
}

/**
 * buildNodeContexts — 从上次执行结果和节点列表构建字段树。
 * 在 PropertyPanel 中调用，传入 execState map 和 workflow nodes。
 */
export function buildNodeContexts(
  nodeExecStates: Record<string, WFNodeExecState>,
  rfNodes: Array<{ id: string; data: any }>,
  currentNodeId: string,
): NodeFieldTree[] {
  return rfNodes
    .filter(n => n.id !== currentNodeId)
    .map(n => {
      const state = nodeExecStates[n.id]
      const sampleData = state?.outputData?.[0] ?? {}
      return {
        nodeId: n.id,
        nodeName: (n.data.label as string) || n.id,
        fields: extractFields(sampleData),
        sampleData,
      }
    })
    .filter(ctx => ctx.fields.length > 0 || true)  // 无数据也显示，让用户知道节点存在
}
