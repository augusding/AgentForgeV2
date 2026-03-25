/**
 * 可视化工作流节点 — ReactFlow 自定义节点组件。
 *
 * 三层结构:
 *  header  — 图标 + 节点名 + 执行状态 badge
 *  body    — 关键参数摘要 (subtitle)
 *  footer  — 执行结果: item 数量 + 耗时（执行后显示）
 *
 * 悬停工具栏: ▶ Run | ✏ Rename | ⧉ Copy | 🗑 Delete | 📌 Pin
 */
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Handle, Position, NodeToolbar } from '@xyflow/react'
import {
  Play, Webhook, Clock, Bot, Globe, GitBranch, Pencil,
  Filter, Merge, Code, Repeat, Bell, UserCheck, Timer,
  CheckCircle2, XCircle, Loader2, Circle, Pin, PinOff,
  Trash2, Copy, Type,
  Mail, MessageSquare, Database, Sparkles, FileSpreadsheet, FileText, Table,
} from 'lucide-react'
import { useNodeExecState, useNodePinState, useEditorActions } from './VisualEditor'

const ICON_MAP: Record<string, any> = {
  Play, Webhook, Clock, Bot, Globe, GitBranch, Pencil,
  Filter, Merge, Code, Repeat, Bell, UserCheck, Timer,
  Mail, MessageSquare, Database, Sparkles, FileSpreadsheet, FileText, Table,
}

// 执行状态 badge 配置
const STATUS_CONFIG = {
  pending:   { icon: Circle,        color: 'text-text-muted',    bg: '' },
  running:   { icon: Loader2,       color: 'text-blue-400',      bg: '', spin: true },
  completed: { icon: CheckCircle2,  color: 'text-success',       bg: '' },
  failed:    { icon: XCircle,       color: 'text-error',         bg: '' },
  skipped:   { icon: Circle,        color: 'text-text-muted',    bg: '' },
  waiting:   { icon: Timer,         color: 'text-amber-400',     bg: '' },
} as const

interface VisualNodeProps {
  id: string
  data: {
    label: string
    nodeType: string
    icon?: string
    color?: string
    subtitle?: string
    disabled?: boolean
    hasInputs?: boolean
    hasOutputs?: boolean
    outputCount?: number
    outputNames?: string[]
  }
  selected?: boolean
}

