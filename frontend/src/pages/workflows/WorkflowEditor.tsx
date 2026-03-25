import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState, MarkerType,
  type Connection, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import { ArrowLeft, Save, Play, Loader2, Layout, Download } from 'lucide-react'
import { getWorkflow, updateWorkflow, createWorkflow, executeWorkflow, getNodeCatalog, type NodeTypeDef } from '../../api/workflow'
import WfNode from './WfNode'
import NodePalette from './NodePalette'
import PropertyPanel from './PropertyPanel'
import toast from 'react-hot-toast'

const nodeTypes = { wfNode: WfNode }
let _cnt = 1
const nextId = () => `n_${Date.now()}_${_cnt++}`

function autoLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph(); g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 180 })
  nodes.forEach(n => g.setNode(n.id, { width: 200, height: 60 }))
  edges.forEach(e => g.setEdge(e.source, e.target))
  dagre.layout(g)
  return nodes.map(n => { const p = g.node(n.id); return { ...n, position: { x: p.x - 100, y: p.y - 30 } } })
}

export default function WorkflowEditor() {
  const { workflowId } = useParams()
  const navigate = useNavigate()
  const isNew = workflowId === 'new'
  const [wfId, setWfId] = useState(isNew ? '' : workflowId || '')
  const [wfName, setWfName] = useState('新工作流')
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [catalog, setCatalog] = useState<NodeTypeDef[]>([])
  const [selected, setSelected] = useState<Node | null>(null)
  const [saving, setSaving] = useState(false)
  const [executing, setExecuting] = useState(false)

  useEffect(() => { getNodeCatalog().then(d => setCatalog(d.nodes || [])).catch(() => {}) }, [])

  useEffect(() => {
    if (!isNew && workflowId) {
      getWorkflow(workflowId).then(wf => {
        setWfName(wf.name || '工作流')
        setNodes((wf.nodes || []).map((n: any) => ({
          id: n.id, type: 'wfNode', position: n.position || { x: 0, y: 0 },
          data: { label: n.label || n.type, nodeType: n.type, config: n.config || {}, catalog: [] },
        })))
        setEdges((wf.edges || []).map((e: any, i: number) => ({
          id: `e-${i}`, source: e.source, target: e.target,
          sourceHandle: e.sourceOutput != null ? `out-${e.sourceOutput}` : undefined,
          markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: 'var(--border)' },
        })))
      }).catch(() => toast.error('加载失败'))
    }
  }, [workflowId])

  // inject catalog into nodes
  useEffect(() => { if (catalog.length) setNodes(ns => ns.map(n => ({ ...n, data: { ...n.data, catalog } }))) }, [catalog])

  const onConnect = useCallback((p: Connection) => setEdges(es => addEdge({ ...p, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: 'var(--border)' } }, es)), [])

  const addNode = useCallback((td: NodeTypeDef) => {
    setNodes(ns => [...ns, { id: nextId(), type: 'wfNode',
      position: { x: 300 + Math.random() * 200, y: 150 + Math.random() * 200 },
      data: { label: td.displayName, nodeType: td.name, config: {}, catalog } }])
  }, [catalog])

  const delSelected = useCallback(() => {
    if (!selected) return
    setNodes(ns => ns.filter(n => n.id !== selected.id))
    setEdges(es => es.filter(e => e.source !== selected.id && e.target !== selected.id))
    setSelected(null)
  }, [selected])

  const updateCfg = useCallback((id: string, cfg: any) => {
    setNodes(ns => ns.map(n => n.id === id ? { ...n, data: { ...n.data, config: cfg } } : n))
    if (selected?.id === id) setSelected(p => p ? { ...p, data: { ...p.data, config: cfg } } : null)
  }, [selected])

  const updateLabel = useCallback((id: string, label: string) => {
    setNodes(ns => ns.map(n => n.id === id ? { ...n, data: { ...n.data, label } } : n))
  }, [])

  const toWfData = () => ({
    name: wfName,
    nodes: nodes.map(n => ({ id: n.id, type: n.data.nodeType, label: n.data.label, config: n.data.config || {}, position: n.position })),
    edges: edges.map(e => ({ source: e.source, target: e.target, sourceOutput: e.sourceHandle ? parseInt(e.sourceHandle.replace('out-', '')) : 0 })),
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      if (wfId) { await updateWorkflow(wfId, toWfData()); toast.success('已保存') }
      else { const r = await createWorkflow(toWfData()); if (r.id) { setWfId(r.id); navigate(`/workflows/${r.id}`, { replace: true }); toast.success('已创建') } }
    } catch { toast.error('保存失败') } finally { setSaving(false) }
  }

  const handleExec = async () => {
    if (!wfId) { await handleSave(); return }
    setExecuting(true)
    try { const r = await executeWorkflow(wfId); toast.success(`完成: ${r.status}`) } catch { toast.error('执行失败') } finally { setExecuting(false) }
  }

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(toWfData(), null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${wfName}.json`; a.click()
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/workflows')} className="p-1.5 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}><ArrowLeft size={16} /></button>
          <input value={wfName} onChange={e => setWfName(e.target.value)} className="text-sm font-medium bg-transparent outline-none w-[200px]" style={{ color: 'var(--text)' }} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setNodes(autoLayout(nodes, edges))} className="p-1.5 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }} title="自动布局"><Layout size={14} /></button>
          <button onClick={handleExport} className="p-1.5 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }} title="导出"><Download size={14} /></button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
            style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} 保存</button>
          <button onClick={handleExec} disabled={executing} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white"
            style={{ background: executing ? 'var(--border)' : 'var(--accent)' }}>
            {executing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} 执行</button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <NodePalette catalog={catalog} onAdd={addNode} />
        <div className="flex-1">
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect} onNodeClick={(_, n) => setSelected(n)} onPaneClick={() => setSelected(null)}
            nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: 'var(--border)' } }}
            style={{ background: 'var(--bg)' }}>
            <Background color="var(--border)" gap={20} size={1} />
            <Controls />
            <MiniMap style={{ background: 'var(--bg-surface)' }} />
          </ReactFlow>
        </div>
        {selected && <PropertyPanel node={selected} catalog={catalog} onUpdateConfig={c => updateCfg(selected.id, c)}
          onUpdateLabel={l => updateLabel(selected.id, l)} onDelete={delSelected} onClose={() => setSelected(null)} />}
      </div>
    </div>
  )
}
