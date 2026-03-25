import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState, MarkerType,
  type Connection, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import { ArrowLeft, Save, Play, Loader2, Layout, Download, Clock, X } from 'lucide-react'
import { getWorkflow, updateWorkflow, createWorkflow, executeWorkflow, getNodeCatalog, getExecutions, type NodeTypeDef } from '../../api/workflow'
import WfNode from './WfNode'
import NodePalette from './NodePalette'
import PropertyPanel from './PropertyPanel'
import NodeEditModal from './NodeEditModal'
import toast from 'react-hot-toast'

const nodeTypes = { wfNode: WfNode }
let _cnt = 1; const nextId = () => `n_${Date.now()}_${_cnt++}`
function autoLayout(ns: Node[], es: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph(); g.setDefaultEdgeLabel(() => ({})); g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 180 })
  ns.forEach(n => g.setNode(n.id, { width: 200, height: 60 })); es.forEach(e => g.setEdge(e.source, e.target)); dagre.layout(g)
  return ns.map(n => { const p = g.node(n.id); return { ...n, position: { x: p.x - 100, y: p.y - 30 } } })
}
type ES = Record<string, { status: string; output?: any; error?: string; duration?: number }>

export default function WorkflowEditor() {
  const { workflowId } = useParams(); const navigate = useNavigate(); const isNew = workflowId === 'new'
  const [wfId, setWfId] = useState(isNew ? '' : workflowId || ''); const [wfName, setWfName] = useState('新工作流')
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]); const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [catalog, setCatalog] = useState<NodeTypeDef[]>([]); const [selected, setSelected] = useState<Node | null>(null)
  const [saving, setSaving] = useState(false); const [executing, setExecuting] = useState(false)
  const [execStatus, setExecStatus] = useState<ES>({}); const [resultPopup, setResultPopup] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([]); const [showHistory, setShowHistory] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null)
  const [clipboard, setClipboard] = useState<Node | null>(null)
  const [editModal, setEditModal] = useState<Node | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => { getNodeCatalog().then(d => setCatalog(d.nodes || [])).catch(() => {}) }, [])
  useEffect(() => { if (!isNew && workflowId) { getWorkflow(workflowId).then(wf => {
    setWfName(wf.name || '工作流')
    setNodes((wf.nodes || []).map((n: any) => ({ id: n.id, type: 'wfNode', position: n.position || { x: 0, y: 0 },
      data: { label: n.label || n.type, nodeType: n.type, config: n.config || {}, catalog: [], disabled: n.disabled || false } })))
    setEdges((wf.edges || []).map((e: any, i: number) => ({ id: `e-${i}`, source: e.source, target: e.target,
      sourceHandle: e.sourceOutput != null ? `out-${e.sourceOutput}` : undefined,
      markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: 'var(--border)' } })))
  }).catch(() => toast.error('加载失败')) } }, [workflowId])
  useEffect(() => { if (catalog.length) setNodes(ns => ns.map(n => ({ ...n, data: { ...n.data, catalog } }))) }, [catalog])
  useEffect(() => { setNodes(ns => ns.map(n => ({ ...n, data: { ...n.data, execState: execStatus[n.id] } }))) }, [execStatus])

  // WebSocket
  useEffect(() => { try { const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`); wsRef.current = ws
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', user_id: 'ws' }))
    ws.onmessage = (e) => { try { const m = JSON.parse(e.data)
      if (m.type === 'workflow_node_status') setExecStatus(p => ({ ...p, [m.node_id]: { status: m.status, output: m.output_preview, error: m.error, duration: m.duration } }))
      else if (m.type === 'workflow_execution_done') { m.status === 'completed' ? toast.success(`完成`) : toast.error(`失败`); setExecuting(false) }
    } catch {} }; ws.onclose = () => { wsRef.current = null } } catch {}
    return () => { wsRef.current?.close() } }, [])

  const onConnect = useCallback((p: Connection) => setEdges(es => addEdge({ ...p, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: 'var(--border)' } }, es)), [])
  const addNode = useCallback((td: NodeTypeDef) => { setNodes(ns => [...ns, { id: nextId(), type: 'wfNode',
    position: { x: 300 + Math.random() * 200, y: 150 + Math.random() * 200 }, data: { label: td.displayName, nodeType: td.name, config: {}, catalog } }]) }, [catalog])
  const delNode = useCallback((id: string) => { setNodes(ns => ns.filter(n => n.id !== id)); setEdges(es => es.filter(e => e.source !== id && e.target !== id)); if (selected?.id === id) setSelected(null); setCtxMenu(null) }, [selected])
  const updateCfg = useCallback((id: string, cfg: any) => { setNodes(ns => ns.map(n => n.id === id ? { ...n, data: { ...n.data, config: cfg } } : n)); if (selected?.id === id) setSelected(p => p ? { ...p, data: { ...p.data, config: cfg } } : null) }, [selected])
  const updateLabel = useCallback((id: string, l: string) => { setNodes(ns => ns.map(n => n.id === id ? { ...n, data: { ...n.data, label: l } } : n)) }, [])

  const toggleDisable = useCallback((id: string) => { setNodes(ns => ns.map(n => n.id === id ? { ...n, data: { ...n.data, disabled: !n.data.disabled } } : n)); setCtxMenu(null) }, [])
  const copyNode = useCallback((id: string) => { const n = nodes.find(x => x.id === id); if (n) setClipboard(n); setCtxMenu(null); toast.success('已复制') }, [nodes])
  const pasteNode = useCallback(() => { if (!clipboard) return; setNodes(ns => [...ns, { id: nextId(), type: 'wfNode',
    position: { x: (clipboard.position?.x || 0) + 50, y: (clipboard.position?.y || 0) + 50 },
    data: { ...clipboard.data, label: `${clipboard.data.label} (复制)`, execState: undefined, disabled: false } }]); toast.success('已粘贴') }, [clipboard])

  const toWfData = () => ({ name: wfName,
    nodes: nodes.map(n => ({ id: n.id, type: n.data.nodeType, label: n.data.label, config: n.data.config || {}, position: n.position, disabled: n.data.disabled || false })),
    edges: edges.map(e => ({ source: e.source, target: e.target, sourceOutput: e.sourceHandle ? parseInt(e.sourceHandle.replace('out-', '')) : 0 })) })

  const handleSave = async () => { setSaving(true); try { if (wfId) { await updateWorkflow(wfId, toWfData()); toast.success('已保存') }
    else { const r = await createWorkflow(toWfData()); if (r.id) { setWfId(r.id); navigate(`/workflows/${r.id}`, { replace: true }); toast.success('已创建') } }
  } catch { toast.error('保存失败') } finally { setSaving(false) } }

  const runWf = async (stopAt = '') => {
    if (!wfId) { await handleSave(); return }; setExecStatus({}); setExecuting(true)
    try { const body: any = { trigger_data: {} }; if (stopAt) body.stop_at_node = stopAt
      const r = await executeWorkflow(wfId, body)
      if (r.node_results) { const sm: ES = {}; for (const [nid, nr] of Object.entries(r.node_results as Record<string, any>)) sm[nid] = { status: nr.status, output: nr.output, error: nr.error, duration: nr.duration }; setExecStatus(sm) }
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) { toast.success(`完成: ${r.status}`); setExecuting(false) }
    } catch { toast.error('执行失败'); setExecuting(false) }
  }

  // Keyboard shortcuts
  useEffect(() => { const h = (e: KeyboardEvent) => {
    const tag = (document.activeElement?.tagName || '').toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selected) copyNode(selected.id)
    if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboard) pasteNode()
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected) delNode(selected.id)
  }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [selected, clipboard, copyNode, pasteNode, delNode])

  const onNodeCtx = useCallback((ev: React.MouseEvent, n: Node) => { ev.preventDefault(); setCtxMenu({ x: ev.clientX, y: ev.clientY, nodeId: n.id }) }, [])

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/workflows')} className="p-1.5 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}><ArrowLeft size={16} /></button>
          <input value={wfName} onChange={e => setWfName(e.target.value)} className="text-sm font-medium bg-transparent outline-none w-[200px]" style={{ color: 'var(--text)' }} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setNodes(autoLayout(nodes, edges))} className="p-1.5 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }} title="布局"><Layout size={14} /></button>
          <button onClick={async () => { if (!wfId) return; const d = await getExecutions(wfId); setHistory(d.executions || []); setShowHistory(true) }} className="p-1.5 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }} title="历史"><Clock size={14} /></button>
          <button onClick={() => { const b = new Blob([JSON.stringify(toWfData(), null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${wfName}.json`; a.click() }}
            className="p-1.5 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }} title="导出"><Download size={14} /></button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} 保存</button>
          <button onClick={() => runWf()} disabled={executing} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white" style={{ background: executing ? 'var(--border)' : 'var(--accent)' }}>
            {executing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} 执行</button>
        </div>
      </div>
      <div className="flex-1 flex min-h-0 relative">
        <NodePalette catalog={catalog} onAdd={addNode} />
        <div className="flex-1">
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect} onNodeClick={(_, n) => { setSelected(n); const es = execStatus[n.id]; if (es?.output) setResultPopup({ nodeId: n.id, data: es }) }}
            onNodeDoubleClick={(_, n) => setEditModal(n)}
            onPaneClick={() => { setSelected(null); setResultPopup(null); setCtxMenu(null) }}
            onNodeContextMenu={onNodeCtx} nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: 'var(--border)' } }} style={{ background: 'var(--bg)' }}>
            <Background color="var(--border)" gap={20} size={1} /><Controls /><MiniMap style={{ background: 'var(--bg-surface)' }} />
          </ReactFlow>
        </div>
        {selected && !resultPopup && <PropertyPanel node={selected} catalog={catalog} execData={execStatus[selected.id]}
          upstreamOutput={edges.reduce((a: any, e) => a || (e.target === selected.id ? execStatus[e.source]?.output : null), null)}
          onUpdateConfig={c => updateCfg(selected.id, c)} onUpdateLabel={l => updateLabel(selected.id, l)} onDelete={() => delNode(selected.id)} onClose={() => setSelected(null)} />}
        {resultPopup && <div className="absolute bottom-4 right-4 w-[350px] max-h-[400px] rounded-xl overflow-hidden shadow-2xl z-50" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <span className="text-xs font-medium">输出 <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] text-white" style={{ background: resultPopup.data.status === 'completed' ? 'var(--success)' : 'var(--error)' }}>{resultPopup.data.status}</span></span>
            <button onClick={() => setResultPopup(null)} className="p-1 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}><X size={14} /></button></div>
          <pre className="p-3 text-[10px] overflow-auto max-h-[300px]" style={{ color: 'var(--text)' }}>{typeof resultPopup.data.output === 'string' ? resultPopup.data.output : JSON.stringify(resultPopup.data.output, null, 2)}</pre>
        </div>}
        {showHistory && history.length > 0 && <div className="absolute bottom-0 left-[220px] right-0 max-h-[180px] overflow-auto border-t z-40" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between px-3 py-1.5 border-b sticky top-0" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
            <span className="text-xs font-medium">执行历史</span><button onClick={() => setShowHistory(false)} className="p-0.5 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}><X size={12} /></button></div>
          {history.slice(0, 10).map((ex: any, i: number) => <div key={i} className="flex items-center gap-3 px-3 py-1.5 text-xs hover:bg-[var(--bg-hover)] cursor-pointer"
            onClick={() => { if (ex.node_results) { const sm: ES = {}; for (const [nid, nr] of Object.entries(ex.node_results as Record<string, any>)) sm[nid] = { status: nr.status, output: nr.output, error: nr.error, duration: nr.duration }; setExecStatus(sm) }; setShowHistory(false) }}>
            <span className={`w-2 h-2 rounded-full ${ex.status === 'completed' ? 'bg-green-500' : 'bg-red-500'}`} />
            <span style={{ color: 'var(--text-muted)' }}>{new Date((ex.started_at || 0) * 1000).toLocaleString('zh-CN')}</span>
            <span style={{ color: 'var(--text-muted)' }}>{ex.status}</span></div>)}
        </div>}
      </div>
      {/* Context menu */}
      {ctxMenu && <><div className="fixed inset-0 z-40" onClick={() => setCtxMenu(null)} />
        <div className="fixed z-50 py-1 rounded-lg shadow-xl min-w-[160px]" style={{ left: ctxMenu.x, top: ctxMenu.y, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          {[{ l: '编辑参数', i: '✏️', a: () => { setSelected(nodes.find(n => n.id === ctxMenu.nodeId) || null); setCtxMenu(null) } },
            { l: '执行到此', i: '▶️', a: () => { setCtxMenu(null); runWf(ctxMenu.nodeId) } },
            null,
            { l: '复制', i: '📋', a: () => copyNode(ctxMenu.nodeId), k: '⌘C' },
            ...(clipboard ? [{ l: '粘贴', i: '📌', a: () => { pasteNode(); setCtxMenu(null) }, k: '⌘V' }] : []),
            { l: nodes.find(n => n.id === ctxMenu.nodeId)?.data?.disabled ? '启用' : '禁用', i: '⏸️', a: () => toggleDisable(ctxMenu.nodeId) },
            null,
            { l: '删除', i: '🗑️', a: () => delNode(ctxMenu.nodeId), d: true },
          ].map((item, i) => item === null
            ? <div key={i} className="my-1 border-t" style={{ borderColor: 'var(--border)' }} />
            : <button key={i} onClick={item.a} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-[var(--bg-hover)]"
                style={{ color: (item as any).d ? 'var(--error)' : 'var(--text)' }}>
                <span className="w-4 text-center">{item.i}</span><span className="flex-1">{item.l}</span>
                {(item as any).k && <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{(item as any).k}</span>}
              </button>
          )}
        </div></>}
      {editModal && <NodeEditModal node={editModal} catalog={catalog} execData={execStatus[editModal.id]}
        upstreamOutput={edges.reduce((a: any, e) => a || (e.target === editModal.id ? execStatus[e.source]?.output : null), null)}
        onUpdateConfig={c => { updateCfg(editModal.id, c); setEditModal(p => p ? { ...p, data: { ...p.data, config: c } } : null) }}
        onUpdateLabel={l => { updateLabel(editModal.id, l); setEditModal(p => p ? { ...p, data: { ...p.data, label: l } } : null) }}
        onClose={() => setEditModal(null)} />}
    </div>
  )
}
