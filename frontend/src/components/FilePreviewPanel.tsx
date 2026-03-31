import { useState, useEffect } from 'react'
import { X, Copy, Download, Check, Loader2 } from 'lucide-react'
import client from '../api/client'
import Markdown from './Markdown'
import toast from 'react-hot-toast'

interface Props { file: { path: string; filename: string; format?: string; size?: number } | null; onClose: () => void }

const FI: Record<string, { icon: string; color: string }> = {
  docx: { icon: '📄', color: '#2b579a' }, pdf: { icon: '📕', color: '#d32f2f' }, xlsx: { icon: '📗', color: '#217346' },
  xls: { icon: '📗', color: '#217346' }, pptx: { icon: '📙', color: '#d24726' }, csv: { icon: '📊', color: '#22c55e' },
  md: { icon: '📝', color: '#6366f1' }, txt: { icon: '📃', color: '#6b7280' }, png: { icon: '🖼️', color: '#8b5cf6' }, jpg: { icon: '🖼️', color: '#8b5cf6' },
}

export default function FilePreviewPanel({ file, onClose }: Props) {
  const [data, setData] = useState<any>(null); const [loading, setLoading] = useState(false); const [copied, setCopied] = useState(false)
  const fmt = (file?.format || file?.filename?.split('.').pop() || '').toLowerCase()
  const fi = FI[fmt] || { icon: '📎', color: 'var(--accent)' }
  const size = file?.size || 0
  const sizeStr = size > 1048576 ? `${(size / 1048576).toFixed(1)} MB` : size > 1024 ? `${(size / 1024).toFixed(1)} KB` : size ? `${size} B` : ''

  useEffect(() => { if (!file?.path) return; setLoading(true); setData(null)
    client.get(`/files/preview/${file.path}`).then((r: any) => setData(r)).catch(() => setData({ type: 'text', content: '预览加载失败' })).finally(() => setLoading(false))
  }, [file?.path])

  const getCopyText = () => { if (!data) return ''; if (data.content) return data.content
    if (data.type === 'table' && data.data?.sheets) return data.data.sheets.map((s: any) => s.rows.map((r: any) => r.join('\t')).join('\n')).join('\n\n')
    if (data.type === 'slides' && data.data?.slides) return data.data.slides.map((s: any) => `${s.title}\n${s.content.join('\n')}`).join('\n\n'); return '' }

  const copy = async () => { const t = getCopyText(); if (!t) return; await navigator.clipboard.writeText(t); setCopied(true); toast.success('已复制'); setTimeout(() => setCopied(false), 2000) }
  const dl = () => { if (!file?.path) return; const tk = localStorage.getItem('agentforge_token') || ''
    fetch(`/api/v1/files/download/${file.path}`, { headers: { Authorization: `Bearer ${tk}` } }).then(r => r.blob()).then(b => { const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = file.filename; a.click(); URL.revokeObjectURL(u) }).catch(() => toast.error('下载失败')) }

  if (!file) return null
  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)', borderLeft: '1px solid var(--border)' }}>
      <div className="flex items-center gap-3 px-4 py-3 shrink-0 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <span className="text-lg">{fi.icon}</span>
        <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{file.filename}</div>
          <div className="text-[10px] flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: `${fi.color}15`, color: fi.color }}>{fmt.toUpperCase()}</span>
            {sizeStr && <span>{sizeStr}</span>}</div></div>
        <button onClick={copy} disabled={loading} className="p-2 rounded-lg hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}>{copied ? <Check size={16} style={{ color: '#22c55e' }} /> : <Copy size={16} />}</button>
        <button onClick={dl} className="p-2 rounded-lg hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}><Download size={16} /></button>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-auto">
        {loading ? <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent)' }} /></div>
         : data?.type === 'table' ? <TableView data={data.data} />
         : data?.type === 'slides' ? <SlidesView data={data.data} />
         : data?.type === 'html' ? <HtmlView content={data.content || ''} />
         : data?.type === 'image' ? <ImageView url={data.data?.url} name={file.filename} />
         : data?.type === 'markdown' ? <div className="px-6 py-4"><Markdown content={data.content || ''} /></div>
         : data?.type === 'richtext' ? <RichView content={data.content || ''} />
         : <pre className="px-6 py-4 text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)', fontFamily: 'monospace', margin: 0 }}>{data?.content || '(无内容)'}</pre>}
      </div>
    </div>
  )
}

