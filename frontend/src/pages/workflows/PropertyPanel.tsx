import { useState, useEffect, useMemo } from 'react'
import { X, Trash2, Play, Loader2, Table, Braces, ChevronRight, ChevronDown } from 'lucide-react'
import type { Node } from '@xyflow/react'
import type { NodeTypeDef } from '../../api/workflow'
import { testNode } from '../../api/workflow'
import toast from 'react-hot-toast'

interface Props {
  node: Node; catalog: NodeTypeDef[]; execData?: any; upstreamOutput?: any
  upstreamNodes?: Array<{ nodeId: string; nodeLabel: string; nodeType: string; data: any; schema: any[] }>
  onUpdateConfig: (c: any) => void; onUpdateLabel: (l: string) => void; onDelete: () => void; onClose: () => void
  onFieldInsert?: (expr: string) => void
}
type Tab = 'params' | 'input' | 'output'

export default function PropertyPanel({ node, catalog, execData, upstreamOutput, upstreamNodes, onUpdateConfig, onUpdateLabel, onDelete, onClose, onFieldInsert }: Props) {
  const { label, nodeType, config } = node.data as any
  const def = catalog.find(c => c.name === nodeType)
  const params = def?.parameters || []
  const [tab, setTab] = useState<Tab>('params')
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [testInput, setTestInput] = useState('{}')
  const [outView, setOutView] = useState<'table' | 'json'>('json')

  useEffect(() => { if (upstreamOutput) setTestInput(JSON.stringify(upstreamOutput, null, 2)) }, [upstreamOutput])
  useEffect(() => { if (execData?.output) setResult(execData) }, [execData])

  const handleTest = async () => {
    setTesting(true); setResult(null)
    try { let inp = {}; try { inp = JSON.parse(testInput) } catch {}
      const r = await testNode(nodeType, config, inp); setResult(r); setTab('output')
      r.status === 'completed' ? toast.success('测试成功') : toast.error(`失败: ${r.error}`)
    } catch { toast.error('测试失败') } finally { setTesting(false) }
  }

  const outItems = useMemo(() => {
    const o = result?.output; if (!o) return []
    if (Array.isArray(o)) return o; if (o.items && Array.isArray(o.items)) return o.items; return [o]
  }, [result])

  const ts = (t: Tab) => ({ color: tab === t ? 'var(--accent)' : 'var(--text-muted)', borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent' })

  return (
    <div className="w-[320px] flex flex-col border-l shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="text-xs font-medium">{def?.displayName || nodeType}</span>
        <div className="flex gap-1">
          <button onClick={handleTest} disabled={testing} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-white"
            style={{ background: testing ? 'var(--border)' : 'var(--accent)' }}>
            {testing ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />} 测试</button>
          <button onClick={onDelete} className="p-1 rounded hover:text-[var(--error)]" style={{ color: 'var(--text-muted)' }}><Trash2 size={12} /></button>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}><X size={14} /></button>
        </div>
      </div>
      <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
        {(['params', 'input', 'output'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className="flex-1 py-1.5 text-[10px] font-medium" style={ts(t)}>
            {t === 'params' ? '参数' : t === 'input' ? '输入' : '输出'}
            {t === 'output' && result?.output && <span className="ml-1 px-1 rounded-full text-[9px] bg-[var(--accent)] text-white">
              {Array.isArray(result.output?.items) ? result.output.items.length : 1}</span>}
          </button>))}
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3">
        {tab === 'params' && <>
          <div><label className="text-[10px] font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>节点名称</label>
            <input value={label} onChange={e => onUpdateLabel(e.target.value)} className="w-full px-2 py-1.5 rounded text-xs outline-none"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }} /></div>
          {params.map(p => {
            if (p.displayOptions?.show && !Object.entries(p.displayOptions.show).every(([k, v]: [string, any]) =>
              Array.isArray(v) ? v.includes(config[k]) : config[k] === v)) return null
            return (<div key={p.name}>
              <label className="text-[10px] font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>{p.displayName}</label>
              {p.description && <p className="text-[9px] mb-1" style={{ color: 'var(--text-muted)' }}>{p.description}</p>}
              <PInput param={p} value={config[p.name] ?? p.default ?? ''} onChange={v => onUpdateConfig({ ...config, [p.name]: v })} />
            </div>)})}
        </>}

        {tab === 'input' && <>
          {(upstreamNodes || []).map(u => (
            <div key={u.nodeId} className="mb-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[10px] font-semibold" style={{ color: 'var(--text)' }}>{u.nodeLabel}</span>
                <span className="text-[8px]" style={{ color: 'var(--text-muted)' }}>{u.data ? '实际数据' : '预测结构'}</span>
              </div>
              <div className="space-y-0.5">{(u.data
                ? Object.entries(typeof u.data === 'object' ? u.data : { value: u.data }).slice(0, 12)
                : u.schema.map((f: any) => [f.name, f.description])
              ).map(([key, val]: any) => {
                const expr = `{{ $input.${key} }}`
                const dv = u.data ? (typeof val === 'object' ? JSON.stringify(val).slice(0, 25) : String(val ?? '').slice(0, 25)) : String(val ?? '')
                return (
                  <button key={key} onClick={() => onFieldInsert ? onFieldInsert(expr) : (navigator.clipboard.writeText(expr), toast.success('已复制'))}
                    className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-left hover:bg-[var(--bg-hover)]" title={`点击插入：${expr}`}>
                    <span className="text-[10px] font-mono min-w-[60px]" style={{ color: 'var(--accent)' }}>{key}</span>
                    <span className="text-[9px] flex-1 truncate" style={{ color: 'var(--text-muted)' }}>{dv}</span>
                    <span className="text-[8px] shrink-0" style={{ color: 'var(--text-muted)' }}>{onFieldInsert ? '插入' : '复制'}</span>
                  </button>)})}</div>
            </div>
          ))}
          {(!upstreamNodes || !upstreamNodes.length) && <div className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>无上游连接</div>}
          <div className="mt-2 space-y-1.5">
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>测试数据</span>
            <textarea value={testInput} onChange={e => setTestInput(e.target.value)} rows={5}
              className="w-full px-2 py-1.5 rounded text-xs outline-none resize-y font-mono"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)', minHeight: 60 }} placeholder={'{\n  "text": "test"\n}'} />
          </div>
          <button onClick={handleTest} disabled={testing} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs text-white"
            style={{ background: testing ? 'var(--border)' : 'var(--accent)' }}>
            {testing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} 测试节点</button>
        </>}

        {tab === 'output' && (result ? <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-1.5 py-0.5 rounded text-white"
                style={{ background: result.status === 'completed' ? 'var(--success)' : 'var(--error)' }}>{result.status}</span>
              {result.duration > 0 && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{result.duration.toFixed(2)}s</span>}
            </div>
            <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <button onClick={() => setOutView('table')} className="px-2 py-0.5 text-[10px]"
                style={{ background: outView === 'table' ? 'var(--accent)' : 'var(--bg-surface)', color: outView === 'table' ? 'white' : 'var(--text-muted)' }}>
                <Table size={10} className="inline mr-0.5" />Table</button>
              <button onClick={() => setOutView('json')} className="px-2 py-0.5 text-[10px]"
                style={{ background: outView === 'json' ? 'var(--accent)' : 'var(--bg-surface)', color: outView === 'json' ? 'white' : 'var(--text-muted)' }}>
                <Braces size={10} className="inline mr-0.5" />JSON</button>
            </div>
          </div>
          {result.error && <div className="p-2 rounded text-[10px]" style={{ background: 'var(--error)', color: 'white' }}>{result.error}</div>}
          {outView === 'table' && outItems.length > 0 && (
            <div className="overflow-auto rounded" style={{ border: '1px solid var(--border)' }}>
              <table className="w-full text-[10px]"><thead><tr style={{ background: 'var(--bg-surface)' }}>
                <th className="px-2 py-1 text-left font-medium" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>#</th>
                {Object.keys(outItems[0] || {}).slice(0, 8).map(k => <th key={k} className="px-2 py-1 text-left font-medium"
                  style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{k}</th>)}
              </tr></thead><tbody>{outItems.slice(0, 50).map((it: any, i: number) => (
                <tr key={i} className="hover:bg-[var(--bg-hover)]">
                  <td className="px-2 py-1" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{i}</td>
                  {Object.keys(outItems[0] || {}).slice(0, 8).map(k => <td key={k} className="px-2 py-1 max-w-[100px] truncate"
                    style={{ color: 'var(--text)', borderBottom: '1px solid var(--border)' }} title={String(it[k] ?? '')}>
                    {typeof it[k] === 'object' ? JSON.stringify(it[k]).slice(0, 30) : String(it[k] ?? '')}</td>)}
                </tr>))}</tbody></table>
              {outItems.length > 50 && <div className="text-center py-1 text-[9px]" style={{ color: 'var(--text-muted)' }}>前50/{outItems.length}</div>}
            </div>)}
          {outView === 'json' && <JTree data={result.output} />}
        </> : <div className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)' }}>点击"测试"查看输出</div>)}
      </div>
    </div>
  )
}

