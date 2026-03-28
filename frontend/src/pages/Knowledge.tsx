import { useState, useEffect, useCallback } from 'react'
import { Upload, Search, FileText, Trash2, Database, File, X, Globe, FolderOpen, Link } from 'lucide-react'
import { searchKnowledge, getKnowledgeStats, uploadFile, listFiles } from '../api/knowledge'
import client from '../api/client'
import Markdown from '../components/Markdown'
import toast from 'react-hot-toast'

interface FileInfo {
  file_id: string; doc_id?: string; filename: string; title?: string
  source_type?: string; source_url?: string; lang?: string
  quality_score?: number; deleted?: boolean; size: number; modified: number
}
interface SearchResult { content: string; score: number; source: string }
interface Stats { total_files: number; total_chunks: number; total_size: number; status: string }

const SRC: Record<string, { label: string; color: string }> = {
  upload: { label: '上传', color: '#6366f1' }, local_file: { label: '本地文件', color: '#0ea5e9' },
  web: { label: '网页', color: '#10b981' }, confluence: { label: 'Confluence', color: '#0052cc' },
  sql: { label: '数据库', color: '#f59e0b' },
}

function Badge({ type }: { type?: string }) {
  const c = SRC[type || 'upload'] || { label: type || 'upload', color: '#888' }
  return <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: c.color + '18', color: c.color, border: `1px solid ${c.color}30` }}>{c.label}</span>
}

