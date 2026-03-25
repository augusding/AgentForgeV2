import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, ChevronLeft, ChevronRight, CheckCircle2,
  MessageSquare, BarChart3, Users, Briefcase, Sparkles,
} from 'lucide-react'

// ── Industry Demo Data ───────────────────────────────────

interface IndustryDemo {
  id: string
  emoji: string
  name: string
  color: string
  agents: { name: string; role: string; color: string; emoji: string }[]
  command: string
  steps: { agent: string; task: string }[]
  results: {
    stats: { label: string; value: string; icon: string }[]
    bars: { label: string; value: number; color: string }[]
  }
}

const INDUSTRY_DEMOS: IndustryDemo[] = [
  {
    id: 'ecommerce',
    emoji: '🛒',
    name: '电商零售',
    color: '#4ECDC4',
    agents: [
      { name: 'CEO', role: '战略决策', color: '#8B5CF6', emoji: '👔' },
      { name: '选品经理', role: '市场选品', color: '#3B82F6', emoji: '🔍' },
      { name: '广告优化师', role: '投放优化', color: '#F43F5E', emoji: '📣' },
      { name: '客服专员', role: '客户沟通', color: '#F59E0B', emoji: '🎧' },
      { name: 'Listing专员', role: '产品上架', color: '#10B981', emoji: '📝' },
    ],
    command: '帮我分析这款新品的市场竞争力，并优化 Listing',
    steps: [
      { agent: '🔍 选品', task: '分析竞品数据' },
      { agent: '📝 Listing', task: '优化产品标题' },
      { agent: '📣 广告师', task: '制定投放策略' },
    ],
    results: {
      stats: [
        { label: '耗时', value: '2 分钟', icon: '⚡' },
        { label: '产出', value: '4 份报告', icon: '📄' },
        { label: '协作', value: '3 位 Agent', icon: '🤝' },
      ],
      bars: [
        { label: '市场洞察', value: 85, color: '#3B82F6' },
        { label: 'Listing评分', value: 92, color: '#10B981' },
        { label: '竞品分析', value: 78, color: '#F59E0B' },
        { label: '投放建议', value: 88, color: '#8B5CF6' },
      ],
    },
  },
  {
    id: 'hr-recruitment',
    emoji: '👥',
    name: '人力资源招聘',
    color: '#6366F1',
    agents: [
      { name: 'CHRO', role: '招聘决策', color: '#8B5CF6', emoji: '👔' },
      { name: '招聘专员', role: '简历筛选', color: '#3B82F6', emoji: '📋' },
      { name: '面试官', role: '能力评估', color: '#F43F5E', emoji: '🎯' },
      { name: '薪酬分析师', role: '薪资方案', color: '#10B981', emoji: '💰' },
      { name: 'HR助理', role: '流程协调', color: '#F59E0B', emoji: '📞' },
    ],
    command: '帮我筛选后端工程师候选人，安排面试并给出录用建议',
    steps: [
      { agent: '📋 招聘', task: '智能简历筛选' },
      { agent: '🎯 面试官', task: '能力模型匹配' },
      { agent: '💰 薪酬', task: '薪资方案制定' },
    ],
    results: {
      stats: [
        { label: '耗时', value: '3 分钟', icon: '⚡' },
        { label: '筛选', value: '50 份简历', icon: '📋' },
        { label: '推荐', value: '5 位候选人', icon: '⭐' },
      ],
      bars: [
        { label: '岗位匹配度', value: 91, color: '#6366F1' },
        { label: '技能覆盖率', value: 87, color: '#3B82F6' },
        { label: '文化契合度', value: 82, color: '#10B981' },
        { label: '薪资竞争力', value: 76, color: '#F59E0B' },
      ],
    },
  },
  {
    id: 'self-media',
    emoji: '📱',
    name: '自媒体运营',
    color: '#EC4899',
    agents: [
      { name: '主编', role: '内容策略', color: '#8B5CF6', emoji: '✏️' },
      { name: '文案师', role: '创意写作', color: '#EC4899', emoji: '📝' },
      { name: '视觉设计', role: '图文排版', color: '#3B82F6', emoji: '🎨' },
      { name: '数据分析', role: '运营分析', color: '#10B981', emoji: '📊' },
      { name: '社群运营', role: '粉丝互动', color: '#F59E0B', emoji: '💬' },
    ],
    command: '策划一期爆款内容，从选题到发布全流程执行',
    steps: [
      { agent: '📊 数据', task: '热点趋势分析' },
      { agent: '📝 文案', task: '爆款标题+正文' },
      { agent: '🎨 设计', task: '封面图+配图制作' },
    ],
    results: {
      stats: [
        { label: '耗时', value: '3 分钟', icon: '⚡' },
        { label: '产出', value: '1 套内容', icon: '📱' },
        { label: '协作', value: '4 位 Agent', icon: '🤝' },
      ],
      bars: [
        { label: '选题热度', value: 94, color: '#EC4899' },
        { label: '标题吸引力', value: 89, color: '#8B5CF6' },
        { label: '内容质量', value: 86, color: '#3B82F6' },
        { label: '传播预测', value: 82, color: '#10B981' },
      ],
    },
  },
  {
    id: 'internet-product',
    emoji: '💻',
    name: '互联网科技',
    color: '#3B82F6',
    agents: [
      { name: 'CEO', role: '产品决策', color: '#8B5CF6', emoji: '👔' },
      { name: '产品经理', role: '需求分析', color: '#3B82F6', emoji: '📋' },
      { name: '全栈工程师', role: '技术实现', color: '#10B981', emoji: '💻' },
      { name: 'QA工程师', role: '质量保障', color: '#F43F5E', emoji: '🔬' },
      { name: '增长负责人', role: '增长策略', color: '#F59E0B', emoji: '📈' },
    ],
    command: '规划并上线用户留存提升功能，包含 A/B 测试方案',
    steps: [
      { agent: '📋 产品', task: '需求拆解+PRD' },
      { agent: '💻 工程师', task: '技术方案设计' },
      { agent: '📈 增长', task: 'A/B 测试方案' },
    ],
    results: {
      stats: [
        { label: '耗时', value: '3 分钟', icon: '⚡' },
        { label: '产出', value: '3 份文档', icon: '📄' },
        { label: '协作', value: '4 位 Agent', icon: '🤝' },
      ],
      bars: [
        { label: '需求可行性', value: 90, color: '#3B82F6' },
        { label: '技术方案', value: 85, color: '#10B981' },
        { label: '测试覆盖', value: 88, color: '#F43F5E' },
        { label: '增长预测', value: 79, color: '#F59E0B' },
      ],
    },
  },
  {
    id: 'real-estate',
    emoji: '🏠',
    name: '房地产',
    color: '#F59E0B',
    agents: [
      { name: 'CEO', role: '经营决策', color: '#8B5CF6', emoji: '👔' },
      { name: '房源经纪', role: '房源管理', color: '#F59E0B', emoji: '🏠' },
      { name: '定价分析', role: '市场定价', color: '#3B82F6', emoji: '📊' },
      { name: '内容创作', role: '房源文案', color: '#10B981', emoji: '📝' },
      { name: '客户服务', role: '客户跟进', color: '#F43F5E', emoji: '📞' },
    ],
    command: '新房源上架：从市场定价到图文发布全流程处理',
    steps: [
      { agent: '📊 定价', task: '周边行情分析' },
      { agent: '📝 内容', task: '房源描述撰写' },
      { agent: '🏠 经纪', task: '多平台上架' },
    ],
    results: {
      stats: [
        { label: '耗时', value: '3 分钟', icon: '⚡' },
        { label: '产出', value: '定价+文案', icon: '📄' },
        { label: '协作', value: '3 位 Agent', icon: '🤝' },
      ],
      bars: [
        { label: '定价准确性', value: 88, color: '#F59E0B' },
        { label: '文案吸引力', value: 84, color: '#10B981' },
        { label: '市场覆盖', value: 91, color: '#3B82F6' },
        { label: '客户匹配', value: 79, color: '#8B5CF6' },
      ],
    },
  },
  {
    id: 'education',
    emoji: '📚',
    name: '教育培训',
    color: '#8B5CF6',
    agents: [
      { name: '教务主任', role: '教学管理', color: '#8B5CF6', emoji: '👔' },
      { name: '课程设计', role: '课程研发', color: '#3B82F6', emoji: '📖' },
      { name: '招生营销', role: '生源拓展', color: '#F43F5E', emoji: '📣' },
      { name: '内容创作', role: '教材制作', color: '#10B981', emoji: '✏️' },
      { name: '教学运营', role: '学员管理', color: '#F59E0B', emoji: '📊' },
    ],
    command: '设计一门 Python 入门课程，从大纲到招生方案全流程',
    steps: [
      { agent: '📖 课程', task: '课程大纲设计' },
      { agent: '✏️ 内容', task: '教材内容制作' },
      { agent: '📣 招生', task: '推广方案策划' },
    ],
    results: {
      stats: [
        { label: '耗时', value: '3 分钟', icon: '⚡' },
        { label: '产出', value: '课程方案', icon: '📖' },
        { label: '协作', value: '3 位 Agent', icon: '🤝' },
      ],
      bars: [
        { label: '课程完整性', value: 92, color: '#8B5CF6' },
        { label: '内容质量', value: 87, color: '#3B82F6' },
        { label: '市场吸引力', value: 83, color: '#F43F5E' },
        { label: '转化预测', value: 78, color: '#10B981' },
      ],
    },
  },
]