function VisualNode({ id, data, selected }: VisualNodeProps) {
  const Icon = ICON_MAP[data.icon || ''] || Bot
  const color = data.color || '#6366f1'

  const [hovered, setHovered] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(data.label)
  const renameRef = useRef<HTMLInputElement>(null)

  // 从 Context 读取执行状态、pin 状态、编辑器操作
  const execState = useNodeExecState(id)
  const { isPinned, onToggle: onPinToggle } = useNodePinState(id)
  const { onRunNode, onDeleteNode, onCopyNode, onRenameNode } = useEditorActions()

  const status = execState?.status ?? 'pending'
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  const StatusIcon = statusCfg.icon

  // 开始 rename 时聚焦 input
  useEffect(() => {
    if (renaming && renameRef.current) {
      renameRef.current.focus()
      renameRef.current.select()
    }
  }, [renaming])

  const handleRenameSubmit = useCallback(() => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== data.label) {
      onRenameNode(id, trimmed)
    }
    setRenaming(false)
  }, [renameValue, data.label, id, onRenameNode])

  // 边框颜色随执行状态变化
  const borderClass = selected
    ? 'border-accent shadow-md'
    : status === 'completed' ? 'border-success/60'
    : status === 'failed'    ? 'border-error/60'
    : status === 'running'   ? 'border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.4)] node-running-pulse'
    : status === 'waiting'   ? 'border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)] node-waiting-pulse'
    : 'border-border'

  const toolbarBtn = 'p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text transition-colors'

  return (
    <>
      {/* ── 悬停工具栏 ── */}
      <NodeToolbar isVisible={hovered || selected} position={Position.Top} offset={8}>
        <div className="flex items-center gap-0.5 bg-surface border border-border rounded-lg shadow-lg px-0.5 py-0.5">
          <button
            onClick={e => { e.stopPropagation(); onRunNode(id) }}
            className={toolbarBtn}
            title="Run workflow"
          >
            <Play size={12} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); setRenameValue(data.label); setRenaming(true) }}
            className={toolbarBtn}
            title="Rename"
          >
            <Type size={12} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onCopyNode(id) }}
            className={toolbarBtn}
            title="Duplicate"
          >
            <Copy size={12} />
          </button>
          {/* Pin / Unpin (仅在有执行数据时) */}
          {execState && (
            <button
              onClick={e => { e.stopPropagation(); onPinToggle() }}
              className={`${toolbarBtn} ${isPinned ? '!text-amber-500' : ''}`}
              title={isPinned ? 'Unpin data' : 'Pin data'}
            >
              {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
            </button>
          )}
          <div className="w-px h-4 bg-border mx-0.5" />
          <button
            onClick={e => { e.stopPropagation(); onDeleteNode(id) }}
            className="p-1.5 rounded hover:bg-error/10 text-text-muted hover:text-error transition-colors"
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </NodeToolbar>

      {/* ── 节点主体 ── */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`rounded-lg border-2 bg-surface shadow-sm min-w-[180px] transition-all ${borderClass} ${data.disabled ? 'opacity-50' : ''} ${isPinned ? 'ring-2 ring-amber-500/30' : ''}`}
      >
        {/* 输入 handle (left side) */}
        {data.hasInputs !== false && (
          <Handle
            type="target"
            position={Position.Left}
            className="!w-2.5 !h-2.5 !bg-text-muted !border-2 !border-surface !-left-[6px]"
          />
        )}

        {/* Header: 图标 + 节点名 + 状态 badge */}
        <div
          className="px-3 py-2 rounded-t-md flex items-center gap-2"
          style={{ backgroundColor: color + '20' }}
        >
          <Icon size={14} style={{ color }} className="shrink-0" />

          {renaming ? (
            <input
              ref={renameRef}
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={e => {
                if (e.key === 'Enter') handleRenameSubmit()
                if (e.key === 'Escape') setRenaming(false)
              }}
              onClick={e => e.stopPropagation()}
              className="nodrag text-xs font-semibold bg-transparent border-b border-accent outline-none text-text flex-1 w-0 min-w-0 py-0"
            />
          ) : (
            <span className="text-xs font-semibold text-text truncate flex-1">
              {data.label}
            </span>
          )}

          {/* 执行状态 badge */}
          {execState && (
            <StatusIcon
              size={13}
              className={`shrink-0 ${statusCfg.color} ${'spin' in statusCfg && statusCfg.spin ? 'animate-spin' : ''}`}
            />
          )}
        </div>

        {/* Body: 参数摘要 */}
        {data.subtitle && (
          <div className="px-3 py-1.5 border-t border-border">
            <span className="text-[10px] text-text-muted truncate block">
              {data.subtitle}
            </span>
          </div>
        )}

        {/* Footer: 执行结果统计（执行后显示） */}
        {execState && (execState.outputItems !== undefined || execState.error) && (
          <div className={`px-3 py-1 border-t flex items-center gap-2 ${
            execState.status === 'failed' ? 'border-error/20 bg-error/5' : 'border-border bg-bg/50'
          }`}>
            {execState.status === 'failed' && execState.error ? (
              <span className="text-[10px] text-error truncate">{execState.error}</span>
            ) : (
              <>
                <span className="text-[10px] text-text-muted">
                  {execState.outputItems ?? 0} items
                </span>
                {execState.duration !== undefined && (
                  <span className="text-[10px] text-text-muted ml-auto">
                    {execState.duration < 1
                      ? `${Math.round(execState.duration * 1000)}ms`
                      : `${execState.duration.toFixed(1)}s`}
                  </span>
                )}
              </>
            )}
          </div>
        )}

        {/* 输出 handles (right side) */}
        {data.hasOutputs !== false && (
          <>
            {(data.outputCount || 1) === 1 ? (
              <Handle
                type="source"
                position={Position.Right}
                className="!w-2.5 !h-2.5 !bg-text-muted !border-2 !border-surface !-right-[6px]"
              />
            ) : (
              Array.from({ length: data.outputCount || 1 }).map((_, i) => (
                <Handle
                  key={i}
                  type="source"
                  position={Position.Right}
                  id={`output-${i}`}
                  className="!w-2.5 !h-2.5 !border-2 !border-surface !-right-[6px]"
                  style={{
                    top: `${((i + 1) / ((data.outputCount || 1) + 1)) * 100}%`,
                    backgroundColor: i === 0 ? '#22c55e' : '#ef4444',
                  }}
                  title={data.outputNames?.[i] || `output ${i}`}
                />
              ))
            )}
          </>
        )}
      </div>
    </>
  )
}

export default memo(VisualNode)
