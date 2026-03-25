import { useState } from 'react'
import { X, Trash2, Play, Loader2 } from 'lucide-react'
import type { Node } from '@xyflow/react'
import type { NodeTypeDef } from '../../api/workflow'
import { testNode } from '../../api/workflow'
import toast from 'react-hot-toast'

interface Props {
  node: Node; catalog: NodeTypeDef[]
  onUpdateConfig: (c: any) => void; onUpdateLabel: (l: string) => void
  onDelete: () => void; onClose: () => void
}

export default function PropertyPanel({ node, catalog, onUpdateConfig, onUpdateLabel, onDelete, onClose }: Props) {
  const { label, nodeType, config } = node.data as any
  const def = catalog.find(c => c.name === nodeType)
  const params = def?.parameters || []
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<any>(null)

  const update = (name: string, value: any) => onUpdateConfig({ ...config, [name]: value })

  const handleTest = async () => {
    setTesting(true); setResult(null)
    try { const r = await testNode(nodeType, config, {}); setResult(r)
      r.status === 'completed' ? toast.success('测试成功') : toast.error(`失败: ${r.error}`)
    } catch { toast.error('测试失败') } finally { setTesting(false) }
  }

  return (
    <div className="w-[300px] flex flex-col border-l shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="text-xs font-medium">{def?.displayName || nodeType}</span>
        <div className="flex gap-1">
          <button onClick={onDelete} className="p-1 rounded hover:text-[var(--error)]" style={{ color: 'var(--text-muted)' }}><Trash2 size={12} /></button>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}><X size={14} /></button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-3">
        <div>
          <label className="text-[10px] font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>节点名称</label>
          <input value={label} onChange={e => onUpdateLabel(e.target.value)}
            className="w-full px-2 py-1.5 rounded text-xs outline-none"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        </div>
        {params.map(p => (
          <div key={p.name}>
            <label className="text-[10px] font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>{p.displayName}</label>
            {p.description && <p className="text-[9px] mb-1" style={{ color: 'var(--text-muted)' }}>{p.description}</p>}
            <PInput param={p} value={config[p.name] ?? p.default ?? ''} onChange={v => update(p.name, v)} />
          </div>))}
        {def && !nodeType.includes('Trigger') && (
          <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <button onClick={handleTest} disabled={testing} className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white"
              style={{ background: testing ? 'var(--border)' : 'var(--accent)' }}>
              {testing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} 测试</button>
            {result && <pre className="mt-2 p-2 rounded text-[10px] overflow-auto max-h-[200px]"
              style={{ background: 'var(--bg-surface)', color: result.status === 'completed' ? 'var(--success)' : 'var(--error)' }}>
              {JSON.stringify(result, null, 2)}</pre>}
          </div>)}
      </div>
    </div>
  )
}

function PInput({ param, value, onChange }: { param: any; value: any; onChange: (v: any) => void }) {
  const st = { background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }
  if (param.type === 'options' && param.options)
    return <select value={value} onChange={e => onChange(e.target.value)} className="w-full px-2 py-1.5 rounded text-xs outline-none" style={st}>
      {param.options.map((o: any) => <option key={o.value} value={o.value}>{o.name}</option>)}</select>
  if (param.type === 'boolean')
    return <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} />{value ? '是' : '否'}</label>
  if (param.type === 'number')
    return <input type="number" value={value} onChange={e => onChange(Number(e.target.value))} className="w-full px-2 py-1.5 rounded text-xs outline-none" style={st} />
  if (['code', 'json', 'filter'].includes(param.type))
    return <textarea value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)} onChange={e => onChange(e.target.value)}
      rows={param.type === 'code' ? 8 : 4} className="w-full px-2 py-1.5 rounded text-xs outline-none resize-y font-mono" style={{ ...st, minHeight: 60 }} />
  return <input type="text" value={value} onChange={e => onChange(e.target.value)} className="w-full px-2 py-1.5 rounded text-xs outline-none" style={st} placeholder={param.default || ''} />
}
