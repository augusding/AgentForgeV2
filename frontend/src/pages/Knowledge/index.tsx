import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Upload, Trash2, FileText, Database, HardDrive, PlugZap,
  X, Tag, CheckCircle2, AlertCircle, Loader2, File as FileIcon,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import PageHeader from '../../components/PageHeader'
import SearchInput from '../../components/SearchInput'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import StatusBadge from '../../components/StatusBadge'
import ConfirmDialog from '../../components/ConfirmDialog'
import {
  fetchKnowledgeFiles, fetchKnowledgeStats, deleteKnowledgeFile,
  batchUploadKnowledgeFiles,
} from '../../api/knowledge'
import type { BatchUploadEvent } from '../../api/knowledge'
import type { KnowledgeFile, KnowledgeStats } from '../../types/knowledge'
import { useWorkstationStore } from '../../stores/useWorkstationStore'
import DataSources from './DataSources'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'

function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`
  return `${bytes} B`
}

const INDEX_LABEL: Record<string, string> = {
  pending: '待索引',
  indexing: '索引中',
  indexed: '已索引',
  failed: '索引失败',
}

type TabKey = 'files' | 'datasources'

const TABS: { key: TabKey; label: string; icon: typeof FileText }[] = [
  { key: 'files', label: '文件管理', icon: FileText },
  { key: 'datasources', label: '数据源', icon: PlugZap },
]

/* ── Upload queue item ── */
interface UploadQueueItem {
  file: File
  status: 'pending' | 'uploading' | 'extracting' | 'chunking' | 'done' | 'error'
  progress: number  // 0-100
  error?: string
  fileId?: string
  chunksAdded?: number
}

const ACCEPTED_TYPES = '.pdf,.docx,.txt,.md'

export default function Knowledge() {
  const [activeTab, setActiveTab] = useState<TabKey>('files')

  // ── File management state ──
  const [files, setFiles] = useState<KnowledgeFile[]>([])
  const [stats, setStats] = useState<KnowledgeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeFile | null>(null)

  // ── Upload dialog state ──
  const [showUpload, setShowUpload] = useState(false)
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [scopeTagInput, setScopeTagInput] = useState('')
  const [scopeTags, setScopeTags] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadFiles = async () => {
    setLoading(true)
    try {
      const [f, s] = await Promise.all([fetchKnowledgeFiles(), fetchKnowledgeStats()])
      setFiles(f)
      setStats(s)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadFiles() }, [])

  const openUploadDialog = () => {
    setUploadQueue([])
    setScopeTags([])
    setScopeTagInput('')
    setUploading(false)
    setShowUpload(true)
  }

  // ── File selection ──
  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const items: UploadQueueItem[] = Array.from(newFiles).map(file => ({
      file,
      status: 'pending' as const,
      progress: 0,
    }))
    setUploadQueue(prev => [...prev, ...items])
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(e.target.files)
    e.target.value = ''
  }

  const removeFromQueue = (index: number) => {
    setUploadQueue(prev => prev.filter((_, i) => i !== index))
  }

  // ── Drag & drop ──
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  // ── Batch upload with SSE progress ──
  const handleUploadConfirm = async () => {
    const pendingFiles = uploadQueue.filter(q => q.status === 'pending' || q.status === 'error')
    if (pendingFiles.length === 0) return

    setUploading(true)

    // Reset statuses
    setUploadQueue(prev => prev.map(q =>
      q.status === 'pending' || q.status === 'error'
        ? { ...q, status: 'uploading' as const, progress: 0, error: undefined }
        : q
    ))

    const currentPositionId = useWorkstationStore.getState().home?.position?.position_id

    const onProgress = (event: BatchUploadEvent) => {
      const { data } = event
      const idx = data.index as number | undefined

      setUploadQueue(prev => {
        const next = [...prev]
        // Find the correct queue item (only pending/uploading items, by order)
        const pendingIndices = prev.reduce<number[]>((acc, q, i) => {
          if (q.status !== 'done') acc.push(i)
          return acc
        }, [])

        const queueIdx = idx !== undefined ? pendingIndices[idx] : undefined

        if (queueIdx === undefined || queueIdx >= next.length) return next

        switch (event.event) {
          case 'file_start':
            next[queueIdx] = { ...next[queueIdx], status: 'uploading', progress: 5 }
            break
          case 'extract_done':
            next[queueIdx] = { ...next[queueIdx], status: 'extracting', progress: 20 }
            break
          case 'chunks_ready':
            next[queueIdx] = { ...next[queueIdx], status: 'chunking', progress: 40 }
            break
          case 'chunk_progress': {
            const current = (data.current as number) || 0
            const total = (data.total as number) || 1
            const pct = 40 + Math.round((current / total) * 50)
            next[queueIdx] = { ...next[queueIdx], status: 'chunking', progress: Math.min(pct, 95) }
            break
          }
          case 'file_done':
            next[queueIdx] = {
              ...next[queueIdx], status: 'done', progress: 100,
              fileId: data.file_id, chunksAdded: data.chunks_added,
            }
            break
          case 'file_error':
            next[queueIdx] = { ...next[queueIdx], status: 'error', progress: 0, error: data.error }
            break
        }
        return next
      })
    }

    try {
      await batchUploadKnowledgeFiles(
        pendingFiles.map(q => q.file),
        {
          positionIds: currentPositionId ? [currentPositionId] : undefined,
          scopeTags: scopeTags.length > 0 ? scopeTags : undefined,
        },
        onProgress,
      )
    } catch (err: any) {
      toast.error(`上传失败: ${err.message || '网络错误'}`)
    }

    setUploading(false)

    // Refresh file list
    loadFiles()
  }

  // ── Scope tags ──
  const addScopeTag = () => {
    const tag = scopeTagInput.trim()
    if (tag && !scopeTags.includes(tag)) setScopeTags(prev => [...prev, tag])
    setScopeTagInput('')
  }

  // ── Delete ──
  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteKnowledgeFile(deleteTarget.id)
      setFiles(prev => prev.filter(f => f.id !== deleteTarget.id))
      toast.success('已删除')
    } catch { toast.error('删除失败') }
    setDeleteTarget(null)
  }

  const filtered = files.filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()))

  // Upload summary
  const doneCount = uploadQueue.filter(q => q.status === 'done').length
  const errorCount = uploadQueue.filter(q => q.status === 'error').length
  const totalCount = uploadQueue.length

  return (
    <div>
      <PageHeader
        title="知识库"
        description="管理行业知识文档与数据源连接"
        actions={
          activeTab === 'files' ? (
            <button
              onClick={openUploadDialog}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
            >
              <Upload size={16} />
              上传文件
            </button>
          ) : undefined
        }
      />

      {/* Tab */}
      <div className="flex items-center gap-1 mb-6 border-b border-border">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-text hover:border-border'
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Files Tab */}
      {activeTab === 'files' && (
        <>
          {loading ? (
            <LoadingSpinner fullPage />
          ) : (
            <>
              {/* Stats */}
              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-surface border border-border rounded-lg p-4 flex items-center gap-3">
                    <FileText size={20} className="text-primary shrink-0" />
                    <div>
                      <div className="text-xl font-bold text-text">{stats.total_files}</div>
                      <div className="text-xs text-text-muted">文件总数</div>
                    </div>
                  </div>
                  <div className="bg-surface border border-border rounded-lg p-4 flex items-center gap-3">
                    <Database size={20} className="text-accent shrink-0" />
                    <div>
                      <div className="text-xl font-bold text-text">{stats.total_chunks}</div>
                      <div className="text-xs text-text-muted">文本块</div>
                    </div>
                  </div>
                  <div className="bg-surface border border-border rounded-lg p-4 flex items-center gap-3">
                    <HardDrive size={20} className="text-info shrink-0" />
                    <div>
                      <div className="text-xl font-bold text-text">{formatFileSize(stats.total_size)}</div>
                      <div className="text-xs text-text-muted">总大小</div>
                    </div>
                  </div>
                  <div className="bg-surface border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-text-muted">索引进度</span>
                      <span className="text-xs font-medium text-text">{stats.index_progress}%</span>
                    </div>
                    <div className="h-2 bg-border rounded-full overflow-hidden">
                      <div className="h-full bg-success rounded-full" style={{ width: `${stats.index_progress}%` }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Search */}
              <div className="mb-4">
                <SearchInput value={search} onChange={setSearch} placeholder="搜索文件..." />
              </div>

              {/* Table */}
              {filtered.length === 0 ? (
                <EmptyState variant={search ? 'no-results' : 'empty'} title={search ? '未找到匹配文件' : '暂无知识文件'} />
              ) : (
                <div className="bg-surface border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-bg">
                        <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">文件名</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">类型</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">大小</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">分类</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">作用域</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">块数</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">状态</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">引用次数</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">上传时间</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-text-muted">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(f => (
                        <tr key={f.id} className="border-b border-border last:border-0 hover:bg-bg/50">
                          <td className="px-4 py-3 font-medium text-text">{f.name}</td>
                          <td className="px-4 py-3 text-text-muted uppercase">{f.file_type}</td>
                          <td className="px-4 py-3 text-text-muted">{formatFileSize(f.file_size)}</td>
                          <td className="px-4 py-3 text-text-muted">{f.category === 'industry' ? '行业' : '自定义'}</td>
                          <td className="px-4 py-3">
                            {f.position_ids?.length ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
                                {f.position_ids.length}个岗位
                              </span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-info/10 text-info">全局</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-text-muted">{f.chunk_count}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={f.index_status} label={INDEX_LABEL[f.index_status]} />
                          </td>
                          <td className="px-4 py-3 text-text-muted">{f.used_in_missions ?? '—'}</td>
                          <td className="px-4 py-3 text-text-muted">{dayjs(f.created_at).format('MM-DD HH:mm')}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => setDeleteTarget(f)} className="p-1.5 text-text-muted hover:text-danger rounded transition-colors">
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <ConfirmDialog
                open={!!deleteTarget}
                title="确认删除"
                message={`确定要删除「${deleteTarget?.name}」吗？此操作不可撤销。`}
                confirmLabel="删除"
                destructive
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
              />
            </>
          )}
        </>
      )}

      {/* DataSources Tab */}
      {activeTab === 'datasources' && <DataSources />}

      {/* ── Upload Dialog (batch + progress) ── */}
      <AnimatePresence>
        {showUpload && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => !uploading && setShowUpload(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-lg"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h3 className="text-sm font-semibold text-text">上传知识文件</h3>
                {!uploading && (
                  <button onClick={() => setShowUpload(false)} className="text-text-muted hover:text-text">
                    <X size={18} />
                  </button>
                )}
              </div>

              <div className="p-5 space-y-4">
                {/* Drag & Drop zone */}
                {!uploading && (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                      isDragging
                        ? 'border-accent bg-accent/5'
                        : 'border-border hover:border-accent/40 hover:bg-bg'
                    }`}
                  >
                    <Upload size={24} className="mx-auto mb-2 text-text-muted" />
                    <p className="text-xs text-text-secondary">拖拽文件到此处，或点击选择文件</p>
                    <p className="text-[10px] text-text-muted mt-1">支持 PDF、DOCX、TXT、MD，单文件最大 50MB</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={ACCEPTED_TYPES}
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                )}

                {/* File queue */}
                {uploadQueue.length > 0 && (
                  <div className="space-y-2 max-h-[280px] overflow-y-auto">
                    {/* Summary bar */}
                    {uploading && (
                      <div className="flex items-center gap-2 px-2 py-1.5 bg-bg rounded-lg text-[11px] text-text-muted">
                        <Loader2 size={12} className="animate-spin text-accent" />
                        <span>处理中 {doneCount + errorCount}/{totalCount}</span>
                        {doneCount > 0 && <span className="text-success">{doneCount} 成功</span>}
                        {errorCount > 0 && <span className="text-danger">{errorCount} 失败</span>}
                      </div>
                    )}

                    {uploadQueue.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-bg">
                        {/* Status icon */}
                        {item.status === 'done' ? (
                          <CheckCircle2 size={16} className="text-success shrink-0" />
                        ) : item.status === 'error' ? (
                          <AlertCircle size={16} className="text-danger shrink-0" />
                        ) : item.status === 'pending' ? (
                          <FileIcon size={16} className="text-text-muted shrink-0" />
                        ) : (
                          <Loader2 size={16} className="text-accent animate-spin shrink-0" />
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-text truncate">{item.file.name}</span>
                            <span className="text-[10px] text-text-muted shrink-0">
                              {formatFileSize(item.file.size)}
                            </span>
                          </div>

                          {/* Progress bar */}
                          {(item.status === 'uploading' || item.status === 'extracting' || item.status === 'chunking') && (
                            <div className="mt-1">
                              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-accent rounded-full transition-all duration-300"
                                  style={{ width: `${item.progress}%` }}
                                />
                              </div>
                              <p className="text-[9px] text-text-muted mt-0.5">
                                {item.status === 'extracting' && '提取文本...'}
                                {item.status === 'chunking' && `向量化 ${item.progress}%`}
                                {item.status === 'uploading' && '准备中...'}
                              </p>
                            </div>
                          )}

                          {/* Done info */}
                          {item.status === 'done' && item.chunksAdded !== undefined && (
                            <p className="text-[10px] text-success mt-0.5">{item.chunksAdded} 个文本块</p>
                          )}

                          {/* Error message */}
                          {item.status === 'error' && item.error && (
                            <p className="text-[10px] text-danger mt-0.5">{item.error}</p>
                          )}
                        </div>

                        {/* Remove button (only when not uploading) */}
                        {!uploading && (
                          <button
                            onClick={() => removeFromQueue(idx)}
                            className="p-1 text-text-muted hover:text-danger shrink-0"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Scope tags */}
                {!uploading && (
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      知识标签 <span className="text-text-muted font-normal">(可选)</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={scopeTagInput}
                        onChange={e => setScopeTagInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addScopeTag() } }}
                        placeholder="输入标签后回车"
                        className="flex-1 px-3 py-1.5 text-sm border border-border rounded-lg bg-bg focus:border-accent focus:outline-none"
                      />
                      <button
                        onClick={addScopeTag}
                        disabled={!scopeTagInput.trim()}
                        className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-surface-hover disabled:opacity-40 transition-colors"
                      >
                        <Tag size={14} />
                      </button>
                    </div>
                    {scopeTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {scopeTags.map(tag => (
                          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-info/10 text-info border border-info/20">
                            {tag}
                            <button onClick={() => setScopeTags(prev => prev.filter(t => t !== tag))} className="hover:text-danger">
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2">
                  {!uploading ? (
                    <>
                      <button
                        onClick={() => setShowUpload(false)}
                        className="px-4 py-2 text-xs text-text-muted hover:text-text rounded-lg transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleUploadConfirm}
                        disabled={uploadQueue.filter(q => q.status === 'pending' || q.status === 'error').length === 0}
                        className="px-4 py-2 text-xs text-white bg-accent rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors"
                      >
                        上传 {uploadQueue.filter(q => q.status === 'pending' || q.status === 'error').length} 个文件
                      </button>
                    </>
                  ) : doneCount + errorCount === totalCount && totalCount > 0 ? (
                    <button
                      onClick={() => setShowUpload(false)}
                      className="px-4 py-2 text-xs text-white bg-accent rounded-lg hover:bg-accent/90 transition-colors"
                    >
                      完成 ({doneCount} 成功{errorCount > 0 ? `, ${errorCount} 失败` : ''})
                    </button>
                  ) : null}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
