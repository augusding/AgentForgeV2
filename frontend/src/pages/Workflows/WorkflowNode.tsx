/**
 * Custom React Flow node for the workflow editor.
 * Shows node type icon, label, agent/skill info, and connection handles.
 */
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Zap, GitBranch, UserCheck, Layers, ClipboardEdit, Repeat } from 'lucide-react'
import type { WorkflowNodeData, WorkflowNodeType } from '../../types/workflow'
import { NODE_TYPE_COLORS, NODE_STATUS_COLORS } from '../../utils/workflowGraph'

const typeIcons: Record<WorkflowNodeType, React.ReactNode> = {
  task: <Zap size={14} />,
  condition: <GitBranch size={14} />,
  approval: <UserCheck size={14} />,
  human_input: <ClipboardEdit size={14} />,
  loop: <Repeat size={14} />,
  sub_workflow: <Layers size={14} />,
}

const typeLabels: Record<WorkflowNodeType, string> = {
  task: 'Task',
  condition: 'Condition',
  approval: 'Approval',
  human_input: 'Human Input',
  loop: 'Loop',
  sub_workflow: 'Sub-workflow',
}

function WorkflowNodeComponent({ data, selected }: NodeProps) {
  const d = data as unknown as WorkflowNodeData
  const nodeType = (d.type || 'task') as WorkflowNodeType
  const color = NODE_TYPE_COLORS[nodeType] || NODE_TYPE_COLORS.task
  const statusColor = d.metadata?.status
    ? NODE_STATUS_COLORS[d.metadata.status as string] || undefined
    : undefined

  const label = d.id
  const subtitle = d.skill || d.agent || d.workflow_ref || ''

  return (
    <div
      className="relative rounded-lg border-2 bg-surface shadow-sm min-w-[180px]"
      style={{
        borderColor: statusColor || (selected ? color : 'var(--color-border)'),
        boxShadow: selected ? `0 0 0 2px ${color}40` : undefined,
      }}
    >
      {/* Top handle */}
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-text-muted !border-surface" />

      {/* Header */}
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-t-md text-white text-[11px] font-medium"
        style={{ backgroundColor: statusColor || color }}
      >
        {typeIcons[nodeType]}
        <span>{typeLabels[nodeType]}</span>
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        <div className="text-xs font-semibold text-text truncate">{label}</div>
        {subtitle && (
          <div className="text-[10px] text-text-muted truncate mt-0.5">{subtitle}</div>
        )}
        {d.instruction && (
          <div className="text-[10px] text-text-secondary truncate mt-0.5" title={d.instruction}>
            {d.instruction.slice(0, 50)}{d.instruction.length > 50 ? '...' : ''}
          </div>
        )}
      </div>

      {/* Bottom handle */}
      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-text-muted !border-surface" />

      {/* Status indicator dot */}
      {statusColor && (
        <div
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-surface"
          style={{ backgroundColor: statusColor }}
        />
      )}
    </div>
  )
}

export default memo(WorkflowNodeComponent)
