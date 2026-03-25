import { useState, useEffect, useMemo } from 'react'
import { X, Play, Loader2, ChevronRight, ChevronDown, Plus, Trash2, HelpCircle } from 'lucide-react'
import type { Node } from '@xyflow/react'
import type { NodeTypeDef } from '../../api/workflow'
import { testNode } from '../../api/workflow'
import toast from 'react-hot-toast'

interface Props { node: Node; catalog: NodeTypeDef[]; execData?: any; upstreamOutput?: any
  onUpdateConfig: (c: any) => void; onUpdateLabel: (l: string) => void; onClose: () => void }

const PH: Record<string, string> = {
  url: 'https://api.example.com/data', webhookUrl: 'https://open.feishu.cn/open-apis/bot/v2/hook/xxx',
  prompt: '请分析以下数据：\n{{ $input.text }}', instruction: '用中文回答，200字以内', content: '{{ $input.ai_result }}',
  message: '执行完成：{{ $input.summary }}', to: 'user@example.com', subject: '{{ $input.title }} - 通知',
  body: '{"key": "{{ $input.value }}"}', headers: '{"Authorization": "Bearer xxx"}',
  query: 'SELECT * FROM table WHERE status = "active"', categories: '积极, 消极, 中性',
  code: '# input_data, variables, items\nresult = {"count": len(items) if isinstance(items, list) else 0}',
  extractionSchema: '{"name": "姓名", "phone": "电话"}', routeDescriptions: '客服, 技术, 投诉',
  expression: '$input.score > 60', routeField: 'category', routeValues: 'A, B, C', key: 'cache_key',
  items: '[{"name": "张三", "score": 85}]', mappings: '{"姓名": "{{ $input.name }}"}', filter: '$input.score > 60',
  connection: 'data/memories.db', path: 'data/outputs/report.xlsx',
}

