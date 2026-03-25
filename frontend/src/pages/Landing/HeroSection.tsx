import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import AINetworkCanvas from './AINetworkCanvas'

const PILLS = [
  '岗位级 AI 助手',
  '工作流自动化',
  'AI 风险洞察',
  '越用越懂你',
]

const PARTICLES = Array.from({ length: 7 }, (_, i) => ({
  id: i,
  size: Math.random() * 6 + 3,
  x: Math.random() * 100,
  y: Math.random() * 100,
  duration: Math.random() * 8 + 12,
  delay: Math.random() * 5,
}))

export default function HeroSection() {
  const navigate = useNavigate()

  const scrollToContact = () => {
    const el = document.querySelector('#contact')
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0A0F14]">
      <div
        className="absolute inset-0 opacity-100"
        style={{
          backgroundImage: `
            linear-gradient(rgba(78,205,196,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(78,205,196,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(78,205,196,0.06) 0%, transparent 70%)',
          filter: 'blur(100px)',
        }}
      />

      {PARTICLES.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-[#4ECDC4]/20"
          style={{ width: p.size, height: p.size, left: `${p.x}%`, top: `${p.y}%` }}
          animate={{
            y: [0, -30, 0, 20, 0],
            x: [0, 15, -10, 5, 0],
            opacity: [0.2, 0.5, 0.3, 0.6, 0.2],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      <AINetworkCanvas className="absolute inset-0 z-[1]" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-white/10 bg-white/5 text-[#A0AEC0] text-sm"
        >
          <span className="w-2 h-2 rounded-full bg-[#4ECDC4] animate-pulse" />
          AI 驱动的智能工位平台
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight"
        >
          让 AI 成为你的{' '}
          <span className="bg-gradient-to-r from-[#4ECDC4] to-[#44B8A8] bg-clip-text text-transparent">
            工作搭档
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-lg md:text-xl text-[#A0AEC0] max-w-2xl mx-auto mt-6"
        >
          不是通用聊天机器人 — 而是懂你岗位、熟悉你业务、<br className="hidden md:block" />
          主动发现风险和机会的 AI 工作搭档
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="flex flex-wrap items-center justify-center gap-2 mt-8"
        >
          {PILLS.map((pill) => (
            <span
              key={pill}
              className="px-3 py-1 text-xs sm:text-sm text-[#A0AEC0] rounded-full border border-white/10 bg-white/5"
            >
              {pill}
            </span>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10"
        >
          <button
            onClick={() => navigate('/register')}
            className="px-8 py-3.5 text-base font-semibold bg-[#4ECDC4] text-[#0A0F14] rounded-xl hover:bg-[#45b8b0] transition-all hover:shadow-lg hover:shadow-[#4ECDC4]/20 flex items-center gap-2"
          >
            免费开始
            <span className="text-lg">&rarr;</span>
          </button>
          <button
            onClick={scrollToContact}
            className="px-8 py-3.5 text-base font-medium text-[#A0AEC0] border border-white/15 rounded-xl hover:border-white/30 hover:text-white transition-all"
          >
            预约演示
          </button>
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#111820] to-transparent" />
    </section>
  )
}
