import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, FileText, FileImage, FileSpreadsheet, File, Presentation } from 'lucide-react'
import type { SoloFileCard } from '../../types/chat'

interface Props {
  file: SoloFileCard
  onClose: () => void
}

/** 获取预览 URL（优先用 preview_url，否则从 url 推导） */
function getPreviewUrl(file: SoloFileCard): string {
  if (file.preview_url) return file.preview_url
  return file.url.replace('/files/download/', '/files/preview/')
}

/** 格式化文件大小 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

/** 根据文件类型选择图标 */
function getHeaderIcon(type: string) {
  const t = type.toLowerCase()
  if (t === 'pdf') return <FileText size={20} className="text-red-500 shrink-0" />
  if (['xlsx', 'xls', 'csv'].includes(t)) return <FileSpreadsheet size={20} className="text-green-600 shrink-0" />
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(t)) return <FileImage size={20} className="text-blue-500 shrink-0" />
  if (t === 'pptx') return <Presentation size={20} className="text-orange-500 shrink-0" />
  if (['docx', 'doc'].includes(t)) return <FileText size={20} className="text-blue-600 shrink-0" />
  return <File size={20} className="text-text-muted shrink-0" />
}

/** 判断文件预览渲染方式 */
function getPreviewMode(type: string): 'image' | 'iframe' {
  const t = type.toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(t)) return 'image'
  // 所有其他可预览类型都用 iframe（后端统一生成 HTML）
  return 'iframe'
}

export default function FilePreviewModal({ file, onClose }: Props) {
  const previewUrl = getPreviewUrl(file)
  const mode = getPreviewMode(file.type)

  // Escape 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // 阻止背景滚动
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* 背景遮罩 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-black/60"
          onClick={onClose}
        />

        {/* 弹窗主体 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative flex flex-col bg-bg rounded-xl shadow-2xl overflow-hidden"
          style={{ width: '90vw', height: '85vh', maxWidth: '1200px' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-surface shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {getHeaderIcon(file.type)}
              <span className="text-sm font-semibold text-text truncate">
                {file.filename}
              </span>
              <span className="text-[11px] text-text-muted px-1.5 py-0.5 bg-surface-hover rounded shrink-0">
                {file.type.toUpperCase()} · {formatSize(file.size)}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={file.url}
                download={file.filename}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition-colors"
              >
                <Download size={14} />
                下载
              </a>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden bg-neutral-100">
            {mode === 'image' ? (
              <div className="w-full h-full flex items-center justify-center p-4">
                <img
                  src={previewUrl}
                  alt={file.filename}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                />
              </div>
            ) : (
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title={`Preview: ${file.filename}`}
              />
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
