/**
 * Read-only DAG visualization for workflow execution progress.
 * Replaces MissionProgress when mission.mode === 'workflow'.
 */
import { useMemo } from 'react'
import {
  ReactFlow,
  Background,
  ReactFlowProvider,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { NODE_STATUS_COLORS, NODE_TYPE_COLORS } from '../../utils/workflowGraph'
import type { WorkflowV2Data, WorkflowNodeData, WorkflowNodeType } from '../../types/workflow'
import { workflowToGraph } from '../../utils/workflowGraph'

interface Props {
  workflow: WorkflowV2Data
  dagState: Record<string, string>
  missionTitle: string
}

/** Minimal node rendering for read-only progress view */
function ProgressNode({ data }: { data: Record<string, unknown> }) {
  const d = data as unknown as WorkflowNodeData & { _status?: string }
  const nodeType = (d.type || 'task') as WorkflowNodeType
  const status = d._status || 'pending'
  const statusColor = NODE_STATUS_COLORS[status] || NODE_STATUS_COLORS.pending
  const typeColor = NODE_TYPE_COLORS[nodeType]
  const isRunning = status === 'running'

  return (
    <div
      className="rounded-md border-2 min-w-[140px] text-center"
      style={{
        borderColor: statusColor,
        backgroundColor: `${statusColor}15`,
        animation: isRunning ? 'pulse 1.5s infinite' : undefined,
      }}
    >
      <div
        className="text-[9px] font-medium text-white px-2 py-0.5 rounded-t-sm"
        style={{ backgroundColor: statusColor }}
      >
        {status.toUpperCase()}
      </div>
      <div className="px-2 py-1.5">
        <div className="text-[11px] font-medium text-text truncate">{d.id}</div>
        {(d.skill || d.agent) && (
          <div className="text-[9px] text-text-muted truncate">{d.skill || d.agent}</div>
        )}
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  )
}

const nodeTypes = { progressNode: ProgressNode }

function WorkflowProgressInner({ workflow, dagState, missionTitle }: Props) {
  const { nodes, edges } = useMemo(() => {
    const { nodes: rawNodes, edges: rawEdges } = workflowToGraph(workflow)

    // Apply status from dagState + use progressNode type
    const coloredNodes: Node[] = rawNodes.map((n) => ({
      ...n,
      type: 'progressNode',
      data: {
        ...n.data,
        _status: dagState[n.id] || 'pending',
      },
      draggable: false,
      selectable: false,
    }))

    return { nodes: coloredNodes, edges: rawEdges }
  }, [workflow, dagState])

  // Count stats
  const total = nodes.length
  const completed = Object.values(dagState).filter(
    (s) => s === 'completed' || s === 'skipped',
  ).length
  const failed = Object.values(dagState).filter((s) => s === 'failed').length
  const running = Object.values(dagState).filter((s) => s === 'running').length

  return (
    <div className="bg-surface border-b border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="text-xs font-semibold text-text truncate">{missionTitle}</span>
        <div className="flex items-center gap-3 text-[10px] text-text-muted shrink-0">
          {running > 0 && <span className="text-blue-400">Running: {running}</span>}
          <span className="text-success">Done: {completed}/{total}</span>
          {failed > 0 && <span className="text-danger">Failed: {failed}</span>}
        </div>
      </div>

      {/* DAG visualization */}
      <div style={{ height: 180 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          preventScrolling={false}
          proOptions={{ hideAttribution: true }}
          className="bg-bg"
        >
          <Background gap={20} size={0.5} />
        </ReactFlow>
      </div>
    </div>
  )
}

export default function WorkflowProgress(props: Props) {
  return (
    <ReactFlowProvider>
      <WorkflowProgressInner {...props} />
    </ReactFlowProvider>
  )
}
