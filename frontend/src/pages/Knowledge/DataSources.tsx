import { useEffect, useRef, useState } from 'react'
import {
  Plus, RefreshCw, Trash2, CheckCircle, XCircle, AlertCircle,
  Clock, FolderOpen, Database, ChevronDown, ChevronUp, Play, Loader2,
  BookOpen, FileText, MessageCircle, Upload, X, File, Check, BarChart3,
} from 'lucide-react'
import StatusBadge from '../../components/StatusBadge'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import {
  fetchConnectorTypes,
  fetchConnectors,
  createConnector,
  deleteConnector,
  testConnectorAdhoc,
  syncConnector,
  fetchConnectorLogs,
  batchUploadKnowledgeFiles,
} from '../../api/knowledge'
import type { BatchUploadEvent } from '../../api/knowledge'
import type { ConnectorType, Connector, SyncLog, ConfigFieldDef } from '../../types/knowledge'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'

/** 支持解析的文件格式（与后端 SUPPORTED_EXTENSIONS 对齐） */
const ACCEPTED_EXTENSIONS = '.pdf,.docx,.txt,.md'
const ACCEPTED_LABEL = 'PDF, DOCX, TXT, MD'

const SYNC_STATUS_LABEL: Record<string, string> = {
  idle: '未同步',
  syncing: '同步中',
  success: '已同步',
  partial: '部分成功',
  failed: '同步失败',
}

const CONNECTOR_ICONS: Record<string, typeof FolderOpen> = {
  folder: FolderOpen,
  database: Database,
  metric_api: BarChart3,
  feishu: BookOpen,
  confluence: FileText,
  dingtalk: MessageCircle,
  tencent_docs: FileText,
}

const CONNECTOR_TYPE_LABELS: Record<string, string> = {
  folder: '文件夹',
  database: '数据库',
  metric_api: '指标 API',
  feishu: '飞书文档',
  confluence: 'Confluence',
  dingtalk: '钉钉文档',
  tencent_docs: '腾讯文档',
}

// ── 动态配置表单 ──────────────────────────────

