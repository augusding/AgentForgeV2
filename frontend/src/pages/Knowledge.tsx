import { useState, useEffect, useCallback } from 'react'
import { Upload, Search, FileText, Trash2, Database, File, X } from 'lucide-react'
import { searchKnowledge, getKnowledgeStats, uploadFile, listFiles } from '../api/knowledge'
import client from '../api/client'
import Markdown from '../components/Markdown'
import toast from 'react-hot-toast'

interface FileInfo { file_id: string; doc_id?: string; filename: string; size: number; modified: number }
interface SearchResult { content: string; score: number; source: string }
interface Stats { total_files: number; total_chunks: number; total_size: number; status: string }

export default function Knowledge() {
  const [files, setFiles] = useState<FileInfo[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => { loadFiles(); loadStats() }, [])

  const loadFiles = async () => { try { const d = await listFiles(); setFiles(d.files || []) } catch {} }
  const loadStats = async () => { try { setStats(await getKnowledgeStats()) } catch {} }

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList?.length) return
    setUploading(true)
    let ok = 0
    for (const file of Array.from(fileList)) {
      try { await uploadFile(file, 'knowledge'); ok++ } catch { toast.error(`${file.name} 上传失败`) }
    }
    if (ok) { toast.success(`${ok} 个文件上传成功`); await loadFiles(); await loadStats() }
    setUploading(false)
  }

  const handleSearch = async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const data = await searchKnowledge(query.trim(), 5)
      setResults(data.results || [])
      if (!(data.results?.length)) toast('未找到相关内容', { icon: '🔍' })
    } catch { toast.error('搜索失败') }
    finally { setSearching(false) }
  }

  const handleDelete = async (docId: string, filename: string) => {
    if (!confirm(`确认删除 ${filename}？`)) return
    try { await client.delete(`/knowledge/${docId}`); toast.success('已删除'); await loadFiles(); await loadStats() }
    catch { toast.error('删除失败') }
  }

  const clearAll = async () => {
    if (!confirm('确定清空知识库？所有文档将被删除，此操作不可恢复。')) return
    try { await client.post('/knowledge/clear'); toast.success('知识库已清空'); await loadFiles(); await loadStats() } catch { toast.error('清空失败') }
  }
  const onDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files) }, [])

  const fmtSize = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`

  return (
    <div className="h-full flex flex-col p-6 max-w-[1000px] mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-bold">知识库</h1>
        {files.length > 0 && <button onClick={clearAll} className="text-xs px-3 py-1.5 rounded-lg hover:bg-[#ef444410]"
          style={{ color: '#ef4444', border: '1px solid #ef444430' }}>清空知识库</button>}
      </div>
      <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>上传文档让 AI 参考回答，支持 PDF、Word、TXT、Markdown</p>

      {stats && (
        <div className="flex gap-4 mb-6">
          {[
            { label: '文档数', value: stats.total_files ?? files.length, icon: FileText },
            { label: '文本片段', value: stats.total_chunks ?? 0, icon: Database },
            { label: '总大小', value: fmtSize(stats.total_size || 0), icon: File },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-lg flex-1"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <Icon size={18} style={{ color: 'var(--accent)' }} />
              <div>
                <div className="text-lg font-bold">{value}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={`border-2 border-dashed rounded-xl p-8 text-center mb-6 transition-colors cursor-pointer ${dragOver ? 'border-[var(--accent)]' : ''}`}
        style={{ borderColor: dragOver ? undefined : 'var(--border)' }}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}
        onClick={() => document.getElementById('file-input')?.click()}>
        <Upload size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
        <p className="text-sm mb-1">{uploading ? '上传中...' : '拖拽文件到此处，或点击选择'}</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>支持 PDF, DOCX, TXT, MD, CSV, JSON（最大 20MB）</p>
        <input id="file-input" type="file" multiple hidden accept=".pdf,.docx,.txt,.md,.csv,.json" onChange={e => handleUpload(e.target.files)} />
      </div>

      <div className="flex gap-2 mb-6">
        <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="搜索知识库内容..." className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        <button onClick={handleSearch} disabled={searching || !query.trim()}
          className="px-4 py-2.5 rounded-lg text-sm text-white transition-colors"
          style={{ background: searching ? 'var(--border)' : 'var(--accent)' }}>
          <Search size={16} />
        </button>
      </div>

      {results.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium">搜索结果（{results.length}）</h2>
            <button onClick={() => setResults([])} style={{ color: 'var(--text-muted)' }}><X size={14} /></button>
          </div>
          <div className="space-y-3">
            {results.map((r, i) => (
              <div key={i} className="p-4 rounded-lg text-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--bg)', color: 'var(--accent)' }}>
                    相关度 {(r.score * 100).toFixed(0)}%
                  </span>
                  {r.source && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.source}</span>}
                </div>
                <Markdown content={r.content} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1">
        <h2 className="text-sm font-medium mb-3">已上传文档（{files.length}）</h2>
        {files.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>暂无文档，上传文件开始构建知识库</div>
        ) : (
          <div className="space-y-2">
            {files.map(f => (
              <div key={f.file_id} className="flex items-center gap-3 px-4 py-3 rounded-lg group"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <FileText size={18} style={{ color: 'var(--accent)' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{f.filename}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtSize(f.size)}</div>
                </div>
                <button onClick={() => handleDelete(f.doc_id || f.file_id, f.filename)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-[var(--error)]" style={{ color: 'var(--text-muted)' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