export default function Knowledge() {
  const [files, setFiles] = useState<FileInfo[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [query, setQuery] = useState(''); const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false); const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false); const [filterType, setFilterType] = useState('all')

  useEffect(() => { loadFiles(); loadStats() }, [])
  const loadFiles = async () => { try { const d = await listFiles(); setFiles(d.files || []) } catch {} }
  const loadStats = async () => { try { setStats(await getKnowledgeStats()) } catch {} }

  const handleUpload = async (fl: FileList | null) => {
    if (!fl?.length) return; setUploading(true); let ok = 0
    for (const f of Array.from(fl)) { try { await uploadFile(f, 'knowledge'); ok++ } catch { toast.error(`${f.name} 失败`) } }
    if (ok) { toast.success(`${ok} 个文件上传成功`); await loadFiles(); await loadStats() }
    setUploading(false)
  }
  const handleSearch = async () => {
    if (!query.trim()) return; setSearching(true)
    try { const d = await searchKnowledge(query.trim(), 5); setResults(d.results || []); if (!d.results?.length) toast('未找到', { icon: '🔍' }) }
    catch { toast.error('搜索失败') } finally { setSearching(false) }
  }
  const handleDelete = async (docId: string, name: string) => {
    if (!confirm(`确认删除 ${name}？`)) return
    try { await client.delete(`/knowledge/${docId}`); toast.success('已删除'); await loadFiles(); await loadStats() } catch { toast.error('删除失败') }
  }
  const clearAll = async () => {
    if (!confirm('确定清空知识库？此操作不可恢复。')) return
    try { await client.post('/knowledge/clear'); toast.success('已清空'); await loadFiles(); await loadStats() } catch { toast.error('失败') }
  }
  const onDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files) }, [])
  const fmtSize = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`

  const visible = files.filter(f => !f.deleted).filter(f => filterType === 'all' || (f.source_type || 'upload') === filterType)
  const counts = files.filter(f => !f.deleted).reduce<Record<string, number>>((a, f) => { const t = f.source_type || 'upload'; a[t] = (a[t] || 0) + 1; return a }, {})

  return (
    <div className="h-full flex flex-col p-6 max-w-[1000px] mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-bold">知识库</h1>
        {files.length > 0 && <button onClick={clearAll} className="text-xs px-3 py-1.5 rounded-lg hover:bg-[#ef444410]"
          style={{ color: '#ef4444', border: '1px solid #ef444430' }}>清空知识库</button>}
      </div>
      <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>知识库内容来自手动上传和企业数据源同步，AI 检索时自动引用</p>

      {stats && (
        <div className="flex gap-4 mb-6">
          {[{ label: '文档数', value: stats.total_files ?? files.length, icon: FileText },
            { label: '文本片段', value: stats.total_chunks ?? 0, icon: Database },
            { label: '总大小', value: fmtSize(stats.total_size || 0), icon: File }
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-lg flex-1"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <Icon size={18} style={{ color: 'var(--accent)' }} />
              <div><div className="text-lg font-bold">{value}</div><div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div></div>
            </div>
          ))}
        </div>
      )}

      <div className={`border-2 border-dashed rounded-xl p-6 text-center mb-6 transition-colors cursor-pointer ${dragOver ? 'border-[var(--accent)]' : ''}`}
        style={{ borderColor: dragOver ? undefined : 'var(--border)' }}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}
        onClick={() => document.getElementById('file-input')?.click()}>
        <Upload size={24} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
        <p className="text-sm mb-1">{uploading ? '上传中...' : '拖拽文件到此处，或点击选择'}</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>支持 PDF, DOCX, TXT, MD, CSV, JSON（最大 20MB）</p>
        <input id="file-input" type="file" multiple hidden accept=".pdf,.docx,.txt,.md,.csv,.json" onChange={e => handleUpload(e.target.files)} />
      </div>

      <div className="flex gap-2 mb-6">
        <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="搜索知识库内容..." className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        <button onClick={handleSearch} disabled={searching || !query.trim()} className="px-4 py-2.5 rounded-lg text-sm text-white"
          style={{ background: searching ? 'var(--border)' : 'var(--accent)' }}><Search size={16} /></button>
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
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--bg)', color: 'var(--accent)' }}>相关度 {(r.score * 100).toFixed(0)}%</span>
                  {r.source && <span className="text-xs truncate max-w-[300px]" style={{ color: 'var(--text-muted)' }}>{r.source}</span>}
                </div>
                <Markdown content={r.content} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium">全部文档（{visible.length}）</h2>
          {Object.keys(counts).length > 1 && (
            <div className="flex gap-1.5">
              <button onClick={() => setFilterType('all')} className="text-xs px-2.5 py-1 rounded-full"
                style={{ background: filterType === 'all' ? 'var(--accent)' : 'var(--bg-surface)', color: filterType === 'all' ? '#fff' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
                全部 {files.filter(f => !f.deleted).length}</button>
              {Object.entries(counts).map(([t, n]) => {
                const c = SRC[t] || { label: t, color: '#888' }
                return <button key={t} onClick={() => setFilterType(t)} className="text-xs px-2.5 py-1 rounded-full"
                  style={{ background: filterType === t ? c.color : 'var(--bg-surface)', color: filterType === t ? '#fff' : 'var(--text-muted)', border: `1px solid ${filterType === t ? c.color : 'var(--border)'}` }}>
                  {c.label} {n}</button>
              })}
            </div>
          )}
        </div>
        {!visible.length ? (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
            {filterType === 'all' ? '暂无文档，上传文件或通过数据源同步' : `暂无${SRC[filterType]?.label || filterType}类型文档`}</div>
        ) : (
          <div className="space-y-2">
            {visible.map(f => {
              const st = f.source_type || 'upload'; const name = f.title && f.title !== f.filename ? f.title : f.filename
              return (
                <div key={f.file_id} className="flex items-center gap-3 px-4 py-3 rounded-lg group" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                  {st === 'web' ? <Globe size={16} style={{ color: '#10b981', flexShrink: 0 }} />
                   : st === 'local_file' ? <FolderOpen size={16} style={{ color: '#0ea5e9', flexShrink: 0 }} />
                   : <FileText size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm truncate">{name}</span>
                      <Badge type={st} />
                      {f.lang && <span className="text-xs px-1 rounded" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>{f.lang}</span>}
                      {typeof f.quality_score === 'number' && f.quality_score < 0.6 && <span className="text-xs px-1 rounded" style={{ background: '#fef3c7', color: '#92400e' }}>低质量</span>}
                    </div>
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {f.source_url && st === 'web' ? (
                        <a href={f.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline truncate max-w-[400px]"
                          style={{ color: 'var(--accent)' }} onClick={e => e.stopPropagation()}><Link size={10} />{f.source_url}</a>
                      ) : f.source_url ? <span className="truncate max-w-[400px]">{f.source_url}</span> : null}
                      {f.size > 0 && <span>{fmtSize(f.size)}</span>}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(f.doc_id || f.file_id, name)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-muted)' }}><Trash2 size={14} /></button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
