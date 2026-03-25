import { X, FileText, Image, Music, Loader2, AlertCircle } from 'lucide-react'
import type { FileAttachment } from '../../types/chat'

interface Props {
  attachment: FileAttachment
  onRemove: () => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

const typeIcons = {
  image: Image,
  document: FileText,
  audio: Music,
} as const

export default function AttachmentChip({ attachment, onRemove }: Props) {
  const { filename, file_type, size_bytes, preview_url, uploading, error } = attachment
  const Icon = typeIcons[file_type] || FileText

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs max-w-[200px] group
        ${error
          ? 'border-red-300 bg-red-50 text-red-700'
          : 'border-border bg-surface-hover text-text-secondary'
        }`}
    >
      {/* Left icon / thumbnail / spinner */}
      {uploading ? (
        <Loader2 size={14} className="animate-spin text-accent shrink-0" />
      ) : error ? (
        <AlertCircle size={14} className="text-red-500 shrink-0" />
      ) : file_type === 'image' && preview_url ? (
        <img
          src={preview_url}
          alt={filename}
          className="w-5 h-5 rounded-sm object-cover shrink-0"
        />
      ) : (
        <Icon size={14} className="shrink-0" />
      )}

      {/* Filename + size */}
      <span className="truncate" title={filename}>
        {filename}
      </span>
      {!uploading && !error && (
        <span className="text-text-muted shrink-0">{formatSize(size_bytes)}</span>
      )}
      {error && (
        <span className="truncate text-red-500" title={error}>
          {error}
        </span>
      )}

      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="ml-0.5 p-0.5 rounded hover:bg-border/50 opacity-60 hover:opacity-100 transition-opacity shrink-0"
        title="移除"
      >
        <X size={12} />
      </button>
    </div>
  )
}