export default function NodeEditModal({ node, catalog, execData, upstreamOutput, onUpdateConfig, onUpdateLabel, onClose }: Props) {
  const { label, nodeType, config } = node.data as any
  const def = catalog.find(c => c.name === nodeType); const params = def?.parameters || []
  const [testing, setTesting] = useState(false); const [result, setResult] = useState<any>(execData || null)
  const [testInput, setTestInput] = useState(''); const [outView, setOutView] = useState<'table' | 'json'>('json')
  const [rTab, setRTab] = useState<'input' | 'output'>(execData ? 'output' : 'input')

  useEffect(() => { if (upstreamOutput) setTestInput(JSON.stringify(upstreamOutput, null, 2)) }, [upstreamOutput])
  useEffect(() => { if (execData?.output) { setResult(execData); setRTab('output') } }, [execData])
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [onClose])

  const handleTest = async () => { setTesting(true); setResult(null); try { let inp = {}; try { inp = JSON.parse(testInput) } catch {}
    const r = await testNode(nodeType, config, inp); setResult(r); setRTab('output')
    r.status === 'completed' ? toast.success('测试成功') : toast.error(`失败: ${r.error}`)
  } catch { toast.error('测试失败') } finally { setTesting(false) } }

  const outItems = useMemo(() => { const o = result?.output; if (!o) return []; if (Array.isArray(o)) return o; if (o.items && Array.isArray(o.items)) return o.items; return [o] }, [result])
  const up = (n: string, v: any) => onUpdateConfig({ ...config, [n]: v })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-[90vw] h-[85vh] max-w-[1200px] rounded-2xl overflow-hidden flex flex-col" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ background: 'var(--accent)' }}>{(def?.displayName || '?')[0]}</div>
            <div><input value={label} onChange={e => onUpdateLabel(e.target.value)} className="text-sm font-bold bg-transparent outline-none" style={{ color: 'var(--text)', width: 300 }} />
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{def?.description}</div></div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleTest} disabled={testing} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs text-white font-medium"
              style={{ background: testing ? 'var(--border)' : 'var(--accent)' }}>
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} 测试</button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
          </div>
        </div>
        {/* Body */}
        <div className="flex-1 flex min-h-0">
          {/* Left: params */}
          <div className="flex-1 overflow-auto p-5 space-y-4 border-r" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>参数配置</h3>
            {params.map(p => { if (p.displayOptions?.show && !Object.entries(p.displayOptions.show).every(([k, v]: [string, any]) => Array.isArray(v) ? v.includes(config[k]) : config[k] === v)) return null
              return (<div key={p.name} className="space-y-1.5">
                <div className="flex items-center gap-1.5"><label className="text-xs font-medium" style={{ color: 'var(--text)' }}>{p.displayName}</label>
                  {p.description && <span className="group relative"><HelpCircle size={12} style={{ color: 'var(--text-muted)' }} className="cursor-help" />
                    <span className="absolute left-5 top-0 hidden group-hover:block z-10 px-2 py-1 rounded text-[10px] max-w-[250px]"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>{p.description}</span></span>}
                </div>
                <RPI param={p} value={config[p.name] ?? p.default ?? ''} onChange={v => up(p.name, v)} />
              </div>)})}
            {!params.length && <div className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)' }}>无需配置</div>}
          </div>
          {/* Right: input/output */}
          <div className="w-[45%] flex flex-col min-h-0">
            <div className="flex border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
              {(['input', 'output'] as const).map(t => <button key={t} onClick={() => setRTab(t)} className="flex-1 py-2.5 text-xs font-medium"
                style={{ color: rTab === t ? 'var(--accent)' : 'var(--text-muted)', borderBottom: rTab === t ? '2px solid var(--accent)' : '2px solid transparent' }}>
                {t === 'input' ? '输入' : '输出'}{t === 'output' && result?.output && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] text-white" style={{ background: 'var(--accent)' }}>{outItems.length}</span>}
              </button>)}
            </div>
            <div className="flex-1 overflow-auto p-4">
              {rTab === 'input' && <div className="space-y-3">
                {upstreamOutput && <><div className="flex items-center justify-between"><span className="text-xs font-medium" style={{ color: 'var(--text)' }}>上游输出</span>
                  <button onClick={() => setTestInput(JSON.stringify(upstreamOutput, null, 2))} className="text-[10px] px-2 py-0.5 rounded" style={{ color: 'var(--accent)', border: '1px solid var(--accent)' }}>复制为输入</button></div>
                  <JT data={upstreamOutput} /><div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="text-xs font-medium mb-2" style={{ color: 'var(--text)' }}>可用字段</div>
                    <FL data={upstreamOutput} /></div></>}
                <div className={upstreamOutput ? 'border-t pt-3' : ''} style={{ borderColor: 'var(--border)' }}>
                  <div className="text-xs font-medium mb-2" style={{ color: 'var(--text)' }}>测试输入</div>
                  <textarea value={testInput} onChange={e => setTestInput(e.target.value)} rows={8} placeholder='{"key": "value"}'
                    className="w-full px-3 py-2 rounded-lg text-xs font-mono outline-none resize-y" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)', minHeight: 80 }} />
                </div></div>}
              {rTab === 'output' && (result ? <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><span className="text-[10px] px-2 py-0.5 rounded text-white" style={{ background: result.status === 'completed' ? 'var(--success)' : 'var(--error)' }}>{result.status === 'completed' ? '成功' : '失败'}</span>
                    {result.duration > 0 && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{result.duration.toFixed(2)}s</span>}</div>
                  <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    {(['table', 'json'] as const).map(v => <button key={v} onClick={() => setOutView(v)} className="px-2.5 py-1 text-[10px]"
                      style={{ background: outView === v ? 'var(--accent)' : 'var(--bg-surface)', color: outView === v ? 'white' : 'var(--text-muted)' }}>{v === 'table' ? 'Table' : 'JSON'}</button>)}</div>
                </div>
                {result.error && <div className="p-2 rounded text-xs" style={{ background: '#fef2f2', color: 'var(--error)' }}>⚠️ {result.error}</div>}
                {outView === 'table' && outItems.length > 0 && <DT items={outItems} />}
                {outView === 'json' && <JT data={result.output} />}
              </div> : <div className="text-center py-12 text-xs" style={{ color: 'var(--text-muted)' }}>点击"测试"查看输出</div>)}
            </div>
          </div>
        </div>
      </div>
    </div>)
}

function DT({ items }: { items: any[] }) {
  if (!items.length) return null; const hd = Object.keys(items[0] || {}).slice(0, 10)
  return (<div className="overflow-auto rounded-lg" style={{ border: '1px solid var(--border)' }}><table className="w-full text-[11px]"><thead><tr style={{ background: 'var(--bg-surface)' }}>
    <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>#</th>
    {hd.map(h => <th key={h} className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>)}
  </tr></thead><tbody>{items.slice(0, 50).map((it, i) => <tr key={i} className="hover:bg-[var(--bg-hover)]">
    <td className="px-3 py-1.5" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{i}</td>
    {hd.map(h => <td key={h} className="px-3 py-1.5 max-w-[160px] truncate" style={{ color: 'var(--text)', borderBottom: '1px solid var(--border)' }} title={String(it[h] ?? '')}>
      {typeof it[h] === 'object' ? JSON.stringify(it[h]).slice(0, 50) : String(it[h] ?? '')}</td>)}</tr>)}</tbody></table></div>)
}

