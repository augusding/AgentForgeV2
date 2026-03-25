import { useState } from 'react'
import { FileText, FileSpreadsheet, FileImage, File, Download, Eye, Maximize2, Presentation } from 'lucide-react'
import FilePreviewModal from './FilePreviewModal'
import type { SoloFileCard } from '../../types/chat'

interface Props {
  file: SoloFileCard
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

// ── 所有可预览的文件类型 ──
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']
const DOCUMENT_EXTS = ['pdf', 'docx', 'doc', 'pptx']
const SPREADSHEET_EXTS = ['xlsx', 'xls', 'csv']
const TEXT_EXTS = ['txt', 'json', 'yaml', 'yml', 'md', 'log', 'xml', 'ini', 'toml', 'py', 'js', 'ts', 'html']

const ALL_PREVIEWABLE = [...IMAGE_EXTS, ...DOCUMENT_EXTS, ...SPREADSHEET_EXTS, ...TEXT_EXTS]

/** 判断文件是否可预览 */
function isPreviewable(type: string): boolean {
  return ALL_PREVIEWABLE.includes(type.toLowerCase())
}

/** 判断是否是图片 */
function isImage(type: string): boolean {
  return IMAGE_EXTS.includes(type.toLowerCase())
}

/** 获取预览 URL */
function getPreviewUrl(file: SoloFileCard): string {
  if (file.preview_url) return file.preview_url
  return file.url.replace('/files/download/', '/files/preview/')
}

/** 获取文件左侧色条颜色 */
function getBorderColor(type: string): string {
  const t = type.toLowerCase()
  if (t === 'pdf') return 'border-l-red-400'
  if (['xlsx', 'xls', 'csv'].includes(t)) return 'border-l-green-500'
  if (['docx', 'doc'].includes(t)) return 'border-l-blue-500'
  if (t === 'pptx') return 'border-l-orange-400'
  if (['json', 'yaml', 'yml', 'xml'].includes(t)) return 'border-l-amber-400'
  if (['md', 'txt', 'log'].includes(t)) return 'border-l-slate-400'
  if (['py', 'js', 'ts', 'html'].includes(t)) return 'border-l-violet-400'
  return 'border-l-primary'
}

function getFileIcon(type: string, size: number = 18) {
  switch (type.toLowerCase()) {
    case 'pdf':
      return <FileText size={size} className="text-red-500" />
    case 'xlsx': case 'xls': case 'csv':
      return <FileSpreadsheet size={size} className="text-green-600" />
    case 'png': case 'jpg': case 'jpeg': case 'gif': case 'webp': case 'svg':
      return <FileImage size={size} className="text-blue-500" />
    case 'pptx':
      return <Presentation size={size} className="text-orange-500" />
    case 'docx': case 'doc':
      return <FileText size={size} className="text-blue-600" />
    case 'json': case 'yaml': case 'yml': case 'xml':
      return <FileText size={size} className="text-amber-500" />
    case 'md': case 'txt': case 'log':
      return <FileText size={size} className="text-slate-500" />
    case 'py': case 'js': case 'ts': case 'html':
      return <FileText size={size} className="text-violet-500" />
    default:
      return <File size={size} className="text-text-muted" />
  }
}

// ── 图片文件卡片：内联缩略图 ──
function ImageFileCard({ file, onPreview }: { file: SoloFileCard; onPreview: () => void }) {
  const previewUrl = getPreviewUrl(file)
  return (
    <div
      className="relative group rounded-lg overflow-hidden border border-white/10 bg-white/5 cursor-pointer hover:shadow-md transition-all"
      style={{ maxWidth: '320px' }}
      onClick={onPreview}
    >
      <img
        src={previewUrl}
        alt={file.filename}
        className="w-full max-h-[200px] object-cover"
        loading="lazy"
      />
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-white truncate">{file.filename}</p>
            <p className="text-[10px] text-white/70">{file.type.toUpperCase()} · {formatFileSize(file.size)}</p>
          </div>
          <Maximize2 size={14} className="text-white/80 shrink-0 ml-2" />
        </div>
      </div>
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-white/90 rounded-full p-2 shadow-lg">
            <Eye size={18} className="text-primary" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 可预览文件卡片（PDF / Excel / Word / PPT / 文本等）──
function PreviewableFileCard({ file, onPreview }: { file: SoloFileCard; onPreview: () => void }) {
  const borderColor = getBorderColor(file.type)
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border border-white/10 border-l-4 ${borderColor} bg-white/5 hover:bg-white/10 transition-colors`}>
      <div className="shrink-0">
        {getFileIcon(file.type, 24)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text truncate" title={file.filename}>{file.filename}</p>
        <p className="text-[11px] text-text-muted">
          {file.type.toUpperCase()} · {formatFileSize(file.size)}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onPreview}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors"
          title="预览"
        >
          <Eye size={12} />
          预览
        </button>
        <a
          href={file.url}
          download={file.filename}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors"
          onClick={(e) => e.stopPropagation()}
          title="下载"
        >
          <Download size={12} />
          下载
        </a>
      </div>
    </div>
  )
}

// ── 不可预览文件卡片（仅下载） ──
function DownloadOnlyCard({ file }: { file: SoloFileCard }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors">
      <div className="shrink-0">
        {getFileIcon(file.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text truncate">{file.filename}</p>
        <p className="text-[11px] text-text-muted">
          {file.type.toUpperCase()} · {formatFileSize(file.size)}
        </p>
      </div>
      <a
        href={file.url}
        download={file.filename}
        className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <Download size={12} />
        下载
      </a>
    </div>
  )
}

// ── 主组件 ──
export default function FileCard({ file }: Props) {
  const [showPreview, setShowPreview] = useState(false)
  const canPreview = isPreviewable(file.type)
  const imageFile = isImage(file.type)

  return (
    <>
      {imageFile ? (
        <ImageFileCard file={file} onPreview={() => setShowPreview(true)} />
      ) : canPreview ? (
        <PreviewableFileCard file={file} onPreview={() => setShowPreview(true)} />
      ) : (
        <DownloadOnlyCard file={file} />
      )}

      {showPreview && canPreview && (
        <FilePreviewModal file={file} onClose={() => setShowPreview(false)} />
      )}
    </>
  )
}
