import { useRef, useEffect, useState } from 'react'
import { useInView } from 'framer-motion'

const STATS = [
  { value: 14, suffix: '+', label: '岗位角色模板' },
  { value: 37, suffix: '+', label: '工作流节点类型' },
  { value: 9, suffix: '+', label: '风险洞察维度' },
  { value: 7, suffix: '', label: '企业数据源连接器' },
]

function AnimatedNumber({ target, suffix, started }: { target: number; suffix: string; started: boolean }) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (!started) return
    const duration = 2000
    const startTime = performance.now()

    function tick(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 4)
      setCurrent(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  }, [started, target])

  return (
    <span className="text-4xl md:text-5xl font-bold text-[#4ECDC4]">
      {current}{suffix}
    </span>
  )
}

export default function StatsBar() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })

  return (
    <section ref={ref} className="bg-[#111820] py-16 border-y border-white/5">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <AnimatedNumber target={stat.value} suffix={stat.suffix} started={isInView} />
              <div className="mt-2 text-sm text-[#718096]">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