function JTree({ data, depth = 0 }: { data: any; depth?: number }) {
  const [open, setOpen] = useState(depth < 2)
  if (data == null) return <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>null</span>
  if (typeof data !== 'object') {
    const c = typeof data === 'string' ? '#22c55e' : typeof data === 'number' ? '#3b82f6' : '#f59e0b'
    return <span className="text-[10px] font-mono" style={{ color: c }}>{JSON.stringify(data)}</span>
  }
  const entries = Array.isArray(data) ? data.map((v, i) => [String(i), v] as const) : Object.entries(data)
  const A = open ? ChevronDown : ChevronRight
  return (
    <div className="text-[10px]" style={{ paddingLeft: depth > 0 ? 12 : 0 }}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-0.5 hover:text-[var(--accent)]" style={{ color: 'var(--text-muted)' }}>
        <A size={10} /> {Array.isArray(data) ? `Array(${entries.length})` : `Object(${entries.length})`}</button>
      {open && <div className="border-l ml-1 pl-1" style={{ borderColor: 'var(--border)' }}>
        {entries.slice(0, 100).map(([k, v]) => <div key={k} className="flex items-start gap-1 py-0.5">
          <span className="font-mono shrink-0" style={{ color: 'var(--accent)' }}>{k}:</span><JTree data={v} depth={depth + 1} /></div>)}
        {entries.length > 100 && <span style={{ color: 'var(--text-muted)' }}>...({entries.length - 100} more)</span>}
      </div>}
    </div>)
}