function ConfigForm({
  fields,
  values,
  onChange,
}: {
  fields: ConfigFieldDef[]
  values: Record<string, any>
  onChange: (key: string, val: any) => void
}) {
  // 按 group 分组
  const groups = new Map<string, ConfigFieldDef[]>()
  for (const f of fields) {
    const g = f.group || '基本设置'
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(f)
  }

  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([group, gFields]) => (
        <div key={group}>
          <div className="text-xs font-medium text-text-muted mb-2">{group}</div>
          <div className="space-y-3">
            {gFields.map(f => (
              <div key={f.key}>
                <label className="block text-sm text-text mb-1">
                  {f.title}
                  {f.required && <span className="text-danger ml-0.5">*</span>}
                </label>
                {f.type === 'select' ? (
                  <select
                    value={values[f.key] ?? f.default ?? ''}
                    onChange={e => onChange(f.key, e.target.value)}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="">-- 请选择 --</option>
                    {f.options?.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : f.type === 'boolean' ? (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={values[f.key] ?? f.default ?? false}
                      onChange={e => onChange(f.key, e.target.checked)}
                      className="accent-accent"
                    />
                    <span className="text-sm text-text-muted">{f.help_text || '启用'}</span>
                  </label>
                ) : f.type === 'code' ? (
                  <textarea
                    value={values[f.key] ?? f.default ?? ''}
                    onChange={e => onChange(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    rows={4}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text font-mono focus:outline-none focus:ring-1 focus:ring-accent resize-y"
                  />
                ) : f.type === 'array' ? (
                  <input
                    value={Array.isArray(values[f.key]) ? values[f.key].join(', ') : (values[f.key] ?? (f.default || []).join(', '))}
                    onChange={e => onChange(f.key, e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
                    placeholder={f.placeholder || '逗号分隔多个值'}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                ) : (
                  <input
                    type={f.type === 'password' ? 'password' : f.type === 'number' ? 'number' : 'text'}
                    value={values[f.key] ?? f.default ?? ''}
                    onChange={e => onChange(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                )}
                {f.help_text && f.type !== 'boolean' && (
                  <p className="text-xs text-text-muted mt-0.5">{f.help_text}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}


// ── 批量文件导入面板（SSE 进度流）─────────────────

interface FileUploadStatus {
  file: File
  status: 'pending' | 'uploading' | 'extracting' | 'chunking' | 'success' | 'error'
  progress: number
  message?: string
  chunksAdded?: number
}

function BatchImportPanel({
  onDone,
  onClose,
}: {
  onDone: () => void
  onClose: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<FileUploadStatus[]>([])
  const [uploading, setUploading] = useState(false)
  const [completed, setCompleted] = useState(false)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files
    if (!selected || selected.length === 0) return
    const newFiles: FileUploadStatus[] = Array.from(selected).map(f => ({
      file: f, status: 'pending' as const, progress: 0,
    }))
    setFiles(prev => [...prev, ...newFiles])
    e.target.value = ''
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleUploadAll = async () => {
    const pending = files.filter(f => f.status === 'pending' || f.status === 'error')
    if (pending.length === 0) return
    setUploading(true)

    // Reset pending/error items
    setFiles(prev => prev.map(f =>
      f.status === 'pending' || f.status === 'error'
        ? { ...f, status: 'uploading' as const, progress: 0, message: undefined }
        : f
    ))

    const onProgress = (event: BatchUploadEvent) => {
      const { data } = event
      const idx = data.index as number | undefined

      setFiles(prev => {
        const next = [...prev]
        // Map batch index to queue index (only non-success items)
        const pendingIndices = prev.reduce<number[]>((acc, q, i) => {
          if (q.status !== 'success') acc.push(i)
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
            next[queueIdx] = { ...next[queueIdx], status: 'success', progress: 100, chunksAdded: data.chunks_added }
            break
          case 'file_error':
            next[queueIdx] = { ...next[queueIdx], status: 'error', progress: 0, message: data.error }
            break
        }
        return next
      })
    }

    try {
      const result = await batchUploadKnowledgeFiles(
        pending.map(f => f.file),
        {},
        onProgress,
      )
      if (result.failed === 0) {
        toast.success(`${result.success} 个文件导入成功`)
      } else {
        toast.error(`${result.success} 成功, ${result.failed} 失败`)
      }
    } catch (err: any) {
      toast.error(`上传失败: ${err.message || '网络错误'}`)
    }

    setUploading(false)
    setCompleted(true)
  }

  const handleDone = () => {
    onDone()
    onClose()
  }

  const formatSize = (bytes: number) => {
    if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
    if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`
    return `${bytes} B`
  }

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase()
    if (ext === 'pdf') return 'text-red-500'
    if (ext === 'docx' || ext === 'doc') return 'text-blue-500'
    if (ext === 'md') return 'text-purple-500'
    return 'text-text-muted'
  }

  const successCount = files.filter(f => f.status === 'success').length
  const errorCount = files.filter(f => f.status === 'error').length

  return (
    <div className="bg-surface border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FolderOpen size={18} className="text-accent" />
          <h3 className="text-base font-semibold text-text">批量导入文档</h3>
        </div>
        {!uploading && <button onClick={onClose} className="text-text-muted hover:text-text text-sm">取消</button>}
      </div>

      {/* 提示 */}
      <div className="mb-4 px-3 py-2 bg-bg rounded-lg text-xs text-text-muted">
        支持格式: {ACCEPTED_LABEL}，单文件最大 50MB
      </div>

      {/* 选择文件按钮 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleFileSelect}
        className="hidden"
      />
      {!uploading && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex flex-col items-center gap-2 px-4 py-6 border-2 border-dashed border-border rounded-lg hover:border-accent/50 hover:bg-accent/5 transition-all"
        >
          <Upload size={24} className="text-text-muted" />
          <span className="text-sm text-text-secondary">点击选择文件（可多选）</span>
        </button>
      )}

      {/* 上传进度摘要 */}
      {uploading && (
        <div className="flex items-center gap-2 px-3 py-2 bg-bg rounded-lg text-xs text-text-muted mb-2">
          <Loader2 size={12} className="animate-spin text-accent" />
          <span>处理中 {successCount + errorCount}/{files.length}</span>
          {successCount > 0 && <span className="text-success">{successCount} 成功</span>}
          {errorCount > 0 && <span className="text-danger">{errorCount} 失败</span>}
        </div>
      )}

      {/* 文件列表 */}
      {files.length > 0 && (
        <div className="mt-4">
          <div className="text-xs text-text-muted mb-2">
            已选择 {files.length} 个文件
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {files.map((f, i) => (
              <div key={`${f.file.name}-${i}`} className="flex items-center gap-2 px-3 py-2 bg-bg rounded-lg">
                <File size={14} className={getFileIcon(f.file.name)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text truncate">{f.file.name}</span>
                    <span className="text-xs text-text-muted shrink-0">{formatSize(f.file.size)}</span>
                  </div>
                  {/* Progress bar */}
                  {(f.status === 'uploading' || f.status === 'extracting' || f.status === 'chunking') && (
                    <div className="mt-1">
                      <div className="h-1.5 bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full transition-all duration-300"
                          style={{ width: `${f.progress}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-text-muted mt-0.5">
                        {f.status === 'extracting' && '提取文本...'}
                        {f.status === 'chunking' && `向量化 ${f.progress}%`}
                        {f.status === 'uploading' && '准备中...'}
                      </p>
                    </div>
                  )}
                  {f.status === 'success' && f.chunksAdded !== undefined && (
                    <p className="text-[10px] text-success mt-0.5">{f.chunksAdded} 个文本块</p>
                  )}
                  {f.status === 'error' && f.message && (
                    <p className="text-[10px] text-danger mt-0.5">{f.message}</p>
                  )}
                </div>

                {f.status === 'pending' && !uploading && (
                  <button onClick={() => removeFile(i)} className="p-0.5 text-text-muted hover:text-danger transition-colors shrink-0">
                    <X size={12} />
                  </button>
                )}
                {(f.status === 'uploading' || f.status === 'extracting' || f.status === 'chunking') && (
                  <Loader2 size={14} className="animate-spin text-accent shrink-0" />
                )}
                {f.status === 'success' && (
                  <Check size={14} className="text-success shrink-0" />
                )}
                {f.status === 'error' && (
                  <XCircle size={14} className="text-danger shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center gap-3 mt-6">
        {!completed ? (
          <button
            onClick={handleUploadAll}
            disabled={uploading || files.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? '导入中...' : `导入 ${files.length} 个文件`}
          </button>
        ) : (
          <button
            onClick={handleDone}
            className="flex items-center gap-1.5 px-4 py-2 bg-success text-white text-sm font-medium rounded-lg hover:bg-success/90 transition-colors"
          >
            <Check size={14} />
            完成
          </button>
        )}

        {completed && files.some(f => f.status === 'error') && (
          <button
            onClick={() => { setCompleted(false); handleUploadAll() }}
            className="flex items-center gap-1.5 px-4 py-2 bg-bg border border-border text-text text-sm rounded-lg hover:bg-border/30 transition-colors"
          >
            <RefreshCw size={14} />
            重试失败项 ({errorCount})
          </button>
        )}
      </div>
    </div>
  )
}


// ── 创建连接器面板（非文件夹类型）────────────────

function CreateConnectorPanel({
  types,
  onCreated,
  onClose,
}: {
  types: ConnectorType[]
  onCreated: () => void
  onClose: () => void
}) {
  const [selectedType, setSelectedType] = useState<ConnectorType | null>(null)
  const [name, setName] = useState('')
  const [config, setConfig] = useState<Record<string, any>>({})
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSelectType = (t: ConnectorType) => {
    setSelectedType(t)
    setName('')
    setConfig({})
    setTestResult(null)
  }

  const handleTest = async () => {
    if (!selectedType) return
    setTesting(true)
    setTestResult(null)
    try {
      const r = await testConnectorAdhoc({ connector_type: selectedType.type, config })
      setTestResult(r)
    } catch {
      setTestResult({ success: false, message: '测试请求失败' })
    }
    setTesting(false)
  }

  const handleSave = async () => {
    if (!selectedType || !name.trim()) return
    setSaving(true)
    try {
      await createConnector({
        connector_type: selectedType.type,
        name: name.trim(),
        config,
      })
      toast.success('数据源创建成功')
      onCreated()
    } catch {
      toast.error('创建失败')
    }
    setSaving(false)
  }

  // 未选择类型: 显示类型列表
  if (!selectedType) {
    return (
      <div className="bg-surface border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-text">添加数据源</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text text-sm">取消</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {types.map(t => (
            <button
              key={t.type}
              onClick={() => handleSelectType(t)}
              className="flex items-start gap-3 p-4 bg-bg border border-border rounded-lg hover:border-accent/50 hover:bg-accent/5 transition-all text-left"
            >
              <span className="text-2xl">{t.icon}</span>
              <div>
                <div className="font-medium text-text text-sm">{t.display_name}</div>
                <div className="text-xs text-text-muted mt-0.5">{t.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // 已选择类型: 配置表单
  return (
    <div className="bg-surface border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedType(null)} className="text-text-muted hover:text-text text-sm">&larr;</button>
          <span className="text-2xl">{selectedType.icon}</span>
          <h3 className="text-base font-semibold text-text">配置 {selectedType.display_name}</h3>
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text text-sm">取消</button>
      </div>

      {/* 名称 */}
      <div className="mb-4">
        <label className="block text-sm text-text mb-1">数据源名称 <span className="text-danger">*</span></label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="例如：产品文档、客户数据库"
          className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* 动态配置表单 */}
      <ConfigForm
        fields={selectedType.config_fields}
        values={config}
        onChange={(k, v) => setConfig(prev => ({ ...prev, [k]: v }))}
      />

      {/* 测试结果 */}
      {testResult && (
        <div className={`mt-4 p-3 rounded-lg text-sm flex items-start gap-2 ${
          testResult.success ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
        }`}>
          {testResult.success ? <CheckCircle size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
          <span>{testResult.message}</span>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={handleTest}
          disabled={testing}
          className="flex items-center gap-1.5 px-4 py-2 bg-bg border border-border text-text text-sm rounded-lg hover:bg-border/30 transition-colors disabled:opacity-50"
        >
          {testing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          测试连接
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          保存数据源
        </button>
      </div>
    </div>
  )
}


// ── 连接器卡片 ────────────────────────────────

function ConnectorCard({
  connector,
  onSync,
  onDelete,
}: {
  connector: Connector
  onSync: (id: string) => void
  onDelete: (c: Connector) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [logs, setLogs] = useState<SyncLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  const Icon = CONNECTOR_ICONS[connector.connector_type] || Database
  const state = connector.sync_state
  const isSyncing = state?.last_sync_status === 'syncing'

  const handleToggleLogs = async () => {
    if (!expanded && logs.length === 0) {
      setLoadingLogs(true)
      try {
        const l = await fetchConnectorLogs(connector.id, 5)
        setLogs(l)
      } catch { /* ignore */ }
      setLoadingLogs(false)
    }
    setExpanded(!expanded)
  }

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        {/* 图标 */}
        <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center shrink-0">
          <Icon size={20} className="text-accent" />
        </div>

        {/* 信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-text text-sm truncate">{connector.name}</span>
            {!connector.enabled && (
              <span className="text-[10px] px-1.5 py-0.5 bg-border text-text-muted rounded">已禁用</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5">
            <span>{CONNECTOR_TYPE_LABELS[connector.connector_type] || connector.connector_type}</span>
            {state?.docs_total ? <span>{state.docs_total} 文档</span> : null}
            {state?.last_sync_at && (
              <span className="flex items-center gap-1">
                <Clock size={10} />
                {dayjs(state.last_sync_at).format('MM-DD HH:mm')}
              </span>
            )}
          </div>
        </div>

        {/* 状态 */}
        <div className="shrink-0">
          <StatusBadge
            status={state?.last_sync_status === 'success' ? 'success' :
                    state?.last_sync_status === 'failed' ? 'error' :
                    state?.last_sync_status === 'syncing' ? 'info' : 'default'}
            label={SYNC_STATUS_LABEL[state?.last_sync_status || 'idle'] || '未同步'}
          />
        </div>

        {/* 操作 */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onSync(connector.id)}
            disabled={isSyncing}
            className="p-1.5 text-text-muted hover:text-accent rounded transition-colors disabled:opacity-50"
            title="立即同步"
          >
            <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleToggleLogs}
            className="p-1.5 text-text-muted hover:text-text rounded transition-colors"
            title="同步日志"
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          <button
            onClick={() => onDelete(connector)}
            className="p-1.5 text-text-muted hover:text-danger rounded transition-colors"
            title="删除"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {state?.error_message && (
        <div className="px-4 pb-2">
          <div className="flex items-start gap-1.5 text-xs text-danger bg-danger/5 rounded px-2 py-1.5">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            <span className="break-all">{state.error_message}</span>
          </div>
        </div>
      )}

      {/* 同步日志展开 */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 bg-bg/50">
          <div className="text-xs font-medium text-text-muted mb-2">同步日志</div>
          {loadingLogs ? (
            <div className="text-xs text-text-muted">加载中...</div>
          ) : logs.length === 0 ? (
            <div className="text-xs text-text-muted">暂无同步记录</div>
          ) : (
            <div className="space-y-1.5">
              {logs.map(log => (
                <div key={log.id} className="flex items-center gap-2 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    log.status === 'success' ? 'bg-success' :
                    log.status === 'failed' ? 'bg-danger' : 'bg-warning'
                  }`} />
                  <span className="text-text-muted">{dayjs(log.started_at).format('MM-DD HH:mm')}</span>
                  <span className="text-text">
                    +{log.docs_added} / -{log.docs_deleted}
                  </span>
                  <span className="text-text-muted">{log.duration_seconds}s</span>
                  {log.errors.length > 0 && (
                    <span className="text-danger">{log.errors.length} 错误</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 主组件 ────────────────────────────────────

type CreateMode = 'none' | 'import' | 'connector'

export default function DataSources() {
  const [types, setTypes] = useState<ConnectorType[]>([])
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [loading, setLoading] = useState(true)
  const [createMode, setCreateMode] = useState<CreateMode>('none')
  const [deleteTarget, setDeleteTarget] = useState<Connector | null>(null)

  // 过滤掉 api 和 folder 类型（folder 用批量导入替代, api 移除）
  const connectorTypes = types.filter(t => t.type !== 'api' && t.type !== 'folder')

  const load = async () => {
    setLoading(true)
    try {
      const [t, c] = await Promise.all([fetchConnectorTypes(), fetchConnectors()])
      setTypes(t)
      setConnectors(c)
    } catch {
      // ignore
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSync = async (id: string) => {
    try {
      toast.loading('正在同步...', { id: 'sync' })
      const log = await syncConnector(id)
      if (log.status === 'success') {
        toast.success(`同步完成: +${log.docs_added} 文档`, { id: 'sync' })
      } else if (log.status === 'partial') {
        toast.success(`部分同步: +${log.docs_added}, ${log.errors.length} 错误`, { id: 'sync' })
      } else {
        toast.error(`同步失败: ${log.errors[0] || '未知错误'}`, { id: 'sync' })
      }
      load()
    } catch {
      toast.error('同步请求失败', { id: 'sync' })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteConnector(deleteTarget.id)
      setConnectors(prev => prev.filter(c => c.id !== deleteTarget.id))
      toast.success('已删除数据源')
    } catch {
      toast.error('删除失败')
    }
    setDeleteTarget(null)
  }

  if (loading) {
    return <div className="text-center py-8 text-text-muted text-sm">加载中...</div>
  }

  return (
    <div>
      {/* 创建面板 */}
      {createMode === 'import' && (
        <div className="mb-6">
          <BatchImportPanel
            onDone={() => load()}
            onClose={() => setCreateMode('none')}
          />
        </div>
      )}

      {createMode === 'connector' && (
        <div className="mb-6">
          <CreateConnectorPanel
            types={connectorTypes}
            onCreated={() => { setCreateMode('none'); load() }}
            onClose={() => setCreateMode('none')}
          />
        </div>
      )}

      {/* 添加按钮 */}
      {createMode === 'none' && (
        <div className="mb-4 flex items-center gap-2">
          {connectorTypes.length > 0 && (
            <button
              onClick={() => setCreateMode('connector')}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
            >
              <Plus size={16} />
              添加数据源
            </button>
          )}
        </div>
      )}

      {/* 连接器列表 */}
      {connectors.length === 0 && createMode === 'none' ? (
        <EmptyState
          variant="empty"
          title="暂无数据源"
          description="添加数据库连接，构建企业知识库"
        />
      ) : (
        <div className="space-y-3">
          {connectors.map(c => (
            <ConnectorCard
              key={c.id}
              connector={c}
              onSync={handleSync}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="确认删除"
        message={`确定要删除数据源「${deleteTarget?.name}」吗？关联的知识文档也将被清除。`}
        confirmLabel="删除"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
