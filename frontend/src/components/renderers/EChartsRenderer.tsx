import { useEffect, useRef, useState, useCallback } from 'react'
import { Download, Maximize2, Minimize2 } from 'lucide-react'

interface Props {
  content: string
}

export default function EChartsRenderer({ content }: Props) {
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<any>(null)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const echarts = await import('echarts')
      if (cancelled || !chartRef.current) return

      try {
        const option = JSON.parse(content)
        if (instanceRef.current) {
          instanceRef.current.dispose()
        }
        const chart = echarts.init(chartRef.current)
        chart.setOption(option)
        instanceRef.current = chart
        setError('')
      } catch (e) {
        setError('图表配置解析失败')
      }
    })()
    return () => {
      cancelled = true
      if (instanceRef.current) {
        instanceRef.current.dispose()
        instanceRef.current = null
      }
    }
  }, [content])

  // Resize on expand/collapse
  useEffect(() => {
    if (instanceRef.current) {
      setTimeout(() => instanceRef.current?.resize(), 50)
    }
  }, [expanded])

  // Window resize
  useEffect(() => {
    const handleResize = () => instanceRef.current?.resize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleExportPNG = useCallback(() => {
    if (!instanceRef.current) return
    const dataUrl = instanceRef.current.getDataURL({ type: 'png', backgroundColor: '#fff', pixelRatio: 2 })
    const link = document.createElement('a')
    link.download = 'chart.png'
    link.href = dataUrl
    link.click()
  }, [])

  if (error) {
    return (
      <div className="border border-border rounded-lg p-4 bg-surface">
        <p className="text-xs text-danger mb-2">{error}</p>
        <pre className="text-xs text-text-muted font-mono whitespace-pre-wrap">{content}</pre>
      </div>
    )
  }

  return (
    <>
      {expanded && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setExpanded(false)} />
      )}
      <div className={`relative border border-border rounded-lg overflow-hidden bg-white ${expanded ? 'fixed inset-4 z-50 shadow-2xl' : ''}`}>
        <div ref={chartRef} className={expanded ? 'w-full h-full' : 'w-full h-[360px]'} />
        {/* Toolbar */}
        <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
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
        </div>
      </div>
    </>
  )
}
