import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Play, Clock, ChevronRight,
  Package, TrendingUp, MessageCircle, ClipboardList,
  GraduationCap, UserPlus, Rocket, Bug, CalendarRange,
  FileEdit, Home, Users, Shield, CheckCircle2
} from 'lucide-react'
import type { Scenario } from '../../types/scenario'
import type { Agent } from '../../types/agent'

const iconMap: Record<string, React.ComponentType<any>> = {
  'package': Package,
  'trending-up': TrendingUp,
  'message-circle': MessageCircle,
  'clipboard-list': ClipboardList,
  'graduation-cap': GraduationCap,
  'user-plus': UserPlus,
  'rocket': Rocket,
  'bug': Bug,
  'calendar-range': CalendarRange,
  'file-edit': FileEdit,
  'home': Home,
  'users': Users,
  'shield': Shield,
}

interface Props {
  scenario: Scenario
  agents: Agent[]
  onLaunch: (message: string) => void
  onClose: () => void
}

export default function ScenarioLauncher({ scenario, agents, onLaunch, onClose }: Props) {
  const [params, setParams] = useState<Record<string, string>>({ ...scenario.demo_parameters })

  const Icon = iconMap[scenario.icon] || Package

  // Build the agent chain for this scenario
  const agentChain = useMemo(() => {
    return scenario.agents_involved.map(agentId => {
      const agent = agents.find(a => a.id === agentId)
      return {
        id: agentId,
        name: agent?.name || agentId,
        role: agent?.role || '',
        initial: agent?.name?.charAt(0) || '?',
      }
    })
  }, [scenario.agents_involved, agents])

  // Parse context_briefing into numbered steps
  const briefingSteps = useMemo(() => {
    if (!scenario.context_briefing) return []
    return scenario.context_briefing
      .split('\n')
      .map(line => line.trim())
      .filter(line => /^\d+[\.\)\u3001]/.test(line))
      .map(line => line.replace(/^\d+[\.\)\u3001]\s*/, ''))
  }, [scenario.context_briefing])

  const handleUpdateParam = (key: string, value: string) => {
    setParams(prev => ({ ...prev, [key]: value }))
  }

  const handleLaunch = () => {
    // Build trigger message: workflow keyword + parameters
    const paramStr = Object.entries(params)
      .filter(([, v]) => v.trim())
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n')
    const message = paramStr ? `${scenario.name}\n${paramStr}` : scenario.name
    onLaunch(message)
  }

  // Friendly param labels
  const paramLabels: Record<string, string> = {
    product_name: '产品名称',
    target_market: '目标市场',
    customer_complaint: '客户投诉内容',
    category: '品类',
    course_name: '课程名称',
    course_type: '课程类型',
    student_name: '学员姓名',
    student_background: '学员背景',
    feature_name: '功能名称',
    feature_description: '功能描述',
    bug_description: 'Bug 描述',
    severity: '严重程度',
    sprint_goal: '迭代目标',
    team_capacity: '团队产能',
    content_topic: '内容主题',
    platform: '发布平台',
    property_address: '房源地址',
    property_type: '房源类型',
    tenant_requirements: '租客需求',
    budget_range: '预算范围',
    dispute_description: '争议描述',
    parties_involved: '涉及方',
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative bg-bg rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 pt-5 pb-4">
            <div
              className="shrink-0 w-11 h-11 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${scenario.color}15`, color: scenario.color }}
            >
              <Icon size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-text">{scenario.name}</h3>
              <p className="text-xs text-text-muted mt-0.5">{scenario.tagline}</p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-1.5 rounded-md hover:bg-surface-hover transition-colors text-text-muted hover:text-text"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-5">
            {/* Agent Chain */}
            <div>
              <h4 className="text-xs font-semibold text-text-secondary mb-2.5 uppercase tracking-wider">
                协作链路
              </h4>
              <div className="flex items-center flex-wrap gap-1">
                {agentChain.map((agent, idx) => (
                  <div key={agent.id} className="flex items-center">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface hover:bg-surface-hover transition-colors">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{ backgroundColor: `${scenario.color}20`, color: scenario.color }}
                      >
                        {agent.initial}
                      </div>
                      <div className="text-xs">
                        <span className="font-medium text-text">{agent.name}</span>
                      </div>
                    </div>
                    {idx < agentChain.length - 1 && (
                      <ChevronRight size={14} className="text-text-muted mx-0.5 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Context Briefing */}
            {briefingSteps.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-text-secondary mb-2.5 uppercase tracking-wider">
                  执行流程
                </h4>
                <div className="space-y-2">
                  {briefingSteps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-sm">
                      <span
                        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                        style={{ backgroundColor: `${scenario.color}15`, color: scenario.color }}
                      >
                        {idx + 1}
                      </span>
                      <span className="text-text-secondary leading-relaxed">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Parameters (Editable) */}
            {Object.keys(params).length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-text-secondary mb-2.5 uppercase tracking-wider">
                  场景参数
                </h4>
                <div className="space-y-2">
                  {Object.entries(params).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <label className="shrink-0 text-xs text-text-muted w-20 text-right">
                        {paramLabels[key] || key}
                      </label>
                      <input
                        type="text"
                        value={value}
                        onChange={e => handleUpdateParam(key, e.target.value)}
                        className="flex-1 px-2.5 py-1.5 text-sm bg-surface border border-border rounded-md
                                   focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20
                                   text-text placeholder:text-text-muted transition-colors"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expected Outputs */}
            <div>
              <h4 className="text-xs font-semibold text-text-secondary mb-2.5 uppercase tracking-wider">
                预期产出
              </h4>
              <div className="flex flex-wrap gap-2">
                {scenario.expected_outputs.map((output, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs
                               bg-success/10 text-success border border-success/20"
                  >
                    <CheckCircle2 size={11} />
                    {output}
                  </span>
                ))}
              </div>
            </div>

            {/* KPI Impact */}
            {scenario.kpi_impact && scenario.kpi_impact.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-text-secondary mb-2.5 uppercase tracking-wider">
                  业务价值
                </h4>
                <div className="space-y-1.5">
                  {scenario.kpi_impact.map((kpi, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-3 py-2 rounded-md bg-surface text-sm"
                    >
                      <span className={kpi.direction === 'up' ? 'text-success' : 'text-warning'}>
                        {kpi.direction === 'up' ? '↑' : '↓'}
                      </span>
                      <span className="text-text-secondary">{kpi.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer: Launch Button */}
          <div className="px-5 py-4 border-t border-border bg-bg">
            <button
              onClick={handleLaunch}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                         text-sm font-semibold text-white transition-all duration-200
                         hover:shadow-lg active:scale-[0.98]"
              style={{ backgroundColor: scenario.color }}
            >
              <Play size={16} fill="currentColor" />
              开始体验
              <span className="flex items-center gap-1 ml-1 opacity-80 text-xs font-normal">
                <Clock size={12} />
                约 {scenario.estimated_minutes} 分钟
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
