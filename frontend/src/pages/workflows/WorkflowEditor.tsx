import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState, useReactFlow, MarkerType,
  type Connection, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import { ArrowLeft, Save, Play, Loader2, Layout, Download, Clock, X } from 'lucide-react'
import { getWorkflow, updateWorkflow, createWorkflow, executeWorkflow, getNodeCatalog, getExecutions, type NodeTypeDef } from '../../api/workflow'
import WfNode from './WfNode'
import NodePalette from './NodePalette'
import PropertyPanel from './PropertyPanel'
import NodeEditModal from './NodeEditModal'
import { NODE_OUTPUT_SCHEMAS } from './nodeOutputSchemas'
import toast from 'react-hot-toast'

const nodeTypes = { wfNode: WfNode }
let _cnt = 1; const nextId = () => `n_${Date.now()}_${_cnt++}`
function autoLayout(ns: Node[], es: Edge[]): Node[] {
  if (!ns.length) return ns
  const g = new dagre.graphlib.Graph(); g.setDefaultEdgeLabel(() => ({})); g.setGraph({ rankdir: 'LR', nodesep: 80, ranksep: 200, marginx: 50, marginy: 50 })
  ns.forEach(n => g.setNode(n.id, { width: 200, height: 70 })); es.forEach(e => g.setEdge(e.source, e.target)); dagre.layout(g)
  return ns.map(n => { const p = g.node(n.id); return { ...n, position: { x: p.x - 100, y: p.y - 35 } } })
}
type ES = Record<string, { status: string; output?: any; error?: string; duration?: number }>

export default function WorkflowEditor() {
  return <ReactFlowProvider><WorkflowEditorInner /></ReactFlowProvider>
}

