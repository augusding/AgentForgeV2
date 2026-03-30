import { useState } from 'react'
import { Eye, X, Loader2 } from 'lucide-react'
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

  const process = async () => {
    setProcessing(true)
    try {
      const res: any = await client.post('/media/process', { file_id: fileId, mode: 'vision' }, { timeout: 120000 })
      if (res.success && res.text) {
        onResult(res.text, res.source || 'vision')
        toast.success('AI 识别完成')
      } else {
        toast.error(res.error || '处理失败')
        setProcessing(false)
      }
    } catch (e: any) {
      toast.error(e.message || '处理失败')
      setProcessing(false)
    }
  }

  const sizeStr = fileSize > 1048576
    ? `${(fileSize / 1048576).toFixed(1)} MB`
    : `${Math.round(fileSize / 1024)} KB`

  return (
    <div className="rounded-xl p-3 mb-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: 'var(--accent)10' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{filename}</div>
          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{sizeStr}</div>
        </div>
        <button onClick={process} disabled={processing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ border: '1px solid var(--accent)', color: 'var(--accent)', background: 'transparent' }}>
          {processing ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
          {processing ? '识别中...' : 'AI 识别'}
        </button>
        {!processing && (
          <button onClick={onCancel} className="p-1 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}>
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
