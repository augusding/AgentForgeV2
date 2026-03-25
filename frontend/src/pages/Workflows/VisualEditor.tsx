/**
 * 可视化工作流编辑器 — ReactFlow 画布 + 动态节点面板 + 参数/调试面板。
 *
 * 基于 workflow-engine 后端 API，参照 n8n 交互模式。
 * 执行状态通过 ExecutionContext 向下传递给 VisualNode。
 * 编辑器操作通过 EditorActionsContext 向下传递给 VisualNode / InteractiveEdge。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowLeft, Save, Play, LayoutGrid, Loader2, Search, Clock } from 'lucide-react'
import dagre from 'dagre'

import DynamicNodePalette from './DynamicNodePalette'
import NodeDetailModal from './NodeDetailModal'
import VisualNode from './VisualNode'
import InteractiveEdge from './InteractiveEdge'
import ExecutionLogPanel from './ExecutionLogPanel'
import TriggerPanel from './TriggerPanel'
import { buildNodeContexts } from './ExpressionEditor'
import {
  getNodeCatalog, getWorkflow, createWorkflow, updateWorkflow, executeWorkflow,
  getPinnedNodes, pinNodeData, unpinNodeData, testNode,
  type NodeTypeDef, type WFWorkflow, type WFNode, type WFConnection,
  type WFExecution, type WFNodeExecState,
} from '../../api/workflow'

// ── Execution Context ─────────────────────────────────

export interface ExecutionContextValue {
  nodeStates: Record<string, WFNodeExecState>
  isExecuting: boolean
  pinnedNodes: Record<string, number>
  workflowId: string | null
  onPinToggle: (nodeId: string) => void
}

export const ExecutionContext = createContext<ExecutionContextValue>({
  nodeStates: {},
  isExecuting: false,
  pinnedNodes: {},
  workflowId: null,
  onPinToggle: () => {},
})

export function useNodeExecState(nodeId: string): WFNodeExecState | undefined {
  const { nodeStates } = useContext(ExecutionContext)
  return nodeStates[nodeId]
}

export function useNodePinState(nodeId: string): { isPinned: boolean; onToggle: () => void } {
  const { pinnedNodes, onPinToggle } = useContext(ExecutionContext)
  return {
    isPinned: nodeId in pinnedNodes,
    onToggle: () => onPinToggle(nodeId),
  }
}

// ── Editor Actions Context ────────────────────────────
// 向 VisualNode / InteractiveEdge 传递编辑器操作回调

export interface EditorActionsValue {
  onRunNode: (nodeId: string) => void
  onDeleteNode: (nodeId: string) => void
  onCopyNode: (nodeId: string) => void
  onRenameNode: (nodeId: string, name: string) => void
  onOpenDetail: (nodeId: string) => void
  onDeleteEdge: (edgeId: string) => void
  onInsertOnEdge: (edgeId: string, screenPos: { x: number; y: number }) => void
}

const noop = () => {}
export const EditorActionsContext = createContext<EditorActionsValue>({
  onRunNode: noop,
  onDeleteNode: noop,
  onCopyNode: noop,
  onRenameNode: noop,
  onOpenDetail: noop,
  onDeleteEdge: noop,
  onInsertOnEdge: noop,
})

export function useEditorActions() {
  return useContext(EditorActionsContext)
}

// ── Constants ─────────────────────────────────────────

const NODE_TYPES = { visualNode: VisualNode }
const EDGE_TYPES = { interactiveEdge: InteractiveEdge }
const NODE_W = 200
const NODE_H = 80

let idCounter = 0
function nextId(prefix: string) {
  return `${prefix}_${++idCounter}_${Date.now().toString(36)}`
}

// ── 节点类型分组（用于连线上的快速选择器）──────────────

const PICKER_GROUP_ORDER = ['trigger', 'transform', 'flow', 'communication', 'database', 'ai', 'document']
const PICKER_GROUP_LABELS: Record<string, string> = {
  trigger: '触发器', transform: '数据处理', flow: '流程控制',
  communication: '通讯', database: '数据库', ai: 'AI / LLM', document: '文档',
}

// ── Helper: 构建新的 ReactFlow Node ──────────────────

function buildRfNode(id: string, typeName: string, nt: NodeTypeDef, position: { x: number; y: number }): Node {
  const defaultParams: Record<string, any> = {}
  for (const prop of nt.properties) {
    if (prop.type !== 'notice') defaultParams[prop.name] = prop.default
  }
  return {
    id,
    type: 'visualNode',
    position,
    data: {
      label: nt.displayName,
      nodeType: typeName,
      icon: nt.icon,
      color: nt.color,
      subtitle: '',
      hasInputs: nt.inputs.length > 0,
      hasOutputs: nt.outputs.length > 0,
      outputCount: nt.outputs.length,
      outputNames: nt.outputNames,
      _parameters: defaultParams,
      _typeName: typeName,
    },
  }
}

// ── Component ─────────────────────────────────────────

export default function VisualEditor() {
  const { id: workflowId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // Node catalog from backend
  const [catalog, setCatalog] = useState<NodeTypeDef[]>([])
  const catalogMap = useMemo(() => {
    const m: Record<string, NodeTypeDef> = {}
    for (const nt of catalog) m[nt.name] = nt
    return m
  }, [catalog])

  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Workflow meta
  const [wfName, setWfName] = useState('New Workflow')
  const [wfDesc, setWfDesc] = useState('')
  const [wfActive, setWfActive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState('')

  // Execution state
  const [lastExecution, setLastExecution] = useState<WFExecution | null>(null)
  const [logPanelOpen, setLogPanelOpen] = useState(false)
  const [triggerPanelOpen, setTriggerPanelOpen] = useState(false)

  // Pin Data state
  const [pinnedNodes, setPinnedNodes] = useState<Record<string, number>>({})

  // Edge insert picker state
  const [insertEdgeInfo, setInsertEdgeInfo] = useState<{
    edgeId: string
    screenPos: { x: number; y: number }
  } | null>(null)

  // 加载 Pin 状态
  useEffect(() => {
    if (workflowId && workflowId !== 'new') {
      getPinnedNodes(workflowId).then(setPinnedNodes).catch(console.error)
    }
  }, [workflowId])

  // Pin/Unpin 切换
  const handlePinToggle = useCallback(async (nodeId: string) => {
    if (!workflowId || workflowId === 'new') return
    if (nodeId in pinnedNodes) {
      await unpinNodeData(workflowId, nodeId)
      setPinnedNodes(prev => { const n = { ...prev }; delete n[nodeId]; return n })
    } else {
      const outputData = lastExecution?.nodes[nodeId]?.outputData ?? []
      await pinNodeData(workflowId, nodeId, outputData)
      setPinnedNodes(prev => ({ ...prev, [nodeId]: outputData.length }))
    }
  }, [workflowId, pinnedNodes, lastExecution])

  // Load catalog
  useEffect(() => {
    getNodeCatalog().then(setCatalog).catch(console.error)
  }, [])

  // Load existing workflow (only after catalog is ready)
  const needsAutoLayout = useRef(false)
  useEffect(() => {
    if (!workflowId || workflowId === 'new') return
    if (catalog.length === 0) return  // wait for catalog to load first
    getWorkflow(workflowId).then(wf => {
      setWfName(wf.name)
      setWfDesc(wf.description)
      setWfActive(wf.active ?? false)
      const { rfNodes, rfEdges } = wfToReactFlow(wf, catalogMap)
      setNodes(rfNodes)
      setEdges(rfEdges)

      // Detect stacked nodes (all at same position) → auto-layout needed
      if (rfNodes.length > 1) {
        const positions = rfNodes.map(n => `${n.position.x},${n.position.y}`)
        const unique = new Set(positions)
        if (unique.size === 1) {
          needsAutoLayout.current = true
        }
      }
    }).catch(console.error)
  }, [workflowId, catalog])

  // ── Handlers ────────────────────────────────────────

  const onConnect = useCallback((conn: Connection) => {
    setEdges(eds => addEdge({
      ...conn,
      id: `e_${conn.source}_${conn.target}`,
      animated: false,
    }, eds))
    setDirty(true)
  }, [])

  // 双击弹出详情面板
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null)

  const onNodeClick = useCallback((_: any, _node: Node) => {
    // single click = select on canvas (handled natively by ReactFlow)
  }, [])

  const onNodeDoubleClick = useCallback((_: any, node: Node) => {
    setDetailNodeId(node.id)
  }, [])

  const onPaneClick = useCallback(() => {
    setDetailNodeId(null)
    setInsertEdgeInfo(null)
  }, [])

  // Add node from palette
  const addNode = useCallback((typeName: string, position?: { x: number; y: number }) => {
    const nt = catalogMap[typeName]
    if (!nt) return

    const pos = position || { x: 300 + Math.random() * 200, y: 200 + Math.random() * 200 }
    const id = nextId(typeName)
    const newNode = buildRfNode(id, typeName, nt, pos)

    setNodes(nds => [...nds, newNode])
    setDetailNodeId(id)
    setDirty(true)
  }, [catalogMap])

  // Drag from palette onto canvas
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const typeName = e.dataTransfer.getData('application/workflow-node-type')
    if (!typeName || !rfInstance || !wrapperRef.current) return

    const bounds = wrapperRef.current.getBoundingClientRect()
    const position = rfInstance.screenToFlowPosition({
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top,
    })
    addNode(typeName, position)
  }, [rfInstance, addNode])

  // Update node parameters
  const handleParamUpdate = useCallback((nodeId: string, params: Record<string, any>) => {
    setNodes(nds => nds.map(n => {
      if (n.id !== nodeId) return n
      let subtitle = ''
      if (params.operation) subtitle = params.operation
      else if (params.method && params.url) subtitle = `${params.method} ${params.url}`
      else if (params.prompt) subtitle = params.prompt.slice(0, 40)
      return { ...n, data: { ...n.data, _parameters: params, subtitle } }
    }))
    setDirty(true)
  }, [])

  const handleNodeNameChange = useCallback((nodeId: string, name: string) => {
    setNodes(nds => nds.map(n =>
      n.id === nodeId ? { ...n, data: { ...n.data, label: name } } : n
    ))
    setDirty(true)
  }, [])

  // ── Run Single Node: 单节点测试执行 ─────────────

  const handleRunSingleNode = useCallback(async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    const typeName = node.data._typeName as string
    const parameters = (node.data._parameters as Record<string, any>) || {}

    // 收集上游节点的输出数据作为输入
    const upstreamEdges = edges.filter(e => e.target === nodeId)
    let inputData: Record<string, any>[] | undefined
    if (upstreamEdges.length > 0 && lastExecution?.nodes) {
      const items: Record<string, any>[] = []
      for (const e of upstreamEdges) {
        const upstreamState = lastExecution.nodes[e.source]
        if (upstreamState?.outputData) {
          items.push(...upstreamState.outputData)
        }
      }
      if (items.length > 0) inputData = items
    }

    // 先标记为 running
    setLastExecution(prev => ({
      executionId: prev?.executionId || 'single',
      status: prev?.status || 'running',
      nodes: {
        ...(prev?.nodes || {}),
        [nodeId]: { status: 'running' } as WFNodeExecState,
      },
    }) as WFExecution)

    try {
      const result = await testNode(typeName, parameters, inputData)
      setLastExecution(prev => ({
        executionId: prev?.executionId || 'single',
        status: prev?.status || 'completed',
        nodes: {
          ...(prev?.nodes || {}),
          [nodeId]: {
            status: result.status,
            outputData: result.outputData,
            outputItems: result.outputItems,
            duration: result.duration,
            error: result.error,
          } as WFNodeExecState,
        },
      }) as WFExecution)
    } catch (e: any) {
      setLastExecution(prev => ({
        executionId: prev?.executionId || 'single',
        status: prev?.status || 'failed',
        nodes: {
          ...(prev?.nodes || {}),
          [nodeId]: { status: 'failed', error: e.message } as WFNodeExecState,
        },
      }) as WFExecution)
    }
  }, [nodes, edges, lastExecution])

  // ── Smart Delete: 删除节点并自动连接前后节点 ──────

  const handleSmartDeleteNode = useCallback((nodeId: string) => {
    setEdges(eds => {
      const incoming = eds.filter(e => e.target === nodeId)
      const outgoing = eds.filter(e => e.source === nodeId)

      // 创建桥接连线：每个上游 → 每个下游
      const bridges: Edge[] = []
      for (const inEdge of incoming) {
        for (const outEdge of outgoing) {
          bridges.push({
            id: `e_${inEdge.source}_${outEdge.target}`,
            source: inEdge.source,
            target: outEdge.target,
            sourceHandle: inEdge.sourceHandle,
            targetHandle: outEdge.targetHandle,
          })
        }
      }

      return [
        ...eds.filter(e => e.source !== nodeId && e.target !== nodeId),
        ...bridges,
      ]
    })

    setNodes(nds => nds.filter(n => n.id !== nodeId))
    if (detailNodeId === nodeId) setDetailNodeId(null)
    setDirty(true)
  }, [detailNodeId])

  // ── Copy Node ───────────────────────────────────────

  const handleCopyNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    const newId = nextId(node.data._typeName as string)
    const newNode: Node = {
      ...node,
      id: newId,
      position: { x: node.position.x + 40, y: node.position.y + 60 },
      selected: false,
      data: { ...node.data, label: `${node.data.label} (copy)` },
    }

    setNodes(nds => [...nds, newNode])
    setDirty(true)
  }, [nodes])

  // ── Delete Edge ─────────────────────────────────────

  const handleDeleteEdge = useCallback((edgeId: string) => {
    setEdges(eds => eds.filter(e => e.id !== edgeId))
    setDirty(true)
  }, [])

  // ── Insert Node on Edge ─────────────────────────────

  const handleInsertOnEdge = useCallback((edgeId: string, screenPos: { x: number; y: number }) => {
    setInsertEdgeInfo({ edgeId, screenPos })
  }, [])

  const handleEdgeInsertSelect = useCallback((typeName: string) => {
    if (!insertEdgeInfo) return
    const edge = edges.find(e => e.id === insertEdgeInfo.edgeId)
    if (!edge) { setInsertEdgeInfo(null); return }

    const sourceNode = nodes.find(n => n.id === edge.source)
    const targetNode = nodes.find(n => n.id === edge.target)
    if (!sourceNode || !targetNode) { setInsertEdgeInfo(null); return }

    const nt = catalogMap[typeName]
    if (!nt) { setInsertEdgeInfo(null); return }

    // 在中点插入新节点
    const midX = (sourceNode.position.x + targetNode.position.x) / 2
    const midY = (sourceNode.position.y + targetNode.position.y) / 2
    const newId = nextId(typeName)
    const newNode = buildRfNode(newId, typeName, nt, { x: midX, y: midY })

    setNodes(nds => [...nds, newNode])
    setEdges(eds => [
      ...eds.filter(e => e.id !== edge.id),
      {
        id: `e_${edge.source}_${newId}`,
        source: edge.source,
        target: newId,
        sourceHandle: edge.sourceHandle,
      },
      {
        id: `e_${newId}_${edge.target}`,
        source: newId,
        target: edge.target,
        targetHandle: edge.targetHandle,
      },
    ])

    setInsertEdgeInfo(null)
    setDirty(true)
  }, [insertEdgeInfo, edges, nodes, catalogMap])

  // ── Run / Execute ───────────────────────────────────

  // Animated execution playback state
  const [playbackExecution, setPlaybackExecution] = useState<WFExecution | null>(null)

  const handleExecute = useCallback(async () => {
    const id = workflowId && workflowId !== 'new' ? workflowId : null
    if (!id) {
      setMessage('Save the workflow first')
      return
    }
    setExecuting(true)
    setMessage('')
    setLastExecution(null)
    setPlaybackExecution(null)

    try {
      const result = await executeWorkflow(id)

      // Animated playback: replay node states one by one
      const nodeEntries = Object.entries(result.nodes)
      // Sort by status: running → completed → failed → skipped (approximate execution order)
      const statusOrder: Record<string, number> = { completed: 0, failed: 1, waiting: 2, skipped: 3 }
      nodeEntries.sort((a, b) => (statusOrder[a[1].status] ?? 9) - (statusOrder[b[1].status] ?? 9))

      // Build incremental states for playback
      const playbackStates: Record<string, WFNodeExecState>[] = []
      const accumulated: Record<string, WFNodeExecState> = {}

      for (const [nodeId, state] of nodeEntries) {
        if (state.status === 'skipped') {
          accumulated[nodeId] = state
          continue
        }
        // Show "running" state first
        accumulated[nodeId] = { ...state, status: 'running' }
        playbackStates.push({ ...accumulated })
        // Then show final state
        accumulated[nodeId] = state
        playbackStates.push({ ...accumulated })
      }
      // Final state includes all skipped nodes
      playbackStates.push({ ...accumulated })

      // Play back with delays
      const STEP_DELAY = 300
      for (let i = 0; i < playbackStates.length; i++) {
        await new Promise(resolve => setTimeout(resolve, STEP_DELAY))
        setPlaybackExecution({
          ...result,
          nodes: playbackStates[i],
        })
      }

      // Set final result
      setLastExecution(result)
      setPlaybackExecution(null)
      setLogPanelOpen(true)
      const ok = result.status === 'completed'
      setMessage(`${ok ? 'Completed' : result.status} (${result.executionId.slice(0, 8)})`)
      setTimeout(() => setMessage(''), 4000)
    } catch (e: any) {
      setMessage(`Execute failed: ${e.message}`)
    }
    setExecuting(false)
  }, [workflowId])

  // Keep refs for auto-layout (avoids stale closure issues)
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => { edgesRef.current = edges }, [edges])

  // Auto-layout with fitView
  const handleAutoLayout = useCallback(() => {
    const curNodes = nodesRef.current
    const curEdges = edgesRef.current
    if (curNodes.length === 0) return

    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))
    g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 200, marginx: 40, marginy: 40 })

    for (const n of curNodes) {
      const el = document.querySelector(`[data-id="${n.id}"]`) as HTMLElement | null
      const w = el?.offsetWidth || NODE_W
      const h = el?.offsetHeight || NODE_H
      g.setNode(n.id, { width: w, height: h })
    }
    for (const e of curEdges) g.setEdge(e.source, e.target)
    dagre.layout(g)

    setNodes(curNodes.map(n => {
      const gn = g.node(n.id)
      if (!gn) return n
      return { ...n, position: { x: gn.x - gn.width / 2, y: gn.y - gn.height / 2 } }
    }))

    // fitView after React renders the new positions
    setTimeout(() => {
      rfInstance?.fitView({ padding: 0.15, duration: 300 })
    }, 50)
  }, [rfInstance])

  // Auto-layout stacked nodes after they render in the DOM
  useEffect(() => {
    if (needsAutoLayout.current && nodes.length > 1 && rfInstance) {
      needsAutoLayout.current = false
      setTimeout(() => handleAutoLayout(), 100)
    }
  }, [nodes, rfInstance, handleAutoLayout])

  // Save
  const handleSave = useCallback(async () => {
    setSaving(true)
    setMessage('')
    try {
      const wf = reactFlowToWf(nodes, edges, wfName, wfDesc, workflowId, wfActive)
      if (workflowId && workflowId !== 'new') {
        await updateWorkflow(workflowId, wf)
      } else {
        const saved = await createWorkflow(wf)
        navigate(`/workflows/visual/${saved.id}`, { replace: true })
      }
      setDirty(false)
      setMessage('Saved')
      setTimeout(() => setMessage(''), 2000)
    } catch (e: any) {
      setMessage(`Save failed: ${e.message}`)
    }
    setSaving(false)
  }, [nodes, edges, wfName, wfDesc, workflowId, wfActive])

  // Detail modal
  const detailNode = nodes.find(n => n.id === detailNodeId)
  const detailTypeDef = detailNode ? catalogMap[detailNode.data._typeName as string] : null

  const nodeContexts = useMemo(
    () => detailNodeId
      ? buildNodeContexts(lastExecution?.nodes ?? {}, nodes as Array<{ id: string; data: any }>, detailNodeId)
      : [],
    [detailNodeId, lastExecution, nodes],
  )

  // ── Context values ──────────────────────────────────

  // During playback animation, show animated states; otherwise show final result
  const activeExecution = playbackExecution ?? lastExecution
  const execCtxValue: ExecutionContextValue = useMemo(() => ({
    nodeStates: activeExecution?.nodes ?? {},
    isExecuting: executing,
    pinnedNodes,
    workflowId: workflowId ?? null,
    onPinToggle: handlePinToggle,
  }), [activeExecution, executing, pinnedNodes, workflowId, handlePinToggle])

  const editorActionsValue: EditorActionsValue = useMemo(() => ({
    onRunNode: handleRunSingleNode,
    onDeleteNode: handleSmartDeleteNode,
    onCopyNode: handleCopyNode,
    onRenameNode: handleNodeNameChange,
    onOpenDetail: (id: string) => setDetailNodeId(id),
    onDeleteEdge: handleDeleteEdge,
    onInsertOnEdge: handleInsertOnEdge,
  }), [handleRunSingleNode, handleSmartDeleteNode, handleCopyNode, handleNodeNameChange, handleDeleteEdge, handleInsertOnEdge])

  return (
    <ExecutionContext.Provider value={execCtxValue}>
    <EditorActionsContext.Provider value={editorActionsValue}>
      <div className="h-[calc(100vh-64px)] flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-surface shrink-0">
          <button
            onClick={() => navigate('/workflows')}
            className="p-1.5 text-text-muted hover:text-text rounded transition-colors"
          >
            <ArrowLeft size={16} />
          </button>

          <input
            type="text"
            value={wfName}
            onChange={e => { setWfName(e.target.value); setDirty(true) }}
            className="text-sm font-semibold bg-transparent border-none outline-none text-text w-48"
            placeholder="Workflow name..."
          />

          <div className="flex-1" />

          {message && (
            <span className={`text-xs ${message.includes('fail') || message.includes('error') ? 'text-error' : 'text-success'}`}>
              {message}
            </span>
          )}

          <button
            onClick={handleAutoLayout}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-secondary border border-border rounded-lg hover:bg-surface-hover transition-colors"
            title="Auto Layout"
          >
            <LayoutGrid size={13} /> Layout
          </button>

          {/* Active toggle */}
          <button
            onClick={() => { setWfActive(!wfActive); setDirty(true) }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
              wfActive
                ? 'bg-success/10 text-success border-success/30 hover:bg-success/20'
                : 'bg-surface text-text-muted border-border hover:bg-surface-hover'
            }`}
            title={wfActive ? '点击停用工作流' : '点击激活工作流（激活后可通过对话触发）'}
          >
            <div className={`w-6 h-3.5 rounded-full relative transition-colors ${wfActive ? 'bg-success' : 'bg-border'}`}>
              <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow transition-transform ${wfActive ? 'left-3' : 'left-0.5'}`} />
            </div>
            {wfActive ? '已激活' : '未激活'}
          </button>

          <button
            onClick={() => setTriggerPanelOpen(o => !o)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
              triggerPanelOpen
                ? 'bg-accent/10 text-accent border-accent/30'
                : 'bg-surface text-text-secondary border-border hover:bg-surface-hover'
            }`}
            title="Trigger Settings"
          >
            <Clock size={13} /> Triggers
          </button>

          <button
            onClick={handleExecute}
            disabled={executing || !workflowId || workflowId === 'new'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-white bg-success rounded-lg hover:bg-success/90 disabled:opacity-40 transition-colors"
          >
            {executing ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            Execute
          </button>

          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-accent rounded-lg hover:bg-accent/90 disabled:opacity-40 transition-colors"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save
          </button>
        </div>

        {/* Main editor area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Node palette */}
            <DynamicNodePalette nodeTypes={catalog} onAdd={addNode} />

            {/* Center: ReactFlow canvas */}
            <div ref={wrapperRef} className="flex-1 relative" onDragOver={onDragOver} onDrop={onDrop}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onNodeDoubleClick={onNodeDoubleClick}
                onPaneClick={onPaneClick}
                onInit={setRfInstance}
                nodeTypes={NODE_TYPES}
                edgeTypes={EDGE_TYPES}
                defaultEdgeOptions={{
                  type: 'interactiveEdge',
                  style: { strokeWidth: 2, stroke: 'var(--color-border, #555)' },
                }}
                fitView
                snapToGrid
                snapGrid={[15, 15]}
                deleteKeyCode={['Backspace', 'Delete']}
              >
                <Background gap={15} size={1} />
                <Controls
                  className="!bg-surface !border-border !rounded-lg !shadow-lg [&>button]:!bg-surface [&>button]:!border-border [&>button]:!text-text-secondary [&>button:hover]:!bg-surface-hover [&>button]:!w-8 [&>button]:!h-8 [&>button>svg]:!fill-current"
                />
                <MiniMap
                  nodeColor={(n) => (n.data as any)?.color || '#6366f1'}
                  maskColor="rgba(0,0,0,0.15)"
                  className="!bg-surface !border-border !rounded-lg"
                />
              </ReactFlow>

              {/* ── Edge Insert Node Picker (浮层) ── */}
              {insertEdgeInfo && (
                <EdgeNodePicker
                  catalog={catalog}
                  screenPos={insertEdgeInfo.screenPos}
                  wrapperRef={wrapperRef}
                  onSelect={handleEdgeInsertSelect}
                  onClose={() => setInsertEdgeInfo(null)}
                />
              )}
            </div>

          {/* Node detail modal (n8n style, opened on double-click) */}
          {detailNode && (
            <NodeDetailModal
              nodeId={detailNode.id}
              nodeName={detailNode.data.label as string}
              nodeTypeDef={detailTypeDef || null}
              parameters={(detailNode.data._parameters as Record<string, any>) || {}}
              execState={lastExecution?.nodes[detailNode.id]}
              nodeContexts={nodeContexts}
              onUpdate={params => handleParamUpdate(detailNode.id, params)}
              onNameChange={name => handleNodeNameChange(detailNode.id, name)}
              onDelete={() => { handleSmartDeleteNode(detailNode.id); setDetailNodeId(null) }}
              onClose={() => setDetailNodeId(null)}
              onExecute={handleExecute}
              isExecuting={executing}
            />
          )}
          </div>

          {/* Bottom: Trigger panel (collapsible) */}
          {triggerPanelOpen && workflowId && workflowId !== 'new' && (
            <div className="shrink-0 border-t border-border max-h-[300px] overflow-y-auto">
              <TriggerPanel
                workflowId={workflowId}
                workflowName={wfName}
              />
            </div>
          )}

          {/* Bottom: Execution log panel */}
          <ExecutionLogPanel
            execution={lastExecution}
            open={logPanelOpen}
            onToggle={() => setLogPanelOpen(o => !o)}
            nodes={nodes}
          />
        </div>
      </div>
    </EditorActionsContext.Provider>
    </ExecutionContext.Provider>
  )
}


// ── Edge Node Picker ──────────────────────────────────
// 点击连线上的 "+" 按钮后弹出的浮动节点选择器

function EdgeNodePicker({
  catalog,
  screenPos,
  wrapperRef,
  onSelect,
  onClose,
}: {
  catalog: NodeTypeDef[]
  screenPos: { x: number; y: number }
  wrapperRef: React.RefObject<HTMLDivElement | null>
  onSelect: (typeName: string) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // 按搜索词过滤
  const filtered = useMemo(() => {
    if (!search) return catalog
    const q = search.toLowerCase()
    return catalog.filter(
      nt => nt.displayName.toLowerCase().includes(q) || nt.description.toLowerCase().includes(q),
    )
  }, [catalog, search])

  // 按组分组
  const grouped = useMemo(() => {
    const g: Record<string, NodeTypeDef[]> = {}
    for (const nt of filtered) {
      const group = nt.group || 'transform'
      if (!g[group]) g[group] = []
      g[group].push(nt)
    }
    return g
  }, [filtered])

  // 计算相对于 wrapper 的位置
  const wrapperRect = wrapperRef.current?.getBoundingClientRect()
  const left = wrapperRect ? screenPos.x - wrapperRect.left - 120 : screenPos.x - 120
  const top = wrapperRect ? screenPos.y - wrapperRect.top + 12 : screenPos.y + 12

  return (
    <>
      {/* 点击空白处关闭 */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div
        className="absolute z-50 bg-surface border border-border rounded-xl shadow-2xl w-60 overflow-hidden"
        style={{ left, top }}
      >
        {/* 搜索栏 */}
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-2.5 text-text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') onClose() }}
              placeholder="Search nodes..."
              className="w-full pl-7 pr-2 py-1.5 text-xs bg-bg border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent text-text placeholder:text-text-muted"
            />
          </div>
        </div>

        {/* 分组列表 */}
        <div className="overflow-y-auto max-h-72 p-1.5">
          {PICKER_GROUP_ORDER.filter(g => grouped[g]).map(group => (
            <div key={group} className="mb-1.5">
              <div className="px-2 py-1 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                {PICKER_GROUP_LABELS[group] || group}
              </div>
              {grouped[group].map(nt => (
                <button
                  key={nt.name}
                  onClick={() => onSelect(nt.name)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-surface-hover text-left transition-colors"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: nt.color || '#6366f1' }}
                  />
                  <span className="text-text truncate">{nt.displayName}</span>
                </button>
              ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-xs text-text-muted text-center">No matches</div>
          )}
        </div>
      </div>
    </>
  )
}


// ── Conversion helpers ────────────────────────────────

function wfToReactFlow(
  wf: WFWorkflow,
  catalogMap: Record<string, NodeTypeDef>,
): { rfNodes: Node[]; rfEdges: Edge[] } {
  const rfNodes: Node[] = wf.nodes.map(n => {
    const nt = catalogMap[n.type]
    return {
      id: n.id,
      type: 'visualNode',
      position: { x: n.position[0], y: n.position[1] },
      data: {
        label: n.name || nt?.displayName || n.type,
        nodeType: n.type,
        icon: nt?.icon || '',
        color: nt?.color || '#6366f1',
        subtitle: '',
        hasInputs: nt ? nt.inputs.length > 0 : true,
        hasOutputs: nt ? nt.outputs.length > 0 : true,
        outputCount: nt?.outputs.length || 1,
        outputNames: nt?.outputNames,
        _parameters: n.parameters,
        _typeName: n.type,
      },
    }
  })

  // 构建源节点输出数量映射，多输出节点的所有 handle 都带 ID
  const nodeOutputCount: Record<string, number> = {}
  for (const n of rfNodes) {
    nodeOutputCount[n.id] = n.data.outputCount || 1
  }

  const rfEdges: Edge[] = wf.connections.map((c, i) => {
    const srcOutputs = nodeOutputCount[c.source] || 1
    return {
      id: `e_${c.source}_${c.target}_${i}`,
      source: c.source,
      target: c.target,
      // 多输出节点的所有 handle 都用 output-{i}（含 0），单输出用 undefined（默认 handle）
      sourceHandle: srcOutputs > 1 ? `output-${c.sourceOutput}` : undefined,
      targetHandle: undefined, // 输入始终单 handle，无需指定
    }
  })

  return { rfNodes, rfEdges }
}

function reactFlowToWf(
  nodes: Node[],
  edges: Edge[],
  name: string,
  description: string,
  existingId?: string,
  active?: boolean,
): Partial<WFWorkflow> {
  const wfNodes: WFNode[] = nodes.map(n => ({
    id: n.id,
    name: (n.data.label as string) || '',
    type: (n.data._typeName as string) || '',
    parameters: (n.data._parameters as Record<string, any>) || {},
    position: [n.position.x, n.position.y] as [number, number],
    disabled: false,
  }))

  const wfConnections: WFConnection[] = edges.map(e => {
    let sourceOutput = 0
    if (e.sourceHandle?.startsWith('output-')) {
      sourceOutput = parseInt(e.sourceHandle.replace('output-', ''), 10) || 0
    }
    let targetInput = 0
    if (e.targetHandle?.startsWith('input-')) {
      targetInput = parseInt(e.targetHandle.replace('input-', ''), 10) || 0
    }
    return { source: e.source, sourceOutput, target: e.target, targetInput }
  })

  return {
    id: existingId && existingId !== 'new' ? existingId : undefined,
    name,
    description,
    active: active ?? false,
    nodes: wfNodes,
    connections: wfConnections,
  }
}
