/**
 * 交互式连线 — 悬停显示「+ 插入节点」和「× 删除连线」按钮。
 *
 * 执行时：连线根据目标节点状态显示流动动画。
 */
import { memo, useCallback, useContext, useRef, useState } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react'
import { Plus, X } from 'lucide-react'
import { useEditorActions, ExecutionContext } from './VisualEditor'

function InteractiveEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false)
  const timeoutRef = useRef<number>(0)
  const { onDeleteEdge, onInsertOnEdge } = useEditorActions()
  const { nodeStates, isExecuting } = useContext(ExecutionContext)

  const enter = useCallback(() => {
    clearTimeout(timeoutRef.current)
    setHovered(true)
  }, [])

  const leave = useCallback(() => {
    timeoutRef.current = window.setTimeout(() => setHovered(false), 150)
  }, [])

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  // Determine edge animation based on target node execution state
  const targetState = nodeStates[target]?.status
  const sourceState = nodeStates[source]?.status
  const isRunning = targetState === 'running'
  const isCompleted = sourceState === 'completed' && (targetState === 'completed' || targetState === 'running')
  const isFailed = targetState === 'failed'

  let edgeStyle = { ...style }
  let pathClass = ''

  if (isExecuting || Object.keys(nodeStates).length > 0) {
    if (isRunning) {
      edgeStyle = { ...edgeStyle, stroke: '#3b82f6', strokeWidth: 2.5 }
      pathClass = 'edge-flow-animation'
    } else if (isCompleted) {
      edgeStyle = { ...edgeStyle, stroke: '#22c55e', strokeWidth: 2 }
    } else if (isFailed) {
      edgeStyle = { ...edgeStyle, stroke: '#ef4444', strokeWidth: 2 }
    }
  }

  if (hovered) {
    edgeStyle = { ...edgeStyle, stroke: 'var(--color-accent, #6366f1)', strokeWidth: 2.5 }
  }

  return (
    <>
      {/* 宽透明路径用于 hover 检测 */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        onMouseEnter={enter}
        onMouseLeave={leave}
        style={{ cursor: 'pointer' }}
      />
      <BaseEdge
        path={edgePath}
        style={edgeStyle}
        markerEnd={markerEnd}
      />

      {/* Flow animation overlay — animated dashed line on running edges */}
      {isRunning && (
        <path
          d={edgePath}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2.5}
          strokeDasharray="8 4"
          className="edge-flow-dash"
        />
      )}

      {hovered && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="flex items-center gap-1.5 nodrag nopan"
            onMouseEnter={enter}
            onMouseLeave={leave}
          >
            {/* 插入节点 */}
            <button
              onClick={e => {
                e.stopPropagation()
                onInsertOnEdge(id, { x: e.clientX, y: e.clientY })
              }}
              className="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center hover:scale-110 shadow-lg transition-transform"
              title="Insert node"
            >
              <Plus size={14} />
            </button>

            {/* 删除连线 */}
            <button
              onClick={e => {
                e.stopPropagation()
                onDeleteEdge(id)
              }}
              className="w-5 h-5 rounded-full bg-surface border border-border text-text-muted flex items-center justify-center hover:bg-error hover:text-white hover:border-error shadow transition-colors"
              title="Delete connection"
            >
              <X size={11} />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export default memo(InteractiveEdge)