function TableView({ data }: { data: any }) {
  const [si, setSi] = useState(0); const sheets = data?.sheets || []
  if (data?.error) return <div className="p-6 text-sm" style={{ color: '#ef4444' }}>{data.error}</div>
  if (!sheets.length) return <div className="p-6 text-sm" style={{ color: 'var(--text-muted)' }}>空表格</div>
  const s = sheets[si]
  return (<div className="flex flex-col h-full">
    {sheets.length > 1 && <div className="flex gap-1 px-4 py-2 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
      {sheets.map((sh: any, i: number) => <button key={i} onClick={() => setSi(i)} className="px-3 py-1 rounded text-xs"
        style={{ background: i === si ? 'var(--accent)' : 'var(--bg-surface)', color: i === si ? 'white' : 'var(--text-muted)' }}>{sh.name}</button>)}</div>}
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0" style={{ background: 'var(--bg-surface)' }}>
          {s.rows[0] && <tr><th className="px-3 py-2 text-left text-[10px] border-b w-[40px]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>#</th>
            {s.rows[0].map((c: string, j: number) => <th key={j} className="px-3 py-2 text-left font-medium border-b whitespace-nowrap"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>{c || '—'}</th>)}</tr>}</thead>
        <tbody>{s.rows.slice(1).map((row: string[], i: number) => <tr key={i} className="hover:bg-[var(--bg-hover)]" style={{ background: i % 2 ? 'var(--bg)' : 'transparent' }}>
          <td className="px-3 py-1.5 border-b text-[10px]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>{i + 2}</td>
          {row.map((c: string, j: number) => <td key={j} className="px-3 py-1.5 border-b whitespace-nowrap max-w-[250px] truncate"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>{c || '—'}</td>)}</tr>)}</tbody>
      </table>
      {s.total_rows > 200 && <div className="px-4 py-2 text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>显示前 200 行 / 共 {s.total_rows} 行</div>}
    </div>
  </div>)
}

function SlidesView({ data }: { data: any }) {
  const [idx, setIdx] = useState(0)
  const slides: any[] = data?.slides || []
  const total = data?.total || slides.length
  const slideW = data?.width || 960
  const slideH = data?.height || 540
  if (data?.error) return <div className="p-6 text-sm" style={{ color: '#ef4444' }}>预览失败: {data.error}</div>
  if (!slides.length) return <div className="p-6 text-sm" style={{ color: 'var(--text-muted)' }}>空演示文稿</div>
  const s = slides[idx]
  return (<div className="flex flex-col h-full">
    <div className="flex-1 flex items-center justify-center p-4 overflow-auto" style={{ background: '#2c2c2c' }}>
      <div style={{ width: '100%', maxWidth: 720, aspectRatio: `${slideW} / ${slideH}`,
        background: s.background || '#fff', position: 'relative', overflow: 'hidden',
        borderRadius: 4, boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
        {(s.shapes || []).map((shape: any, si: number) => {
          const st: React.CSSProperties = { position: 'absolute',
            left: `${(shape.left / slideW) * 100}%`, top: `${(shape.top / slideH) * 100}%`,
            width: `${(shape.width / slideW) * 100}%`, height: `${(shape.height / slideH) * 100}%`,
            overflow: 'hidden', padding: '2%', boxSizing: 'border-box' }
          if (shape.type === 'text') return (
            <div key={si} style={st}>{(shape.paragraphs || []).map((p: any, pi: number) => {
              if (p.type === 'empty') return <div key={pi} style={{ height: '0.5em' }} />
              const sz = Math.max(8, Math.round((p.fontSize || 18) * (720 / slideW)))
              return <div key={pi} style={{ fontSize: sz, fontWeight: p.bold ? 700 : 400,
                color: p.color || (shape.isTitle ? '#1a1a2e' : '#333'),
                textAlign: p.align || (shape.isTitle ? 'center' : 'left'),
                paddingLeft: p.level ? p.level * 20 : 0, lineHeight: 1.4, marginBottom: 2 }}>
                {p.level ? '• ' : ''}{p.text}</div>
            })}</div>)
          if (shape.type === 'table') return (
            <div key={si} style={{ ...st, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}><tbody>
                {(shape.rows || []).map((row: any[], ri: number) => <tr key={ri}>
                  {row.map((c: string, ci: number) => <td key={ci} style={{ border: '1px solid #ccc',
                    padding: '2px 4px', background: ri === 0 ? '#e8e8e8' : '#fff',
                    fontWeight: ri === 0 ? 600 : 400, color: '#333' }}>{c}</td>)}
                </tr>)}</tbody></table></div>)
          if (shape.type === 'image' && shape.src) return (
            <div key={si} style={st}><img src={shape.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>)
          return null
        })}
      </div>
    </div>
    {slides.length > 1 && <div className="flex gap-1.5 px-4 py-2 overflow-x-auto" style={{ background: 'var(--bg)' }}>
      {slides.map((t: any, ti: number) => <button key={ti} onClick={() => setIdx(ti)} className="shrink-0"
        style={{ width: 56, height: 32, background: t.background || '#fff', borderRadius: 3,
          border: ti === idx ? '2px solid var(--accent)' : '1px solid var(--border)', opacity: ti === idx ? 1 : 0.6 }}>
        <span style={{ fontSize: 6, color: '#666', display: 'block', textAlign: 'center', marginTop: 4 }}>{ti + 1}</span>
      </button>)}</div>}
    <div className="flex items-center justify-center gap-4 px-4 py-2 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
      <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0} className="px-3 py-1 rounded text-xs disabled:opacity-30 hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}>◀</button>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{idx + 1} / {total}</span>
      <button onClick={() => setIdx(Math.min(slides.length - 1, idx + 1))} disabled={idx >= slides.length - 1} className="px-3 py-1 rounded text-xs disabled:opacity-30 hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}>▶</button>
    </div>
  </div>)
}

function ImageView({ url, name }: { url: string; name: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => { const tk = localStorage.getItem('agentforge_token') || ''
    fetch(url, { headers: { Authorization: `Bearer ${tk}` } }).then(r => r.blob()).then(b => setSrc(URL.createObjectURL(b))).catch(() => {})
    return () => { if (src) URL.revokeObjectURL(src) }
  }, [url])
  return <div className="flex items-center justify-center h-full p-6">
    {src ? <img src={src} alt={name} className="max-w-full max-h-full object-contain rounded-lg" /> : <Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent)' }} />}
  </div>
}

function HtmlView({ content }: { content: string }) {
  const [mode, setMode] = useState<'preview' | 'code'>('preview')
  const [cp, setCp] = useState(false)
  const wrapped = content.includes('<html') || content.includes('<!DOCTYPE')
    ? content
    : `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:16px;font-family:-apple-system,sans-serif}</style></head><body>${content}</body></html>`
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-3 py-1.5 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div className="flex rounded-md overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <button onClick={() => setMode('preview')} className="px-2.5 py-1 text-[11px]"
            style={{ background: mode === 'preview' ? 'var(--accent)' : 'transparent', color: mode === 'preview' ? '#fff' : 'var(--text-muted)' }}>预览</button>
          <button onClick={() => setMode('code')} className="px-2.5 py-1 text-[11px]"
            style={{ background: mode === 'code' ? 'var(--accent)' : 'transparent', color: mode === 'code' ? '#fff' : 'var(--text-muted)', borderLeft: '1px solid var(--border)' }}>源码</button>
        </div>
        <div className="flex-1" />
        <button onClick={async () => { await navigator.clipboard.writeText(content); setCp(true); toast.success('已复制'); setTimeout(() => setCp(false), 2000) }}
          className="p-1.5 rounded-md hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}>
          {cp ? <Check size={14} style={{ color: '#22c55e' }} /> : <Copy size={14} />}
        </button>
        <button onClick={() => { const b = new Blob([wrapped], { type: 'text/html' }); const u = URL.createObjectURL(b); window.open(u, '_blank'); setTimeout(() => URL.revokeObjectURL(u), 5000) }}
          className="p-1.5 rounded-md hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }} title="新标签打开">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </button>
      </div>
      {mode === 'preview'
        ? <iframe srcDoc={wrapped} sandbox="allow-scripts allow-same-origin" className="flex-1 w-full border-0" style={{ background: '#fff', minHeight: 300 }} title="HTML 预览" />
        : <pre className="flex-1 overflow-auto px-4 py-3 text-xs leading-relaxed" style={{ color: 'var(--text)', background: 'var(--bg)', fontFamily: 'monospace', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{content}</pre>}
    </div>
  )
}

function RichView({ content }: { content: string }) {
  return (<div className="px-6 py-4 space-y-1">{content.split('\n').map((line, i) => {
    const t = line.trim()
    if (!t) return <div key={i} className="h-2" />
    if (t.startsWith('# ')) return <h1 key={i} className="text-lg font-bold mt-4 mb-2" style={{ color: 'var(--text)' }}>{t.slice(2)}</h1>
    if (t.startsWith('## ')) return <h2 key={i} className="text-base font-bold mt-3 mb-1.5" style={{ color: 'var(--text)' }}>{t.slice(3)}</h2>
    if (t.startsWith('### ')) return <h3 key={i} className="text-sm font-bold mt-2 mb-1" style={{ color: 'var(--text)' }}>{t.slice(4)}</h3>
    if (t.length < 30 && !/[，。！？、；：]/.test(t)) return <div key={i} className="text-sm font-semibold mt-3 mb-1" style={{ color: 'var(--text)' }}>{t}</div>
    if (/^[-•·*]\s/.test(t) || /^\d+[.、)]\s/.test(t)) return <div key={i} className="text-sm pl-4 py-0.5" style={{ color: 'var(--text)' }}>{t}</div>
    return <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{t}</p>
  })}</div>)
}
