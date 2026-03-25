/**
 * Visual Workflow Editor — React Flow canvas with drag-and-drop node creation.
 */
import { useCallback, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useReactFlow,
  type Connection,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Save, LayoutGrid, AlertTriangle, CheckCircle, ArrowLeft,
} from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../../components/PageHeader'
import NodePalette from './NodePalette'
import NodeEditor from './NodeEditor'
import WorkflowNodeComponent from './WorkflowNode'
import { useWorkflowEditorStore } from '../../stores/useWorkflowEditorStore'
import { useAgentStore } from '../../stores/useAgentStore'
import { fetchWorkflowDetail, saveWorkflow } from '../../api/workflows'
import { workflowToGraph, graphToWorkflow, autoLayout } from '../../utils/workflowGraph'
import type { WorkflowNodeType } from '../../types/workflow'

const nodeTypes = { workflowNode: WorkflowNodeComponent }

function WorkflowEditorInner() {
  const { workflowId } = useParams<{ workflowId: string }>()
  const navigate = useNavigate()
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, getViewport } = useReactFlow()

  const {
    nodes, edges, selectedNodeId, dirty, validation, meta,
    setNodes, setEdges, onNodesChange, onEdgesChange,
    selectNode, addNode, setMeta, validate, markClean, reset,
  } = useWorkflowEditorStore()

  const agents = useAgentStore((s) => s.agents)
  const loadAgents = useAgentStore((s) => s.load)

  // Load agents on mount
  useEffect(() => {
    loadAgents()
  }, [loadAgents])

  // Load workflow if editing
  useEffect(() => {
    let cancelled = false
    reset()
    if (workflowId) {
      fetchWorkflowDetail(workflowId)
        .then((wf) => {
          if (cancelled) return
          const { nodes: n, edges: e } = workflowToGraph(wf)
          setNodes(n)
          setEdges(e)
          setMeta({
            name: wf.name,
            description: wf.description,
            version: wf.version,
            trigger: wf.trigger,
            parameters: wf.parameters,
            metadata: wf.metadata,
          })
          markClean()
        })
        .catch(() => {
          if (!cancelled) toast.error('Failed to load workflow')
        })
    }
    return () => { cancelled = true }
  }, [workflowId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Connect edges
  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge = {
        ...connection,
        id: `${connection.source}->${connection.target}`,
      }
      setEdges(addEdge(newEdge, edges))
    },
    [edges, setEdges],
  )

  // Node selection
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      selectNode(node.id)
    },
    [selectNode],
  )

  const onPaneClick = useCallback(() => {
    selectNode(null)
  }, [selectNode])

  // Drop from palette
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const nodeType = event.dataTransfer.getData('application/reactflow-nodetype') as WorkflowNodeType
      if (!nodeType) return

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      addNode(nodeType, position)
    },
    [addNode, screenToFlowPosition],
  )

  // Click-to-add from palette
  const onPaletteClick = useCallback(
    (nodeType: WorkflowNodeType) => {
      const bounds = reactFlowWrapper.current?.getBoundingClientRect()
      if (!bounds) return
      // Place at center of the visible canvas
      const position = screenToFlowPosition({
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
      })
      addNode(nodeType, position)
    },
    [addNode, screenToFlowPosition],
  )

  // Save
  const handleSave = useCallback(async () => {
    const result = validate()
    if (!result.valid) {
      toast.error(`Validation failed: ${result.errors[0]?.message}`)
      return
    }
    if (!meta.name) {
      toast.error('Workflow name is required')
      return
    }

    try {
      const wfData = graphToWorkflow(nodes, edges, meta)
      await saveWorkflow(wfData)
      markClean()
      toast.success('Workflow saved')
    } catch {
      toast.error('Failed to save workflow')
    }
  }, [nodes, edges, meta, validate, markClean])

  // Auto-layout
  const handleAutoLayout = useCallback(() => {
    const laid = autoLayout(nodes, edges)
    setNodes(laid)
    toast.success('Layout applied')
  }, [nodes, edges, setNodes])

  const agentList = useMemo(
    () => agents.map((a) => ({ id: a.id, name: a.name })),
    [agents],
  )

  return (
    <div className="flex flex-col -m-3 md:-m-6 h-[calc(100vh-theme(height.14)-theme(height.9))]">
      <PageHeader
        title={workflowId ? `Edit: ${meta.name || workflowId}` : 'New Workflow'}
        subtitle="Visual DAG Editor"
      />

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-surface">
        <button
          onClick={() => navigate('/workflows')}
          className="flex items-center gap-1 text-xs text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </button>

        <div className="flex-1" />

        {/* Workflow name input */}
        <input
          className="input-sm w-48"
          placeholder="Workflow name"
          value={meta.name}
          onChange={(e) => setMeta({ name: e.target.value })}
        />

        <button
          onClick={handleAutoLayout}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border border-border
                     hover:bg-surface-hover transition-colors text-text-secondary"
        >
          <LayoutGrid size={13} /> Layout
        </button>

        <button
          onClick={() => validate()}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border border-border
                     hover:bg-surface-hover transition-colors text-text-secondary"
        >
          {validation.valid
            ? <><CheckCircle size={13} className="text-success" /> Valid</>
            : <><AlertTriangle size={13} className="text-warning" /> {validation.errors.length} issues</>
          }
        </button>

        <button
          onClick={handleSave}
          disabled={!dirty && !!workflowId}
          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-accent text-white
                     hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          <Save size={13} /> Save
        </button>
      </div>

      {/* Validation errors banner */}
      {!validation.valid && (
        <div className="px-4 py-2 bg-warning/10 border-b border-warning/30 text-xs text-warning">
          {validation.errors.map((e, i) => (
            <div key={i}>{e.nodeId ? `[${e.nodeId}] ` : ''}{e.message}</div>
          ))}
        </div>
      )}

      {/* Editor area */}
      <div className="flex flex-1 min-h-0">
        <NodePalette onAdd={onPaletteClick} />

        <div ref={reactFlowWrapper} className="flex-1 min-w-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode="Delete"
            className="bg-bg"
          >
            <Background gap={16} size={1} />
            <Controls />
            <MiniMap
              nodeStrokeWidth={3}
              className="!bg-surface !border-border"
            />
          </ReactFlow>
        </div>

        {selectedNodeId && <NodeEditor agents={agentList} />}
      </div>
    </div>
  )
}

export default function WorkflowEditor() {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner />
    </ReactFlowProvider>
  )
}
