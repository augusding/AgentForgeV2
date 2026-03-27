import { useState, useRef } from 'react'
import { X, Sparkles, Paperclip, Loader2 } from 'lucide-react'
import { type ToolDef } from './Toolbox'
import { uploadChatFile } from '../api/chat'
import toast from 'react-hot-toast'

interface Props {
  tool: ToolDef
  onSubmit: (prompt: string, files: Array<{ file_id: string; filename: string }>, toolHint?: string) => void
  onClose: () => void
}

export default function ToolPanel({ tool, onSubmit, onClose }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const f of tool.fields) { if (f.default) init[f.key] = f.default }
    return init
  })
  const [files, setFiles] = useState<Array<{ file_id: string; filename: string }>>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (key: string, val: string) => setValues(p => ({ ...p, [key]: val }))

  const handleUpload = async (fl: FileList | null) => {
    if (!fl) return; setUploading(true)
    for (const f of Array.from(fl).slice(0, 3)) {
      try { const r = await uploadChatFile(f); setFiles(p => [...p, { file_id: r.file_id, filename: r.filename }]) }
      catch { toast.error(`${f.name} 上传失败`) }
    }
    setUploading(false)
  }

  const handleSubmit = () => {
    const missing = tool.fields.filter(f => f.required && f.type !== 'file' && !values[f.key]?.trim())
    if (missing.length) { toast.error(`请填写：${missing.map(f => f.label).join('、')}`); return }
    let prompt = tool.prompt_template || ''
    for (const [k, v] of Object.entries(values)) {
      prompt = prompt.replace(new RegExp(`\\{${k}\\}`, 'g'), v.trim() || '')
    }
    prompt = prompt.replace(/\n{3,}/g, '\n\n').trim()
    if (tool.suffix) prompt += '\n' + tool.suffix
    setSubmitting(true)
    onSubmit(prompt, files, tool.tool_hint)
  }

  const st = { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }

  return (
    <div className="rounded-xl overflow-hidden mb-3 max-w-[900px] mx-auto"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{tool.icon}</span>
          <div>
            <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{tool.label}</div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{tool.description}</div>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
      </div>
      <div className="px-4 py-3 space-y-3">
        {tool.fields.map(field => {
          if (field.type === 'file') return (
            <div key={field.key}>
              <label className="text-[11px] mb-1 block" style={{ color: 'var(--text-muted)' }}>{field.label}</label>
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs w-full text-left" style={{ ...st, color: 'var(--text-muted)' }}>
                <Paperclip size={12} />{uploading ? '上传中...' : files.length ? `已上传 ${files.length} 个` : '点击上传'}
              </button>
            </div>
          )
          if (field.type === 'select') return (
            <div key={field.key}>
              <label className="text-[11px] mb-1 block" style={{ color: 'var(--text-muted)' }}>
                {field.label}{field.required && <span style={{ color: '#ef4444' }}> *</span>}
              </label>
              <select value={values[field.key] || ''} onChange={e => set(field.key, e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={st}>
                <option value="">选择...</option>
                {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )
          if (field.type === 'textarea') return (
            <div key={field.key}>
              <label className="text-[11px] mb-1 block" style={{ color: 'var(--text-muted)' }}>
                {field.label}{field.required && <span style={{ color: '#ef4444' }}> *</span>}
              </label>
              <textarea value={values[field.key] || ''} onChange={e => set(field.key, e.target.value)}
                placeholder={field.placeholder} rows={3}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={st} />
            </div>
          )
          return (
            <div key={field.key}>
              <label className="text-[11px] mb-1 block" style={{ color: 'var(--text-muted)' }}>
                {field.label}{field.required && <span style={{ color: '#ef4444' }}> *</span>}
              </label>
              <input type="text" value={values[field.key] || ''} onChange={e => set(field.key, e.target.value)}
                placeholder={field.placeholder} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={st} />
            </div>
          )
        })}
      </div>
      {files.length > 0 && (
        <div className="px-4 pb-2 flex gap-2 flex-wrap">
          {files.map(f => (
            <div key={f.file_id} className="flex items-center gap-1 px-2 py-1 rounded text-xs" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <Paperclip size={10} style={{ color: 'var(--accent)' }} />
              <span className="max-w-[120px] truncate">{f.filename}</span>
              <button onClick={() => setFiles(p => p.filter(x => x.file_id !== f.file_id))} className="hover:text-[var(--error)]"><X size={10} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="px-4 py-3 border-t flex justify-end" style={{ borderColor: 'var(--border)' }}>
        <button onClick={handleSubmit} disabled={submitting}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white"
          style={{ background: submitting ? 'var(--border)' : 'var(--accent)' }}>
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {submitting ? '生成中...' : `✨ ${tool.label}`}
        </button>
      </div>
      <input ref={fileRef} type="file" hidden multiple accept=".pdf,.docx,.txt,.md,.csv,.json,.xlsx,.pptx,.png,.jpg"
        onChange={e => { handleUpload(e.target.files); e.target.value = '' }} />
    </div>
  )
}