function JT({ data, depth = 0 }: { data: any; depth?: number }) {
  const [open, setOpen] = useState(depth < 2)
  if (data == null) return <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>null</span>
  if (typeof data !== 'object') return <span className="text-[11px] font-mono" style={{ color: typeof data === 'string' ? '#22c55e' : typeof data === 'number' ? '#3b82f6' : '#f59e0b' }}>{JSON.stringify(data)}</span>
  const ent = Array.isArray(data) ? data.map((v, i) => [String(i), v]) : Object.entries(data)
  return (<div style={{ paddingLeft: depth > 0 ? 14 : 0 }}>
    <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-[11px] hover:text-[var(--accent)]" style={{ color: 'var(--text-muted)' }}>
      {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}{Array.isArray(data) ? `Array[${ent.length}]` : `Object{${ent.length}}`}</button>
    {open && <div className="border-l ml-1.5 pl-2 mt-0.5 space-y-0.5" style={{ borderColor: 'var(--border)' }}>
      {ent.slice(0, 100).map(([k, v]) => <div key={k} className="flex items-start gap-1.5"><span className="text-[11px] font-mono shrink-0" style={{ color: 'var(--accent)' }}>{k}:</span><JT data={v} depth={depth + 1} /></div>)}</div>}</div>)
}

