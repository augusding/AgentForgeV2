import { useEffect, useRef, useCallback } from 'react'

interface Props {
  className?: string
}

// Agent nodes configuration
const AGENT_NODES = [
  { id: 'ceo', label: 'CEO', x: 0.5, y: 0.5, size: 28, color: '#4ECDC4' },
  { id: 'analyst', label: 'AN', x: 0.25, y: 0.3, size: 18, color: '#4ECDC4' },
  { id: 'dev', label: 'DE', x: 0.75, y: 0.28, size: 18, color: '#4ECDC4' },
  { id: 'design', label: 'DS', x: 0.82, y: 0.55, size: 18, color: '#4ECDC4' },
  { id: 'market', label: 'MK', x: 0.7, y: 0.78, size: 18, color: '#4ECDC4' },
  { id: 'support', label: 'SP', x: 0.35, y: 0.8, size: 18, color: '#4ECDC4' },
  { id: 'ops', label: 'OP', x: 0.18, y: 0.6, size: 18, color: '#4ECDC4' },
  { id: 'data', label: 'DA', x: 0.42, y: 0.25, size: 18, color: '#4ECDC4' },
]

// Connections between nodes
const CONNECTIONS = [
  ['ceo', 'analyst'], ['ceo', 'dev'], ['ceo', 'design'],
  ['ceo', 'market'], ['ceo', 'support'], ['ceo', 'ops'], ['ceo', 'data'],
  ['analyst', 'data'], ['dev', 'design'], ['market', 'support'],
  ['ops', 'analyst'], ['data', 'dev'],
]

interface Particle {
  connIdx: number
  progress: number
  speed: number
  size: number
}

export default function AINetworkCanvas({ className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const nodesRef = useRef(
    AGENT_NODES.map((n) => ({
      ...n,
      // Floating motion params
      phaseX: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
      freqX: 0.3 + Math.random() * 0.4,
      freqY: 0.2 + Math.random() * 0.3,
      ampX: 8 + Math.random() * 12,
      ampY: 6 + Math.random() * 10,
      // Pulse
      pulsePhase: Math.random() * Math.PI * 2,
    }))
  )
  const particlesRef = useRef<Particle[]>(
    Array.from({ length: 20 }, () => ({
      connIdx: Math.floor(Math.random() * CONNECTIONS.length),
      progress: Math.random(),
      speed: 0.002 + Math.random() * 0.004,
      size: 1.5 + Math.random() * 2,
    }))
  )

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const dpr = window.devicePixelRatio || 1

    ctx.clearRect(0, 0, w, h)

    const nodes = nodesRef.current
    const t = time * 0.001

    // Compute current positions with floating motion
    const positions = nodes.map((n) => ({
      x: n.x * w / dpr + Math.sin(t * n.freqX + n.phaseX) * n.ampX,
      y: n.y * h / dpr + Math.cos(t * n.freqY + n.phaseY) * n.ampY,
    }))

    // Draw connections
    const nodeMap = new Map(nodes.map((n, i) => [n.id, i]))
    CONNECTIONS.forEach(([fromId, toId]) => {
      const fi = nodeMap.get(fromId)!
      const ti = nodeMap.get(toId)!
      const from = positions[fi]
      const to = positions[ti]
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.strokeStyle = 'rgba(78, 205, 196, 0.08)'
      ctx.lineWidth = 1
      ctx.stroke()
    })

    // Draw data flow particles
    const particles = particlesRef.current
    particles.forEach((p) => {
      p.progress += p.speed
      if (p.progress > 1) {
        p.progress = 0
        p.connIdx = Math.floor(Math.random() * CONNECTIONS.length)
        p.speed = 0.002 + Math.random() * 0.004
      }

      const conn = CONNECTIONS[p.connIdx]
      const fi = nodeMap.get(conn[0])!
      const ti = nodeMap.get(conn[1])!
      const from = positions[fi]
      const to = positions[ti]

      const px = from.x + (to.x - from.x) * p.progress
      const py = from.y + (to.y - from.y) * p.progress

      // Glow
      const gradient = ctx.createRadialGradient(px, py, 0, px, py, p.size * 3)
      gradient.addColorStop(0, 'rgba(78, 205, 196, 0.6)')
      gradient.addColorStop(1, 'rgba(78, 205, 196, 0)')
      ctx.beginPath()
      ctx.arc(px, py, p.size * 3, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()

      // Core
      ctx.beginPath()
      ctx.arc(px, py, p.size, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(78, 205, 196, 0.8)'
      ctx.fill()
    })

    // Draw nodes
    nodes.forEach((node, i) => {
      const pos = positions[i]
      const pulse = 1 + Math.sin(t * 2 + node.pulsePhase) * 0.15
      const r = node.size * pulse

      // Outer glow
      const glow = ctx.createRadialGradient(pos.x, pos.y, r * 0.5, pos.x, pos.y, r * 2.5)
      glow.addColorStop(0, 'rgba(78, 205, 196, 0.1)')
      glow.addColorStop(1, 'rgba(78, 205, 196, 0)')
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, r * 2.5, 0, Math.PI * 2)
      ctx.fillStyle = glow
      ctx.fill()

      // Ring
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(78, 205, 196, ${0.3 + Math.sin(t * 2 + node.pulsePhase) * 0.1})`
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Fill
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, r - 2, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(78, 205, 196, 0.05)'
      ctx.fill()

      // Label
      ctx.font = `${node.id === 'ceo' ? 'bold ' : ''}${Math.round(r * 0.55)}px system-ui, sans-serif`
      ctx.fillStyle = `rgba(78, 205, 196, ${0.7 + Math.sin(t * 2 + node.pulsePhase) * 0.1})`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(node.label, pos.x, pos.y)
    })

    animFrameRef.current = requestAnimationFrame(draw)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const parent = canvas.parentElement
      if (!parent) return
      const rect = parent.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = rect.width + 'px'
      canvas.style.height = rect.height + 'px'
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(dpr, dpr)
    }

    resize()

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas.parentElement!)

    // Visibility-based pause
    let visible = true
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
        if (visible && !animFrameRef.current) {
          animFrameRef.current = requestAnimationFrame(draw)
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(canvas)

    const tick = (time: number) => {
      if (!visible) {
        animFrameRef.current = 0
        return
      }
      draw(time)
    }
    animFrameRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      observer.disconnect()
      resizeObserver.disconnect()
    }
  }, [draw])

  return <canvas ref={canvasRef} className={className} />
}
