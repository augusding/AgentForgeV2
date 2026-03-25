/**
 * Left-side node palette — drag nodes onto the canvas.
 */
import { Zap, GitBranch, UserCheck, Layers, ClipboardEdit, Repeat } from 'lucide-react'
import type { WorkflowNodeType } from '../../types/workflow'

const nodeTypes: { type: WorkflowNodeType; label: string; icon: React.ReactNode; desc: string }[] = [
  { type: 'task', label: 'Task', icon: <Zap size={16} />, desc: 'Execute an instruction' },
  { type: 'condition', label: 'Condition', icon: <GitBranch size={16} />, desc: 'Branch on expression' },
  { type: 'approval', label: 'Approval', icon: <UserCheck size={16} />, desc: 'Await human approval' },
  { type: 'human_input', label: 'Human Input', icon: <ClipboardEdit size={16} />, desc: 'Collect user data' },
  { type: 'loop', label: 'Loop', icon: <Repeat size={16} />, desc: 'Repeat until condition' },
  { type: 'sub_workflow', label: 'Sub-workflow', icon: <Layers size={16} />, desc: 'Call another workflow' },
]

interface NodePaletteProps {
  onAdd?: (type: WorkflowNodeType) => void
}

export default function NodePalette({ onAdd }: NodePaletteProps) {
  const onDragStart = (event: React.DragEvent, nodeType: WorkflowNodeType) => {
    event.dataTransfer.setData('application/reactflow-nodetype', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="w-48 bg-surface border-r border-border p-3 flex flex-col gap-2 shrink-0">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Nodes</h3>
      {nodeTypes.map(({ type, label, icon, desc }) => (
        <div
          key={type}
          className="flex items-center gap-2 p-2 rounded-lg border border-border bg-bg
                     cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-colors"
          draggable
          onDragStart={(e) => onDragStart(e, type)}
          onClick={() => onAdd?.(type)}
        >
          <div className="text-text-secondary">{icon}</div>
          <div>
            <div className="text-xs font-medium text-text">{label}</div>
            <div className="text-[10px] text-text-muted">{desc}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