const SLIDES = [
  { title: '选择你的行业', subtitle: '根据你的业务领域，定制专属 AI 团队' },
  { title: '认识你的 AI 团队', subtitle: '每位 Agent 拥有独特的技能和专业能力' },
  { title: '下达指令，Agent 协作执行', subtitle: '自然语言下达任务，多 Agent 自动分工' },
  { title: '查看结果与洞察', subtitle: '实时追踪进度，获取完整执行报告' },
]

const SLIDE_DURATION = 6000 // 6s per slide

// ── Slide 1: Industry Select (Interactive) ──────────────

function SlideIndustry({
  selectedId,
  onSelect,
}: {
  selectedId: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">
        {INDUSTRY_DEMOS.map((ind, i) => {
          const selected = ind.id === selectedId
          return (
            <motion.button
              key={ind.id}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.4, type: 'spring', stiffness: 200 }}
              onClick={() => onSelect(ind.id)}
              className={`relative p-4 rounded-xl text-center transition-all cursor-pointer ${
                selected
                  ? 'border-2 border-accent bg-accent/5 shadow-md'
                  : 'border border-border bg-surface hover:border-accent/40 hover:shadow-sm'
              }`}
            >
              <span className="text-2xl block mb-1.5">{ind.emoji}</span>
              <span className="text-xs font-medium text-text leading-tight">{ind.name}</span>
              {selected && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className="absolute -top-1.5 -right-1.5"
                >
                  <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center shadow-md">
                    <CheckCircle2 size={12} className="text-white" />
                  </div>
                </motion.div>
              )}
            </motion.button>
          )
        })}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.0 }}
        className="text-xs text-accent font-medium mt-4 flex items-center gap-1"
      >
        <CheckCircle2 size={12} />
        已选择「{INDUSTRY_DEMOS.find(d => d.id === selectedId)?.name}」行业
      </motion.p>
    </div>
  )
}

