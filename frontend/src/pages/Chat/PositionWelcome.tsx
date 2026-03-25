import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  MessageSquare, Sparkles, BookOpen, Zap, Shield, FileText,
  BarChart3, Search, PenTool, Lightbulb, ChevronRight, ArrowRight,
  AlertCircle,
} from 'lucide-react'
import { useWorkstationStore } from '../../stores/useWorkstationStore'

interface Props {
  positionName: string
  personality: string
  knowledgeScope: string[]
  onboarding?: { tip: string; prompts: string[] }
  onSend: (content: string) => void
}

// ── Capability cards: readiness-aware ──

interface Capability {
  id: string
  icon: React.ReactNode
  title: string
  desc: string
  readyDesc: string
  example: string
  checkReady: (ctx: ReadinessContext) => boolean
  setupPath: string
  setupLabel: string
}

interface ReadinessContext {
  hasKnowledge: boolean
  hasWorkflows: boolean
}

const CAPABILITIES: Capability[] = [
  {
    id: 'doc',
    icon: <FileText size={18} />,
    title: '文档生成',
    desc: '报告、方案、邮件一键生成',
    readyDesc: '报告、方案、邮件一键生成',
    example: '帮我写一份本周的工作周报',
    checkReady: () => true, // 始终可用 — LLM 本身就能生成文档
    setupPath: '',
    setupLabel: '',
  },
  {
    id: 'data',
    icon: <BarChart3 size={18} />,
    title: '数据分析',
    desc: '上传数据，AI 帮你洞察趋势',
    readyDesc: '上传数据，AI 帮你洞察趋势',
    example: '分析这份数据中的关键趋势',
    checkReady: () => true, // 始终可用 — 用户可在聊天中上传文件
    setupPath: '',
    setupLabel: '',
  },
  {
    id: 'knowledge',
    icon: <Search size={18} />,
    title: '知识检索',
    desc: '上传企业文档后即可精准检索',
    readyDesc: '从企业知识库精准查找答案',
    example: '查一下我们的审批流程规范',
    checkReady: (ctx) => ctx.hasKnowledge,
    setupPath: '/knowledge',
    setupLabel: '前往上传',
  },
  {
    id: 'workflow',
    icon: <PenTool size={18} />,
    title: '流程执行',
    desc: '配置工作流后可自动化执行',
    readyDesc: '触发工作流，自动化重复任务',
    example: '帮我执行数据日报生成流程',
    checkReady: (ctx) => ctx.hasWorkflows,
    setupPath: '/workflows',
    setupLabel: '去配置',
  },
]

// ── Fallback suggestion (when YAML onboarding not configured) ──

const DEFAULT_SUGGESTION = {
  prompts: [
    '帮我制作一份本岗位的工作 SOP 模板，梳理核心流程和关键节点',
    '帮我设计一套个人工作效率提升方案，包含时间管理和优先级策略',
    '帮我搭建一份跨部门协作的沟通模板，确保信息同步高效',
  ],
  tip: '我是你的专属 AI 助手，帮你高效完成日常工作',
}

// ── Onboarding steps ──

interface Step {
  num: string
  title: string
  desc: string
  action?: { label: string; path: string }
}

const ONBOARDING_STEPS: Step[] = [
  { num: '1', title: '上传知识', desc: '让 AI 了解你的业务背景，回答更精准', action: { label: '前往知识库', path: '/knowledge' } },
  { num: '2', title: '试一个问题', desc: '从下方推荐问题开始，体验 AI 的专业能力', },
  { num: '3', title: '配置工作流', desc: '把重复工作交给自动化，专注高价值事务', action: { label: '查看工作流', path: '/workflows' } },
]

// ── Trust badges ──

const TRUST_ITEMS = [
  { icon: <Lightbulb size={13} />, text: '用得越多越懂你，主动发现风险与机会' },
  { icon: <Zap size={13} />, text: '自动识别高优事项，让你聚焦高价值工作' },
  { icon: <Shield size={13} />, text: '数据仅你可见，安全隔离' },
]

// ── Main Component ──

