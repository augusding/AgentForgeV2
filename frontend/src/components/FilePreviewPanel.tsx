import { useState, useEffect } from 'react'
import { X, Copy, Download, Check, Loader2 } from 'lucide-react'
import client from '../api/client'
import toast from 'react-hot-toast'

interface Props {
  file: { path: string; filename: string; format?: string; size?: number } | null
  onClose: () => void
}

const FI: Record<string, { icon: string; color: string }> = {
  docx: { icon: '📄', color: '#2b579a' }, pdf: { icon: '📕', color: '#d32f2f' },
  xlsx: { icon: '📗', color: '#217346' }, pptx: { icon: '📙', color: '#d24726' },
  csv: { icon: '📊', color: '#22c55e' }, md: { icon: '📝', color: '#6366f1' }, txt: { icon: '📃', color: '#6b7280' },
}

export default function FilePreviewPanel({ file, onClose }: Props) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const fmt = (file?.format || file?.filename?.split('.').pop() || '').toLowerCase()
  const fi = FI[fmt] || { icon: '📎', color: 'var(--accent)' }
  const size = file?.size || 0
  const sizeStr = size > 1048576 ? `${(size / 1048576).toFixed(1)} MB` : size > 1024 ? `${(size / 1024).toFixed(1)} KB` : size ? `${size} B` : ''

  useEffect(() => {
    if (!file?.path) return
    setLoading(true); setContent('')
    client.get(`/files/preview/${file.path}`).then((r: any) => setContent(r.content || '(无法预览)'))
      .catch(() => setContent('预览加载失败')).finally(() => setLoading(false))
  }, [file?.path])

  const copy = async () => {
    await navigator.clipboard.writeText(content); setCopied(true); toast.success('已复制'); setTimeout(() => setCopied(false), 2000)
  }
  const dl = () => {
    if (!file?.path) return
    const tk = localStorage.getItem('agentforge_token') || ''
    fetch(`/api/v1/files/download/${file.path}`, { headers: { Authorization: `Bearer ${tk}` } })
      .then(r => r.blob()).then(b => { const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = file.filename; a.click(); URL.revokeObjectURL(u) })
      .catch(() => toast.error('下载失败'))
  }

  if (!file) return null
  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)', borderLeft: '1px solid var(--border)' }}>
      <div className="flex items-center gap-3 px-4 py-3 shrink-0 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <span className="text-lg">{fi.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{file.filename}</div>
          <div className="text-[10px] flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: `${fi.color}15`, color: fi.color }}>{fmt.toUpperCase()}</span>
            {sizeStr && <span>{sizeStr}</span>}
          </div>
        </div>
        <button onClick={copy} disabled={!content || loading} className="p-2 rounded-lg hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }} title="复制">
          {copied ? <Check size={16} style={{ color: '#22c55e' }} /> : <Copy size={16} />}
        </button>
        <button onClick={dl} className="p-2 rounded-lg hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }} title="下载"><Download size={16} /></button>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }} title="关闭"><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-auto">
        {loading ? <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent)' }} /></div>
         : <pre className="px-6 py-4 text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)', fontFamily: 'inherit', margin: 0 }}>{content}</pre>}
      </div>
    </div>
  )
}