function FL({ data }: { data: any }) {
  const fields = Array.isArray(data) ? (data[0] && typeof data[0] === 'object' ? Object.keys(data[0]) : []) : (typeof data === 'object' ? Object.keys(data) : [])
  return <div className="flex flex-wrap gap-1.5">{fields.map(f => <button key={f} onClick={() => { navigator.clipboard.writeText(`{{ $input.${f} }}`); toast.success(`已复制`) }}
    className="px-2 py-1 rounded text-[10px] font-mono hover:bg-[var(--accent)] hover:text-white" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--accent)' }}>{f}</button>)}</div>
}

function RPI({ param, value, onChange }: { param: any; value: any; onChange: (v: any) => void }) {
  const [fx, setFx] = useState(false)
  const st = { background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }
  if (fx) return <div className="flex gap-1"><input type="text" value={typeof value === 'string' ? value : JSON.stringify(value)} onChange={e => onChange(e.target.value)}
    className="flex-1 px-3 py-2 rounded-lg text-xs font-mono outline-none" style={{ ...st, borderColor: 'var(--accent)' }} placeholder="{{ $input.field }}" />
    <button onClick={() => setFx(false)} className="px-2 rounded-lg text-[10px] font-bold" style={{ color: 'var(--accent)', border: '1px solid var(--accent)' }}>fx</button></div>
  if (param.type === 'options' && param.options) return <select value={value} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={st}>
    {param.options.map((o: any) => <option key={o.value} value={o.value}>{o.name}</option>)}</select>
  if (param.type === 'boolean') return <button onClick={() => onChange(!value)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs w-full text-left" style={{ ...st, borderColor: value ? 'var(--accent)' : 'var(--border)' }}>
    <div className={`w-8 h-4 rounded-full relative ${value ? 'bg-[var(--accent)]' : 'bg-gray-400'}`}><div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow ${value ? 'translate-x-4' : 'translate-x-0.5'}`} /></div>{value ? '是' : '否'}</button>
  if (param.type === 'number') return <div className="flex gap-1"><input type="number" value={value} onChange={e => onChange(Number(e.target.value))} className="flex-1 px-3 py-2 rounded-lg text-xs outline-none" style={st} placeholder={PH[param.name]} />
    <button onClick={() => setFx(true)} className="px-2 rounded-lg text-[10px] opacity-40 hover:opacity-100" style={{ color: 'var(--text-muted)' }}>fx</button></div>
  if (param.type === 'code') return <textarea value={value} onChange={e => onChange(e.target.value)} rows={10} className="w-full px-3 py-2 rounded-lg text-xs font-mono outline-none resize-y leading-relaxed" style={{ ...st, minHeight: 120 }} placeholder={PH[param.name] || ''} />
  if (param.type === 'json') return <KVE value={value} onChange={onChange} ph={PH[param.name] || '{}'} />
  if (param.type === 'filter') return <CB value={value} onChange={onChange} />
  const ml = ['prompt', 'content', 'body', 'message', 'instruction', 'query', 'text'].includes(param.name)
  if (ml) return <div className="relative"><textarea value={value} onChange={e => onChange(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-y" style={{ ...st, minHeight: 60 }} placeholder={PH[param.name] || ''} />
    <button onClick={() => setFx(true)} className="absolute right-2 top-2 px-1.5 py-0.5 rounded text-[9px] opacity-30 hover:opacity-100" style={{ color: 'var(--text-muted)', background: 'var(--bg)' }}>fx</button></div>
  return <div className="flex gap-1"><input type="text" value={value} onChange={e => onChange(e.target.value)} className="flex-1 px-3 py-2 rounded-lg text-xs outline-none" style={st} placeholder={PH[param.name] || ''} />
    <button onClick={() => setFx(true)} className="px-2 rounded-lg text-[10px] opacity-40 hover:opacity-100" style={{ color: 'var(--text-muted)' }}>fx</button></div>
}

function KVE({ value, onChange, ph }: { value: any; onChange: (v: any) => void; ph: string }) {
  const [raw, setRaw] = useState(false)
  let pairs: [string, string][] = []
  try { const o = typeof value === 'string' ? JSON.parse(value || '{}') : (value || {}); if (typeof o === 'object' && !Array.isArray(o)) pairs = Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]) } catch {}
  const upd = (p: [string, string][]) => { const o: Record<string, string> = {}; for (const [k, v] of p) if (k.trim()) o[k.trim()] = v; onChange(JSON.stringify(o)) }
  const st = { background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }
  if (raw) return <div><div className="flex justify-end mb-1"><button onClick={() => setRaw(false)} className="text-[9px]" style={{ color: 'var(--accent)' }}>可视化</button></div>
    <textarea value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)} onChange={e => onChange(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg text-xs font-mono outline-none resize-y" style={{ ...st, minHeight: 60 }} placeholder={ph} /></div>
  return <div><div className="flex justify-end mb-1"><button onClick={() => setRaw(true)} className="text-[9px]" style={{ color: 'var(--text-muted)' }}>JSON</button></div>
    <div className="space-y-1.5">{pairs.map(([k, v], i) => <div key={i} className="flex gap-1.5">
      <input value={k} onChange={e => { const n = [...pairs]; n[i] = [e.target.value, v]; upd(n) }} placeholder="键" className="w-[35%] px-2 py-1.5 rounded text-xs outline-none" style={st} />
      <input value={v} onChange={e => { const n = [...pairs]; n[i] = [k, e.target.value]; upd(n) }} placeholder="值" className="flex-1 px-2 py-1.5 rounded text-xs outline-none" style={st} />
      <button onClick={() => upd(pairs.filter((_, j) => j !== i))} className="p-1 rounded hover:text-[var(--error)]" style={{ color: 'var(--text-muted)' }}><Trash2 size={12} /></button></div>)}
      <button onClick={() => upd([...pairs, ['', '']])} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] hover:bg-[var(--bg-hover)]" style={{ color: 'var(--accent)' }}><Plus size={10} /> 添加</button></div></div>
}

function CB({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  let p: { combineMode: string; rules: any[] } = { combineMode: 'AND', rules: [] }
  try { p = typeof value === 'string' ? JSON.parse(value || '{}') : (value || {}); if (!p.rules) p = { combineMode: 'AND', rules: [] } } catch {}
  const u = (n: typeof p) => onChange(JSON.stringify(n))
  const ops = [['等于', 'equals'], ['不等于', 'not_equals'], ['大于', 'gt'], ['≥', 'gte'], ['小于', 'lt'], ['≤', 'lte'], ['包含', 'contains'], ['为空', 'is_empty'], ['非空', 'is_not_empty']]
  const st = { background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }
  return <div className="space-y-2">
    <div className="flex items-center gap-2"><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>满足</span>
      <select value={p.combineMode} onChange={e => u({ ...p, combineMode: e.target.value })} className="px-2 py-1 rounded text-xs outline-none" style={st}>
        <option value="AND">所有 (AND)</option><option value="OR">任一 (OR)</option></select></div>
    {p.rules.map((r: any, i: number) => <div key={i} className="flex gap-1.5 items-center">
      <input value={r.field || ''} onChange={e => { const n = [...p.rules]; n[i] = { ...r, field: e.target.value }; u({ ...p, rules: n }) }} placeholder="字段" className="w-[30%] px-2 py-1.5 rounded text-xs outline-none" style={st} />
      <select value={r.operator || 'equals'} onChange={e => { const n = [...p.rules]; n[i] = { ...r, operator: e.target.value }; u({ ...p, rules: n }) }} className="w-[25%] px-2 py-1.5 rounded text-xs outline-none" style={st}>
        {ops.map(([n, v]) => <option key={v} value={v}>{n}</option>)}</select>
      <input value={r.value || ''} onChange={e => { const n = [...p.rules]; n[i] = { ...r, value: e.target.value }; u({ ...p, rules: n }) }} placeholder="值" className="flex-1 px-2 py-1.5 rounded text-xs outline-none" style={st} />
      <button onClick={() => u({ ...p, rules: p.rules.filter((_: any, j: number) => j !== i) })} className="p-1 rounded hover:text-[var(--error)]" style={{ color: 'var(--text-muted)' }}><Trash2 size={12} /></button></div>)}
    <button onClick={() => u({ ...p, rules: [...p.rules, { field: '', operator: 'equals', value: '' }] })} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] hover:bg-[var(--bg-hover)]" style={{ color: 'var(--accent)' }}><Plus size={10} /> 添加条件</button>
  </div>
}
