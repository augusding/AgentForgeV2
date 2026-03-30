import { useState } from 'react'
import { FileText, Eye, X, Loader2 } from 'lucide-react'
import client from '../api/client'
import toast from 'react-hot-toast'

interface Props {
  fileId: string
  filename: string
  fileSize: number
  onResult: (text: string, source: string) => void
  onCancel: () => void
}

export default function ImageChoiceCard({ fileId, filename, fileSize, onResult, onCancel }: Props) {
  const [processing, setProcessing] = useState(false)
  const [mode, setMode] = useState('')

  const process = async (m: 'ocr' | 'vision') => {
    setProcessing(true); setMode(m)
    try {
      const res: any = await client.post('/media/process', { file_id: fileId, mode: m })
      if (res.success && res.text) {
        onResult(res.text, res.source || m)
        toast.success(m === 'ocr' ? '文字提取完成' : 'AI 识别完成')
      } else {
        toast.error(res.error || '处理失败')
        setProcessing(false); setMode('')
      }
    } catch (e: any) {
      toast.error(e.message || '处理失败')
      setProcessing(false); setMode('')
    }
  }

  const sizeStr = fileSize > 1048576
    ? `${(fileSize / 1048576).toFixed(1)} MB`
    : `${Math.round(fileSize / 1024)} KB`

  return (
    <div className="rounded-xl p-3 mb-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: 'var(--accent)10' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{filename}</div>
          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{sizeStr}</div>
        </div>
        {!processing && (
          <button onClick={onCancel} className="p-1 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}>
            <X size={14} />
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={() => process('ocr')} disabled={processing}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium"
          style={{
            border: '1px solid var(--border)', background: 'var(--bg-surface)',
            color: processing && mode === 'ocr' ? 'var(--accent)' : 'var(--text)',
            opacity: processing && mode !== 'ocr' ? 0.4 : 1,
          }}>
          {processing && mode === 'ocr' ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
          提取文字
        </button>
        <button onClick={() => process('vision')} disabled={processing}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium"
          style={{
            border: '1px solid var(--border)', background: 'var(--bg-surface)',
            color: processing && mode === 'vision' ? 'var(--accent)' : 'var(--text)',
            opacity: processing && mode !== 'vision' ? 0.4 : 1,
          }}>
          {processing && mode === 'vision' ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
          AI 看图
        </button>
      </div>
    </div>
  )
}
