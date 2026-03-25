import { useEffect, useRef, useState, useCallback } from 'react'
import { Download, Maximize2, Minimize2 } from 'lucide-react'

interface Props {
  content: string
}

let mermaidInitialized = false

export default function MermaidRenderer({ content }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [svgContent, setSvgContent] = useState('')
  const [loading, setLoading] = useState(true)
  const idRef = useRef(`mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`)

  // 内容过短或为空 → 不渲染
  if (!content || content.trim().length < 10) {
    return null
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const mermaid = (await import('mermaid')).default
      if (!mermaidInitialized) {
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose',
          fontFamily: 'system-ui, sans-serif',
        })
        mermaidInitialized = true
      }
      if (cancelled) return
      try {
        const { svg } = await mermaid.render(idRef.current, content.trim())
        if (!cancelled) {
          // Fix SVG dimensions: some diagram types (mindmap, etc.) render with
          // incorrect width/height, causing a blank white box. Force 100% width.
          // 修复 SVG 尺寸: 宽度 100%，保留 height 但设为 auto 以防塌陷
          const fixed = svg
            .replace(/width="[\d.]+(?:px)?"/i, 'width="100%"')
            .replace(/height="[\d.]+(?:px)?"/i, 'height="auto"')
            // 确保 SVG 有 viewBox（防止白屏）
            .replace(/<svg([^>]*)>/, (match: string, attrs: string) => {
              if (/viewBox/i.test(attrs)) return match
              // 从 style 中提取原始尺寸作为 viewBox
              const wm = svg.match(/width="([\d.]+)/)
              const hm = svg.match(/height="([\d.]+)/)
              if (wm && hm) {
                return `<svg${attrs} viewBox="0 0 ${wm[1]} ${hm[1]}">`
              }
              return match
            })
          setSvgContent(fixed)
          setLoading(false)
        }
      } catch {
        // Fallback: show code
        if (!cancelled) { setSvgContent(''); setLoading(false) }
      }
    })()
    return () => { cancelled = true }
  }, [content])

  const handleExportPNG = useCallback(async () => {
    if (!containerRef.current) return
    const { toPng } = await import('html-to-image')
    const dataUrl = await toPng(containerRef.current, { backgroundColor: '#ffffff' })
    const link = document.createElement('a')
    link.download = 'flowchart.png'
    link.href = dataUrl
    link.click()
  }, [])

  const handleExportSVG = useCallback(() => {
    if (!svgContent) return
    const blob = new Blob([svgContent], { type: 'image/svg+xml' })
    const link = document.createElement('a')
    link.download = 'flowchart.svg'
    link.href = URL.createObjectURL(blob)
    link.click()
    URL.revokeObjectURL(link.href)
  }, [svgContent])

  if (loading) {
    return (
      <div className="border border-border rounded-lg p-4 bg-surface flex items-center gap-2 text-xs text-text-muted">
        <span className="w-3 h-3 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
        渲染图表中...
      </div>
    )
  }

  if (!svgContent) {
    return (
      <div className="border border-border rounded-lg p-4 bg-surface">
        <pre className="text-xs text-text-muted font-mono whitespace-pre-wrap">{content}</pre>
      </div>
    )
  }

  return (
    <>
    {expanded && <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setExpanded(false)} />}
    <div className={`relative border border-border rounded-lg overflow-hidden bg-white ${expanded ? 'fixed inset-4 z-50 shadow-2xl' : ''}`}>
      <div
        ref={containerRef}
        className={`flex items-center justify-center overflow-auto p-4 ${expanded ? 'h-full' : 'max-h-[500px] min-h-[100px]'}`}
        dangerouslySetInnerHTML={{ __html: svgContent }}
        style={{ minHeight: '100px' }}
      />
      {/* Toolbar */}
      <div className="absolute top-2 right-2 flex items-center gap-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 rounded-md bg-surface border border-border text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
          title={expanded ? '退出全屏' : '全屏'}
        >
          {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        <button
          onClick={handleExportPNG}
          className="p-1.5 rounded-md bg-surface border border-border text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
          title="下载 PNG"
        >
          <Download size={14} />
        </button>
        <button
          onClick={handleExportSVG}
          className="px-2 py-1 rounded-md bg-surface border border-border text-text-muted hover:text-text hover:bg-surface-hover transition-colors text-[11px] font-medium"
          title="下载 SVG"
        >
          SVG
        </button>
      </div>
    </div>
    </>
  )
}