function WorkflowEditorInner() {
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
  const [showTriggerPicker, setShowTriggerPicker] = useState(false)
  const [pinnedData, setPinnedData] = useState<Record<string, any>>({})
  const wsRef = useRef<WebSocket | null>(null)
  const { fitView } = useReactFlow()

  useEffect(() => { getNodeCatalog().then(d => setCatalog(d.nodes || [])).catch(() => {}) }, [])
  useEffect(() => { if (isNew && catalog.length > 0 && nodes.length === 0) setShowTriggerPicker(true) }, [isNew, catalog])
  useEffect(() => { if (!isNew && workflowId) { getWorkflow(workflowId).then(wf => {
    setWfName(wf.name || '工作流')
    const ln = (wf.nodes || []).map((n: any) => ({ id: n.id, type: 'wfNode', position: n.position || { x: 0, y: 0 },
      data: { label: n.label || n.type, nodeType: n.type, config: n.config || {}, catalog: [], disabled: n.disabled || false } }))
    const le = (wf.edges || []).map((e: any, i: number) => ({ id: `e-${i}`, source: e.source, target: e.target,
      sourceHandle: e.sourceOutput != null ? `out-${e.sourceOutput}` : undefined,
      markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: 'var(--border)' } }))
    // Auto-layout if positions overlap or all at origin
    const needsLayout = ln.length > 1 && (ln.every((n: any) => !n.position.x && !n.position.y) ||
      new Set(ln.map((n: any) => `${Math.round(n.position.x)},${Math.round(n.position.y)}`)).size < ln.length * 0.5)
    setNodes(needsLayout ? autoLayout(ln, le) : ln); setEdges(le)
    setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 200)
  }).catch(() => toast.error('加载失败')) } }, [workflowId])
  useEffect(() => { if (catalog.length) setNodes(ns => ns.map(n => ({ ...n, data: { ...n.data, catalog } }))) }, [catalog])
  useEffect(() => { setNodes(ns => ns.map(n => ({ ...n, data: { ...n.data, execState: execStatus[n.id], isPinned: !!pinnedData[n.id] } }))) }, [execStatus, pinnedData])

  // Edge animation based on execution status
  useEffect(() => {
    const hasExec = Object.keys(execStatus).length > 0
    setEdges(eds => eds.map(e => {
      if (!hasExec) return { ...e, className: '', animated: false, style: { stroke: 'var(--border)' } }
      const ss = execStatus[e.source]?.status; const ts = execStatus[e.target]?.status
      if (ss === 'completed' && ts === 'completed') return { ...e, className: 'wf-edge-completed', animated: false, style: { stroke: '#22c55e' } }
      if (ss === 'completed' && ts === 'failed') return { ...e, className: 'wf-edge-failed', animated: false, style: { stroke: '#ef4444' } }
      if (ss === 'completed' && (!ts || ts === 'running')) return { ...e, className: 'wf-edge-running', animated: true, style: { stroke: '#3b82f6' } }
      return { ...e, className: '', animated: false, style: { stroke: 'var(--border)' } }
    }))
  }, [execStatus])

  // WebSocket
  useEffect(() => { try { const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`); wsRef.current = ws
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', user_id: 'ws' }))
    ws.onmessage = (e) => { try { const m = JSON.parse(e.data)
      if (m.type === 'workflow_node_status') setExecStatus(p => ({ ...p, [m.node_id]: { status: m.status, output: m.output_preview, error: m.error, duration: m.duration } }))
      else if (m.type === 'workflow_execution_done') { m.status === 'completed' ? toast.success(`完成`) : toast.error(`失败`); setExecuting(false) }
    } catch {} }; ws.onclose = () => { wsRef.current = null } } catch {}
    return () => { wsRef.current?.close() } }, [])

  const onConnect = useCallback((p: Connection) => setEdges(es => addEdge({ ...p, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: 'var(--border)' } }, es)), [])
  const addNode = useCallback((td: NodeTypeDef) => {
    const maxX = nodes.length ? Math.max(...nodes.map(n => n.position?.x || 0)) : 50
    const avgY = nodes.length ? nodes.reduce((s, n) => s + (n.position?.y || 0), 0) / nodes.length : 200
    setNodes(ns => [...ns, { id: nextId(), type: 'wfNode', position: { x: maxX + 250, y: avgY },
      data: { label: td.displayName, nodeType: td.name, config: {}, catalog } }])
  }, [catalog, nodes])
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

  const pinOutput = useCallback((id: string, out: any) => { setPinnedData(p => ({ ...p, [id]: out })); toast.success('已固定') }, [])
  const unpinOutput = useCallback((id: string) => { setPinnedData(p => { const n = { ...p }; delete n[id]; return n }); toast.success('已取消固定') }, [])

  const getUpstreamInfo = useCallback((nodeId: string) => {
    const upstreams: Array<{ nodeId: string; nodeLabel: string; nodeType: string; data: any; schema: any[] }> = []
    for (const edge of edges) { if (edge.target === nodeId) {
      const src = nodes.find(n => n.id === edge.source); if (!src) continue
      const st = (src.data as any)?.nodeType || ''
      upstreams.push({ nodeId: edge.source, nodeLabel: (src.data as any)?.label || st, nodeType: st,
        data: pinnedData[edge.source] || execStatus[edge.source]?.output || null, schema: NODE_OUTPUT_SCHEMAS[st] || [] })
    } }
    return { upstreams, directOutput: upstreams.find(u => u.data)?.data || null }
  }, [edges, nodes, execStatus, pinnedData])

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/workflows')} className="p-1.5 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}><ArrowLeft size={16} /></button>
          <input value={wfName} onChange={e => setWfName(e.target.value)} className="text-sm font-medium bg-transparent outline-none w-[200px]" style={{ color: 'var(--text)' }} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setNodes(autoLayout(nodes, edges)); setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 100) }} className="p-1.5 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }} title="布局"><Layout size={14} /></button>
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
        <div className="flex-1 relative">
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect} onNodeClick={(_, n) => { setSelected(n); const es = execStatus[n.id]; if (es?.output) setResultPopup({ nodeId: n.id, data: es }) }}
            onNodeDoubleClick={(_, n) => setEditModal(n)}
            onPaneClick={() => { setSelected(null); setResultPopup(null); setCtxMenu(null) }}
            onNodeContextMenu={onNodeCtx} nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: 'var(--border)' } }} style={{ background: 'var(--bg)' }}>
            <Background color="var(--border)" gap={20} size={1} /><Controls /><MiniMap style={{ background: 'var(--bg-surface)' }} />
          </ReactFlow>
          {nodes.length === 0 && !showTriggerPicker && <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="text-center pointer-events-auto"><div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--accent)', opacity: 0.15 }}>
              <Play size={32} style={{ color: 'var(--accent)' }} /></div>
              <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>开始创建工作流</h3>
              <p className="text-xs mb-4 max-w-[300px]" style={{ color: 'var(--text-muted)' }}>选择触发方式，然后添加处理节点</p>
              <button onClick={() => setShowTriggerPicker(true)} className="px-5 py-2.5 rounded-lg text-sm text-white font-medium" style={{ background: 'var(--accent)' }}>选择触发方式</button>
            </div></div>}
          {showTriggerPicker && <div className="absolute inset-0 flex items-center justify-center z-20" style={{ background: 'rgba(0,0,0,0.3)' }}>
            <div className="rounded-xl p-5 w-[400px]" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>选择触发方式</h3>
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>工作流如何启动？</p>
              <div className="space-y-2">{catalog.filter(c => c.group === 'trigger').map(t => (
                <button key={t.name} onClick={() => { addNode(t); setShowTriggerPicker(false) }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left hover:border-[var(--accent)]"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#22c55e20', color: '#22c55e' }}>
                    {t.name === 'manualTrigger' ? '▶' : t.name === 'scheduleTrigger' ? '⏰' : '🔗'}</div>
                  <div><div className="text-xs font-medium" style={{ color: 'var(--text)' }}>{t.displayName}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t.description}</div></div>
                </button>))}</div>
              <button onClick={() => setShowTriggerPicker(false)} className="w-full mt-3 py-2 text-xs rounded-lg" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>跳过</button>
            </div></div>}
        </div>
        {selected && !resultPopup && (() => { const ui = getUpstreamInfo(selected.id); return <PropertyPanel node={selected} catalog={catalog} execData={execStatus[selected.id]}
          upstreamOutput={ui.directOutput} upstreamNodes={ui.upstreams}
          onUpdateConfig={c => updateCfg(selected.id, c)} onUpdateLabel={l => updateLabel(selected.id, l)} onDelete={() => delNode(selected.id)} onClose={() => setSelected(null)} /> })()}
        {/* 执行进度面板 */}
        {executing && <div className="absolute bottom-4 right-4 w-[300px] rounded-xl shadow-2xl overflow-hidden z-30"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border-2 border-t-[var(--accent)] border-[var(--border)] animate-spin" />
                <span className="text-xs font-medium">正在执行</span></div>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{Object.values(execStatus).filter((s: any) => s.status === 'completed').length}/{nodes.length}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
              <div className="h-full rounded-full transition-all duration-500" style={{
                width: `${(Object.values(execStatus).filter((s: any) => ['completed','failed'].includes(s.status)).length / Math.max(nodes.length, 1)) * 100}%`,
                background: Object.values(execStatus).some((s: any) => s.status === 'failed') ? '#ef4444' : 'var(--accent)' }} /></div>
          </div>
          <div className="max-h-[200px] overflow-auto px-2 py-1">
            {nodes.map(n => { const st = execStatus[n.id] as any; const lb = (n.data as any)?.label || n.id; return (
              <div key={n.id} className="flex items-center gap-2 px-2 py-1.5 rounded text-xs">
                {st?.status === 'completed' ? <span>✅</span> : st?.status === 'failed' ? <span>❌</span>
                 : st?.status === 'running' ? <div className="w-3 h-3 rounded-full border-[1.5px] border-t-[var(--accent)] border-[var(--border)] animate-spin" />
                 : <span style={{ color: 'var(--text-muted)' }}>○</span>}
                <span className="flex-1 truncate" style={{ color: st ? 'var(--text)' : 'var(--text-muted)' }}>{lb}</span>
                {st?.duration > 0 && <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{st.duration.toFixed(1)}s</span>}
              </div>) })}
          </div>
        </div>}
        {/* 节点输出弹窗 */}
        {!executing && resultPopup && <div className="absolute bottom-4 right-4 w-[350px] max-h-[400px] rounded-xl overflow-hidden shadow-2xl z-50" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
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
      {editModal && (() => { const ui = getUpstreamInfo(editModal.id); return <NodeEditModal node={editModal} catalog={catalog} execData={execStatus[editModal.id]}
        upstreamOutput={ui.directOutput} upstreamNodes={ui.upstreams}
        onPinOutput={o => pinOutput(editModal.id, o)} onUnpinOutput={() => unpinOutput(editModal.id)} isPinned={!!pinnedData[editModal.id]}
        onUpdateConfig={c => { updateCfg(editModal.id, c); setEditModal(p => p ? { ...p, data: { ...p.data, config: c } } : null) }}
        onUpdateLabel={l => { updateLabel(editModal.id, l); setEditModal(p => p ? { ...p, data: { ...p.data, label: l } } : null) }}
        onClose={() => setEditModal(null)} /> })()}
    </div>
  )
}