// ── Slide 2: Meet Your Team (Radial Layout) ─────────────

function SlideTeam({ demo }: { demo: IndustryDemo }) {
  // 放射状布局: 中心为 hub, agents 围绕分布
  // 5 agents: top center + 4 corners (diamond pattern)
  const positions = [
    { top: 10, left: 50 },    // agent 0 (leader): top center
    { top: 85, left: 20 },    // agent 1: bottom-left
    { top: 85, left: 80 },    // agent 2: bottom-right
    { top: 160, left: 10 },   // agent 3: far bottom-left
    { top: 160, left: 90 },   // agent 4: far bottom-right
  ]

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[340px] h-[240px]">
        {/* Center hub */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring' }}
          className="absolute left-1/2 top-[55px] -translate-x-1/2 w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center z-10"
        >
          <Briefcase size={20} className="text-primary" />
        </motion.div>

        {/* Agent nodes */}
        {demo.agents.map((agent, i) => {
          const pos = positions[i] || positions[0]
          const delay = 0.3 + i * 0.2

          return (
            <motion.div
              key={`${demo.id}-${agent.name}`}
              initial={{ opacity: 0, y: 15, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay, duration: 0.4, type: 'spring' }}
              className="absolute flex flex-col items-center"
              style={{ top: `${pos.top}px`, left: `${pos.left}%`, transform: 'translateX(-50%)' }}
            >
              {/* Connection line to hub */}
              <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: delay + 0.15, duration: 0.25 }}
                className="w-px h-2 origin-top"
                style={{ backgroundColor: agent.color + '40' }}
              />
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-base shadow-sm border-2"
                style={{ backgroundColor: agent.color + '15', borderColor: agent.color + '40' }}
              >
                {agent.emoji}
              </div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: delay + 0.25 }}
                className="mt-1 text-center"
              >
                <p className="text-[11px] font-semibold text-text leading-tight">{agent.name}</p>
                <p className="text-[9px] text-text-muted">{agent.role}</p>
              </motion.div>
            </motion.div>
          )
        })}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6 }}
        className="text-xs text-text-muted mt-1"
      >
        {demo.agents.length} 位 AI Agent 各司其职，随时待命
      </motion.p>
    </div>
  )
}

