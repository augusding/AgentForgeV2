import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { lazy, Suspense } from 'react'
import { Download, Eye, FileText, FileSpreadsheet, FileImage, File } from 'lucide-react'

// Lazy-load rich renderers (only downloaded when first used)
const MindmapRenderer = lazy(() => import('./renderers/MindmapRenderer'))
const MermaidRenderer = lazy(() => import('./renderers/MermaidRenderer'))
const EChartsRenderer = lazy(() => import('./renderers/EChartsRenderer'))

const RICH_LANGUAGES = new Set(['mindmap', 'mermaid', 'echarts'])

function RichBlockFallback() {
  return (
    <div className="border border-border rounded-lg p-4 bg-surface animate-pulse">
      <div className="h-4 bg-surface-hover rounded w-1/3 mb-2" />
      <div className="h-40 bg-surface-hover rounded" />
    </div>
  )
}

interface Props {
  content: string
  className?: string
}

// 匹配裸露的下载链接 URL（非 markdown link 内部的）
const DOWNLOAD_URL_RE = /(?<!\[.*?]\()(?<!\()(\/api\/v1\/files\/download\/([^\s)]+))/g

/** 从文件名提取扩展名 */
function getExtFromFilename(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : ''
}

/** 根据扩展名选择图标 */
function getInlineFileIcon(ext: string) {
  switch (ext) {
    case 'pdf':
      return <FileText size={14} className="text-red-500 shrink-0" />
    case 'xlsx': case 'xls': case 'csv':
      return <FileSpreadsheet size={14} className="text-green-600 shrink-0" />
    case 'png': case 'jpg': case 'jpeg': case 'gif': case 'webp':
      return <FileImage size={14} className="text-blue-500 shrink-0" />
    default:
      return <File size={14} className="text-text-muted shrink-0" />
  }
}

/**
 * 预处理内容：将裸露的下载 URL 转换为 markdown 链接，
 * 这样 ReactMarkdown 能识别并走自定义 <a> 渲染。
 */
function preprocessDownloadLinks(content: string): string {
  return content.replace(DOWNLOAD_URL_RE, (_match, url, filename) => {
    const decodedName = decodeURIComponent(filename)
    return `[📥 ${decodedName}](${url})`
  })
}

/** 判断链接是否是文件下载链接 */
function isDownloadUrl(href: string | undefined): boolean {
  return !!href && href.includes('/api/v1/files/download/')
}

/** 从下载 URL 提取文件名 */
function extractFilename(href: string): string {
  const parts = href.split('/api/v1/files/download/')
  return parts[1] ? decodeURIComponent(parts[1]) : 'download'
}

/** 可预览的文件类型（后端统一生成 HTML 预览） */
const PREVIEWABLE_EXTS = [
  'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg',  // 原生
  'xlsx', 'xls', 'csv', 'docx', 'pptx',                 // Office
  'txt', 'json', 'yaml', 'yml', 'md', 'html', 'xml',    // 文本
  'log', 'ini', 'toml', 'py', 'js', 'ts',                // 代码
]

/** 从下载 URL 生成预览 URL */
function toPreviewUrl(href: string): string {
  return href.replace('/files/download/', '/files/preview/')
}

export default function MarkdownRenderer({ content, className = '' }: Props) {
  const processed = preprocessDownloadLinks(content)

  return (
    <div className={`prose prose-sm max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            // 下载链接 → 渲染为下载按钮（可预览类型额外显示预览按钮）
            if (isDownloadUrl(href)) {
              const filename = extractFilename(href || '')
              const ext = getExtFromFilename(filename)
              const canPreview = PREVIEWABLE_EXTS.includes(ext)

              return (
                <span className="not-prose inline-flex items-center gap-1.5 my-1">
                  {canPreview && (
                    <a
                      href={toPreviewUrl(href || '')}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-accent/30 bg-accent/5 text-accent text-sm font-medium no-underline hover:bg-accent/15 hover:border-accent/50 transition-all cursor-pointer"
                    >
                      <Eye size={13} className="shrink-0" />
                      预览
                    </a>
                  )}
                  <a
                    href={href}
                    download={filename}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 text-primary text-sm font-medium no-underline hover:bg-primary/15 hover:border-primary/50 transition-all cursor-pointer"
                  >
                    {getInlineFileIcon(ext)}
                    <span className="truncate max-w-[200px]">{filename}</span>
                    <Download size={13} className="shrink-0 ml-0.5" />
                  </a>
                </span>
              )
            }
            // 普通链接
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-info hover:underline">
                {children}
              </a>
            )
          },
          code: ({ className: cn, children, ...props }) => {
            const lang = cn?.replace('language-', '') || ''
            const text = String(children).replace(/\n$/, '')

            // Rich renderers: mindmap, mermaid, echarts
            if (RICH_LANGUAGES.has(lang)) {
              return (
                <Suspense fallback={<RichBlockFallback />}>
                  {lang === 'mindmap' && <MindmapRenderer content={text} />}
                  {lang === 'mermaid' && <MermaidRenderer content={text} />}
                  {lang === 'echarts' && <EChartsRenderer content={text} />}
                </Suspense>
              )
            }

            const isBlock = cn?.startsWith('language-')
            if (isBlock) {
              return (
                <pre className="bg-primary-dark text-slate-200 p-3 rounded-md overflow-x-auto font-mono text-xs">
                  <code>{children}</code>
                </pre>
              )
            }
            return (
              <code className="bg-surface-hover text-danger px-1 py-0.5 rounded text-xs font-mono" {...props}>
                {children}
              </code>
            )
          },
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="text-left px-3 py-2 bg-bg border-b border-border font-semibold text-xs">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-b border-border">{children}</td>
          ),
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  )
}
