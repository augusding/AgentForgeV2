import { FileText, Image, Music } from 'lucide-react'
import type { FileAttachment } from '../../types/chat'

interface Props {
  attachment: FileAttachment
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

export default function AttachmentBadge({ attachment }: Props) {
  const { filename, file_type, size_bytes, preview_url } = attachment
  const Icon = typeIcons[file_type] || FileText

  // Image with clickable thumbnail
  if (file_type === 'image' && preview_url) {
    return (
      <a
        href={preview_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block rounded-md overflow-hidden border border-border hover:border-primary/40 transition-colors"
        title={filename}
      >
        <img
          src={preview_url}
          alt={filename}
          className="max-w-[180px] max-h-[120px] object-cover"
        />
      </a>
    )
  }

  // Document / audio badge
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-surface text-xs text-text-secondary">
      <Icon size={14} className="shrink-0" />
      <span className="truncate max-w-[150px]" title={filename}>{filename}</span>
      <span className="text-text-muted shrink-0">{formatSize(size_bytes)}</span>
    </div>
  )
}