// ── Slide 3: Command & Execute ────────────────────────────

function SlideExecution({ demo }: { demo: IndustryDemo }) {
  return (
    <div className="flex flex-col items-center max-w-md mx-auto">
      {/* User message bubble */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="self-end flex items-start gap-2 mb-5"
      >
        <div className="bg-primary text-white px-4 py-2.5 rounded-xl rounded-tr-sm text-sm max-w-[280px] shadow-sm">
          {demo.command}
        </div>
        <div className="shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
          你
        </div>
      </motion.div>

      {/* AI planning */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="self-start flex items-start gap-2 mb-4 w-full"
      >
        <div className="shrink-0 w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center">
          <Users size={14} className="text-accent" />
        </div>
        <div className="flex-1">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0 }}
            className="text-xs text-text-muted mb-3"
          >
            已拆解为 {demo.steps.length} 个子任务，分配给最合适的 Agent:
          </motion.p>

          <div className="space-y-2.5">
            {demo.steps.map((step, i) => {
              const delay = 1.4 + i * 0.4
              const duration = 1.2 - i * 0.2
              return (
                <motion.div
                  key={`${demo.id}-step-${i}`}
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay, duration: 0.3 }}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-bg border border-border"
                >
                  <span className="text-sm">{step.agent}</span>
                  <span className="text-xs text-text-muted flex-1">{step.task}</span>
                  <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
                    <motion.div
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ delay: delay + 0.3, duration, ease: 'easeInOut' }}
                      className="h-full rounded-full bg-accent"
                    />
                  </div>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: delay + 0.3 + duration, type: 'spring' }}
                  >
                    <CheckCircle2 size={14} className="text-green-500" />
                  </motion.div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ── Slide 4: Results & Insights ─────────────────────────

function SlideResults({ demo }: { demo: IndustryDemo }) {
  return (
    <div className="flex flex-col items-center max-w-md mx-auto">
      <div className="w-full p-5 rounded-xl border border-border bg-bg">
        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-3 gap-3 mb-5"
        >
          {demo.results.stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className="text-center p-2.5 rounded-lg bg-surface"
            >
              <span className="text-lg block">{stat.icon}</span>
              <p className="text-sm font-bold text-text">{stat.value}</p>
              <p className="text-[10px] text-text-muted">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Bar chart */}
        <div className="space-y-3">
          {demo.results.bars.map((bar, i) => {
            const delay = 0.6 + i * 0.2
            return (
              <motion.div
                key={bar.label}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay }}
                className="flex items-center gap-3"
              >
                <span className="text-xs text-text-muted w-16 text-right shrink-0">{bar.label}</span>
                <div className="flex-1 h-4 rounded-full bg-border/50 overflow-hidden">
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{ width: `${bar.value}%` }}
                    transition={{ delay: delay + 0.2, duration: 0.8, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: bar.color }}
                  />
                </div>
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: delay + 1 }}
                  className="text-xs font-semibold text-text w-8"
                >
                  {bar.value}%
                </motion.span>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Mission complete badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 2.0, type: 'spring', stiffness: 200 }}
        className="mt-5 flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 border border-green-200"
      >
        <Sparkles size={16} className="text-green-500" />
        <span className="text-sm font-medium text-green-700">任务完成</span>
        <CheckCircle2 size={16} className="text-green-500" />
      </motion.div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
}