export default function PositionWelcome({ positionName, personality, knowledgeScope, onboarding, onSend }: Props) {
  const navigate = useNavigate()
  const suggestion = (onboarding?.prompts?.length)
    ? { tip: onboarding.tip, prompts: onboarding.prompts }
    : DEFAULT_SUGGESTION
  const [showOnboarding, setShowOnboarding] = useState(true)

  // Readiness detection
  const home = useWorkstationStore(s => s.home)
  const hasKnowledge = (knowledgeScope?.length ?? 0) > 0
  const hasWorkflows = (home?.quick_workflows?.length ?? 0) > 0
  const readiness: ReadinessContext = { hasKnowledge, hasWorkflows }

  return (
    <div className="flex items-start justify-center min-h-[60vh] py-6">
      <div className="max-w-2xl w-full px-4 space-y-6">

        {/* Hero: Position AI Assistant */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center mx-auto mb-3">
            <MessageSquare size={26} className="text-accent" />
          </div>
          <h2 className="text-xl font-bold text-text">
            {positionName} AI 助手
          </h2>
          {personality && (
            <p className="text-sm text-accent/80 mt-1">{personality}</p>
          )}
          <p className="text-xs text-text-muted mt-2 max-w-md mx-auto">
            {suggestion.tip}
          </p>
        </motion.div>

        {/* Capability cards: readiness-aware */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08 }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {CAPABILITIES.map((cap, i) => {
              const isReady = cap.checkReady(readiness)
              return (
                <motion.button
                  key={cap.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.1 + i * 0.04 }}
                  onClick={() => {
                    if (isReady) {
                      onSend(cap.example)
                    } else {
                      navigate(cap.setupPath)
                    }
                  }}
                  className={`group flex flex-col items-center gap-1.5 px-3 py-3.5 rounded-xl
                             border transition-all text-center ${
                    isReady
                      ? 'bg-surface border-border hover:border-accent/40 hover:bg-accent/5'
                      : 'bg-surface border-border/50 opacity-75 hover:opacity-100 hover:border-accent/30'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    isReady
                      ? 'bg-accent/10 group-hover:bg-accent/20 text-accent'
                      : 'bg-text-muted/10 group-hover:bg-accent/10 text-text-muted group-hover:text-accent'
                  }`}>
                    {cap.icon}
                  </div>
                  <div className="text-xs font-semibold text-text">{cap.title}</div>
                  <div className="text-[10px] text-text-muted leading-tight">
                    {isReady ? cap.readyDesc : cap.desc}
                  </div>
                  {!isReady && (
                    <span className="flex items-center gap-0.5 text-[9px] text-accent font-medium mt-0.5">
                      <AlertCircle size={9} />
                      {cap.setupLabel}
                    </span>
                  )}
                </motion.button>
              )
            })}
          </div>
        </motion.div>

        {/* Knowledge scope tags */}
        {knowledgeScope.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap justify-center gap-1.5"
          >
            <span className="text-[10px] text-text-muted mr-1 self-center">
              <BookOpen size={10} className="inline mr-0.5" />
              知识范围:
            </span>
            {knowledgeScope.slice(0, 6).map((k) => (
              <span
                key={k}
                className="text-[10px] px-2 py-0.5 rounded-full bg-accent/8 text-accent/70 border border-accent/15"
              >
                {k}
              </span>
            ))}
          </motion.div>
        )}

        {/* Quick start prompts */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <p className="text-xs text-text-muted text-center mb-2.5 flex items-center justify-center gap-1">
            <Sparkles size={12} className="text-accent/60" />
            针对你的岗位，推荐试试这些
          </p>
          <div className="space-y-1.5">
            {suggestion.prompts.map((prompt, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: 0.2 + i * 0.05 }}
                onClick={() => onSend(prompt)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg
                           border border-border bg-surface hover:bg-surface-hover hover:border-accent/30
                           text-sm text-text-secondary hover:text-text transition-all group"
              >
                <span className="group-hover:text-accent transition-colors">{prompt}</span>
                <ChevronRight size={14} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Onboarding guide (collapsible) */}
        {showOnboarding && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
            className="bg-surface border border-border rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-text flex items-center gap-1.5">
                <Lightbulb size={13} className="text-accent" />
                快速上手指南
              </h3>
              <button
                onClick={() => setShowOnboarding(false)}
                className="text-[10px] text-text-muted hover:text-text transition-colors"
              >
                收起
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {ONBOARDING_STEPS.map((step) => (
                <div
                  key={step.num}
                  className="flex flex-col gap-1.5 p-3 rounded-lg bg-bg"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-accent/15 text-accent text-[10px] font-bold flex items-center justify-center shrink-0">
                      {step.num}
                    </span>
                    <span className="text-xs font-medium text-text">{step.title}</span>
                  </div>
                  <p className="text-[10px] text-text-muted leading-relaxed pl-7">{step.desc}</p>
                  {step.action && (
                    <button
                      onClick={() => navigate(step.action!.path)}
                      className="self-start ml-7 mt-0.5 flex items-center gap-1 text-[10px] font-medium text-accent hover:text-accent/80 transition-colors"
                    >
                      {step.action.label}
                      <ArrowRight size={10} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Trust & reassurance */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="flex items-center justify-center gap-4 pt-1"
        >
          {TRUST_ITEMS.map((item, i) => (
            <div key={i} className="flex items-center gap-1 text-[10px] text-text-muted">
              <span className="text-accent/50">{item.icon}</span>
              {item.text}
            </div>
          ))}
        </motion.div>

      </div>
    </div>
  )
}
