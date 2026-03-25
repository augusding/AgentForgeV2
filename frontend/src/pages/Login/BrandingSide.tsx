import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

const HIGHLIGHTS = [
  '多智能体协作',
  '自主规划执行',
  '持续学习进化',
]

// Floating particles for visual effect
const PARTICLES = Array.from({ length: 5 }, (_, i) => ({
  id: i,
  size: Math.random() * 4 + 2,
  x: Math.random() * 100,
  y: Math.random() * 100,
  duration: Math.random() * 8 + 12,
  delay: Math.random() * 5,
}))

export default function BrandingSide() {
  return (
    <div className="hidden lg:flex lg:w-[45%] relative bg-[#0A0F14] flex-col items-center justify-center p-12 overflow-hidden">
      {/* Grid background */}
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

      {/* Center glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(78,205,196,0.08) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      {/* Floating particles */}
      {PARTICLES.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-[#4ECDC4]/20"
          style={{ width: p.size, height: p.size, left: `${p.x}%`, top: `${p.y}%` }}
          animate={{
            y: [0, -20, 0, 15, 0],
            x: [0, 10, -8, 5, 0],
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

      {/* Content */}
      <div className="relative z-10 max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-[#4ECDC4] flex items-center justify-center">
            <span className="text-[#0A0F14] font-bold text-lg">AF</span>
          </div>
          <span className="text-white font-bold text-xl">AgentForge</span>
        </div>

        {/* Main heading */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-6"
        >
          让 AI 团队
          <br />
          <span className="text-[#4ECDC4]">为你工作</span>
        </motion.h1>

        {/* Highlights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-4 mb-10"
        >
          {HIGHLIGHTS.map((item) => (
            <div key={item} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[#4ECDC4]/10 flex items-center justify-center shrink-0">
                <Check size={14} className="text-[#4ECDC4]" />
              </div>
              <span className="text-[#A0AEC0] text-sm">{item}</span>
            </div>
          ))}
        </motion.div>

        {/* Social proof */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-[#4A5568] text-xs"
        >
          已有 200+ 家企业选择 AgentForge
        </motion.p>
      </div>
    </div>
  )
}
