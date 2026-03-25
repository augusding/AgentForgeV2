/**
 * ExecutionLogPanel — 底部可折叠执行日志面板。
 *
 * 展示:
 *  - 本次执行 ID、总状态、总耗时
 *  - 各节点执行时间线: 名称 → 状态 → items → 耗时
 */
import type { Node } from '@xyflow/react'
import { ChevronUp, ChevronDown, CheckCircle2, XCircle, Clock, Circle, Loader2 } from 'lucide-react'
import type { WFExecution, WFNodeExecState } from '../../api/workflow'

interface Props {
  execution: WFExecution | null
  open: boolean
  onToggle: () => void
  nodes: Node[]   // ReactFlow 节点，用于根据 ID 查节点名
}

const STATUS_ICON: Record<string, any> = {
  completed: CheckCircle2,
  failed:    XCircle,
  running:   Loader2,
  skipped:   Circle,
  waiting:   Clock,
  pending:   Circle,
}

const STATUS_COLOR: Record<string, string> = {
  completed: 'text-success',
  failed:    'text-error',
  running:   'text-blue-400',
  skipped:   'text-text-muted',
  waiting:   'text-amber-400',
  pending:   'text-text-muted',
}

export default function ExecutionLogPanel({ execution, open, onToggle, nodes }: Props) {
  // 节点 ID → 名称映射
  const nodeNameMap: Record<string, string> = {}
  for (const n of nodes) {
    nodeNameMap[n.id] = (n.data as any).label || n.id
  }

  const totalDuration = execution && execution.endTime && execution.startTime
    ? execution.endTime - execution.startTime
    : null

  const nodeEntries: Array<[string, WFNodeExecState]> = execution
    ? Object.entries(execution.nodes).sort((a, b) => {
        // 按开始时间排序（没有就按原始顺序）
        return 0
      })
    : []

  return (
    <div className="shrink-0 border-t border-border bg-surface">
      {/* Panel header — 始终可见 */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
      >
        {open ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        <span className="font-medium">执行日志</span>

        {execution && (
          <>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ml-1 ${
              execution.status === 'completed' ? 'bg-success/10 text-success' :
              execution.status === 'failed'    ? 'bg-error/10 text-error' :
              'bg-surface-hover text-text-muted'
            }`}>
              {execution.status}
            </span>
            <span className="text-[10px] text-text-muted font-mono ml-1">
              {execution.executionId.slice(0, 8)}
            </span>
            {totalDuration !== null && (
              <span className="text-[10px] text-text-muted ml-auto">
                总耗时 {totalDuration < 1
                  ? `${Math.round(totalDuration * 1000)}ms`
                  : `${totalDuration.toFixed(2)}s`}
              </span>
            )}
          </>
        )}

        {!execution && (
          <span className="text-[10px] text-text-muted ml-1">执行工作流后显示日志</span>
        )}
      </button>

      {/* Panel body — 展开时显示 */}
      {open && execution && (
        <div className="px-4 pb-3 max-h-48 overflow-y-auto">
          {nodeEntries.length === 0 ? (
            <p className="text-xs text-text-muted py-2">无节点执行记录</p>
          ) : (
            <div className="space-y-1">
              {nodeEntries.map(([nodeId, ns]) => {
                const Icon = STATUS_ICON[ns.status] ?? Circle
                const colorCls = STATUS_COLOR[ns.status] ?? 'text-text-muted'
                const name = nodeNameMap[nodeId] || nodeId

                return (
                  <div
                    key={nodeId}
                    className="flex items-center gap-2 py-1 border-b border-border/30 last:border-0"
                  >
                    <Icon
                      size={12}
                      className={`shrink-0 ${colorCls} ${ns.status === 'running' ? 'animate-spin' : ''}`}
                    />
                    <span className="text-xs text-text truncate flex-1 min-w-0">{name}</span>
                    {ns.outputItems !== undefined && (
                      <span className="text-[10px] text-text-muted shrink-0">
                        {ns.outputItems} items
                      </span>
                    )}
                    {ns.duration !== undefined && (
                      <span className="text-[10px] text-text-muted shrink-0 w-14 text-right">
                        {ns.duration < 1
                          ? `${Math.round(ns.duration * 1000)}ms`
                          : `${ns.duration.toFixed(2)}s`}
                      </span>
                    )}
                    {ns.status === 'failed' && ns.error && (
                      <span className="text-[10px] text-error truncate max-w-[140px]" title={ns.error}>
                        {ns.error}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