function PInput({ param, value, onChange }: { param: any; value: any; onChange: (v: any) => void }) {
  const [fx, setFx] = useState(false)
  const st = { background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }
  if (fx) return (<div className="flex gap-1">
    <input type="text" value={typeof value === 'string' ? value : JSON.stringify(value)} onChange={e => onChange(e.target.value)}
      className="flex-1 px-2 py-1.5 rounded text-xs outline-none font-mono" style={{ ...st, borderColor: 'var(--accent)' }} placeholder="{{ $input.field }}" />
    <button onClick={() => setFx(false)} className="px-1 rounded text-[9px]" style={{ color: 'var(--accent)' }}>fx</button></div>)
  const fxBtn = ['string', 'number'].includes(param.type)
    ? <button onClick={() => setFx(true)} className="absolute right-1 top-1/2 -translate-y-1/2 px-1 rounded text-[9px] opacity-30 hover:opacity-100" style={{ color: 'var(--text-muted)' }}>fx</button>
    : null
  if (param.type === 'options' && param.options) return <select value={value} onChange={e => onChange(e.target.value)} className="w-full px-2 py-1.5 rounded text-xs outline-none" style={st}>
    {param.options.map((o: any) => <option key={o.value} value={o.value}>{o.name}</option>)}</select>
  if (param.type === 'boolean') return <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} />{value ? '是' : '否'}</label>
  if (param.type === 'number') return <div className="relative"><input type="number" value={value} onChange={e => onChange(Number(e.target.value))} className="w-full px-2 py-1.5 rounded text-xs outline-none" style={st} />{fxBtn}</div>
  if (['code', 'json', 'filter'].includes(param.type)) return <textarea value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
    onChange={e => onChange(e.target.value)} rows={param.type === 'code' ? 8 : 4} className="w-full px-2 py-1.5 rounded text-xs outline-none resize-y font-mono" style={{ ...st, minHeight: 60 }} />
  return <div className="relative"><input type="text" value={value} onChange={e => onChange(e.target.value)} className="w-full px-2 py-1.5 rounded text-xs outline-none pr-6" style={st} placeholder={param.default || ''} />{fxBtn}</div>
}
