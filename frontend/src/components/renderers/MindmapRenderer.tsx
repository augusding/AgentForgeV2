import { useEffect, useRef, useState, useCallback } from 'react'
import { Download, Maximize2, Minimize2 } from 'lucide-react'

interface Props {
  content: string
}

export default function MindmapRenderer({ content }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const mmRef = useRef<any>(null)

  // 内容过短或为空 → 不渲染
  if (!content || content.trim().length < 5) {
    return null
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { Transformer } = await import('markmap-lib')
      const { Markmap } = await import('markmap-view')
      if (cancelled || !svgRef.current) return

      const transformer = new Transformer()
      const { root } = transformer.transform(content)

      // Clear previous
      svgRef.current.innerHTML = ''
      const mm = Markmap.create(svgRef.current, {
        autoFit: false,
        duration: 0,   // instant render so fit() measures final node positions
        maxWidth: 280,
      }, root)
      mmRef.current = mm

      // Poll via rAF until the SVG container has real pixel dimensions, then fit
      const tryFit = () => {
        if (cancelled || !svgRef.current) return
        const { width, height } = svgRef.current.getBoundingClientRect()
        if (width > 0 && height > 0) {
          mm.fit()
          setLoaded(true)
        } else {
          requestAnimationFrame(tryFit)
        }
      }
      requestAnimationFrame(tryFit)
    })()
    return () => { cancelled = true }
  }, [content])

  // Refit on expand/collapse — wait for layout to settle
  useEffect(() => {
    if (!mmRef.current || !loaded) return
    const raf = requestAnimationFrame(() => mmRef.current.fit())
    return () => cancelAnimationFrame(raf)
  }, [expanded, loaded])

  const handleExportPNG = useCallback(async () => {
    if (!svgRef.current) return
    const { toPng } = await import('html-to-image')
    const dataUrl = await toPng(svgRef.current as unknown as HTMLElement, { backgroundColor: '#ffffff' })
    const link = document.createElement('a')
    link.download = 'mindmap.png'
    link.href = dataUrl
    link.click()
  }, [])

  const handleExportSVG = useCallback(() => {
    if (!svgRef.current) return
    const svgData = new XMLSerializer().serializeToString(svgRef.current)
    const blob = new Blob([svgData], { type: 'image/svg+xml' })
    const link = document.createElement('a')
    link.download = 'mindmap.svg'
    link.href = URL.createObjectURL(blob)
    link.click()
    URL.revokeObjectURL(link.href)
  }, [])

  return (
    <>
    {expanded && <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setExpanded(false)} />}
    <div className={`relative border border-border rounded-lg overflow-hidden bg-white ${expanded ? 'fixed inset-4 z-50 shadow-2xl' : ''}`}>
      <div ref={containerRef} className={expanded ? 'h-full' : 'h-[360px]'}>
        {!loaded && (
          <div className="absolute inset-0 flex items-center gap-2 justify-center text-xs text-gray-400">
            <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
            渲染思维导图中...
          </div>
        )}
        <svg ref={svgRef} className="w-full h-full" />
      </div>
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