export default function DemoWalkthrough({ open, onClose }: Props) {
  const [current, setCurrent] = useState(0)
  const [autoPlay, setAutoPlay] = useState(true)
  const [selectedIndustry, setSelectedIndustry] = useState(INDUSTRY_DEMOS[0].id)

  const demo = useMemo(
    () => INDUSTRY_DEMOS.find(d => d.id === selectedIndustry) || INDUSTRY_DEMOS[0],
    [selectedIndustry],
  )

  // Reset on open
  useEffect(() => {
    if (open) {
      setCurrent(0)
      setAutoPlay(true)
    }
  }, [open])

  // Auto-advance
  useEffect(() => {
    if (!open || !autoPlay) return
    const timer = setInterval(() => {
      setCurrent(prev => {
        if (prev >= SLIDES.length - 1) {
          setAutoPlay(false)
          return prev
        }
        return prev + 1
      })
    }, SLIDE_DURATION)
    return () => clearInterval(timer)
  }, [open, autoPlay, current])

  const [transitioning, setTransitioning] = useState(false)

  const goTo = useCallback((idx: number) => {
    if (transitioning) return
    setTransitioning(true)
    setCurrent(idx)
    setAutoPlay(false)
    setTimeout(() => setTransitioning(false), 400)
  }, [transitioning])

  const goPrev = useCallback(() => {
    if (transitioning) return
    setTransitioning(true)
    setCurrent(c => Math.max(0, c - 1))
    setAutoPlay(false)
    setTimeout(() => setTransitioning(false), 400)
  }, [transitioning])

  const goNext = useCallback(() => {
    if (transitioning) return
    if (current >= SLIDES.length - 1) {
      onClose()
    } else {
      setTransitioning(true)
      setCurrent(c => c + 1)
      setAutoPlay(false)
      setTimeout(() => setTransitioning(false), 400)
    }
  }, [current, onClose, transitioning])

  const handleIndustrySelect = useCallback((id: string) => {
    setSelectedIndustry(id)
    setAutoPlay(false)
  }, [])

  // Keyboard
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, goNext, goPrev, onClose])

  if (!open) return null

  const slide = SLIDES[current]

  const renderSlide = () => {
    switch (current) {
      case 0:
        return <SlideIndustry selectedId={selectedIndustry} onSelect={handleIndustrySelect} />
      case 1:
        return <SlideTeam demo={demo} />
      case 2:
        return <SlideExecution demo={demo} />
      case 3:
        return <SlideResults demo={demo} />
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative w-full max-w-2xl mx-4 bg-bg rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-surface hover:bg-surface-hover
                     flex items-center justify-center text-text-muted hover:text-text transition-colors"
        >
          <X size={16} />
        </button>

        {/* Step indicator */}
        <div className="px-8 pt-6 pb-2">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-xs font-medium text-accent">
              {current + 1} / {SLIDES.length}
            </span>
          </div>
        </div>

        {/* Slide header */}
        <div className="px-8 pb-4 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <h3 className="text-xl font-bold text-text mb-1">{slide.title}</h3>
              <p className="text-sm text-text-muted">{slide.subtitle}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Slide content */}
        <div className="px-8 pb-6 min-h-[340px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={current === 0 ? `slide-0` : `${current}-${selectedIndustry}`}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              {renderSlide()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-8 py-4 border-t border-border bg-surface/50">
          {/* Dots */}
          <div className="flex gap-2">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                  i === current
                    ? 'bg-accent scale-110'
                    : i < current
                    ? 'bg-accent/40'
                    : 'bg-border hover:bg-text-muted/40'
                }`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-2">
            {current > 0 && (
              <button
                onClick={goPrev}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-text-muted
                           hover:text-text rounded-lg hover:bg-surface-hover transition-colors"
              >
                <ChevronLeft size={14} />
                上一步
              </button>
            )}
            <button
              onClick={goNext}
              className={`flex items-center gap-1 px-4 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                current >= SLIDES.length - 1
                  ? 'bg-accent text-white hover:bg-accent/90'
                  : 'bg-primary text-white hover:bg-primary/90'
              }`}
            >
              {current >= SLIDES.length - 1 ? '开始使用' : '下一步'}
              {current < SLIDES.length - 1 && <ChevronRight size={14} />}
            </button>
          </div>
        </div>

        {/* Auto-play progress bar */}
        {autoPlay && (
          <motion.div
            key={`progress-${current}`}
            className="absolute bottom-0 left-0 h-0.5 bg-accent/60"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: SLIDE_DURATION / 1000, ease: 'linear' }}
          />
        )}
      </motion.div>
    </div>
  )
}
