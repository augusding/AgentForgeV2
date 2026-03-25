import { motion } from 'framer-motion'
import {
  Package, TrendingUp, MessageCircle, ClipboardList,
  GraduationCap, UserPlus, Rocket, Bug, CalendarRange,
  FileEdit, Home, Users, Shield, Clock, ArrowRight, PlayCircle
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
  scenarios: Scenario[]
  agents: Agent[]
  profileName?: string
  agentCount?: number
  onSelect: (scenario: Scenario) => void
  onOpenDemo?: () => void
}

export default function ScenarioWelcome({ scenarios, agents, profileName, agentCount, onSelect, onOpenDemo }: Props) {
  const getAgentAvatar = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId)
    return agent?.name?.charAt(0) || '?'
  }

  const getAgentName = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId)
    return agent?.name || agentId
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center mb-8"
      >
        <h2 className="text-xl font-bold text-text mb-2">
          你的 AI 团队已就位
        </h2>
        <p className="text-sm text-text-muted">
          {agentCount || agents.length} 位 AI Agent 随时待命{scenarios.length > 0 ? '，选择一个场景开始体验' : '，在下方输入框输入指令开始协作'}
        </p>
      </motion.div>

      {/* Agent roster (shown when no scenarios) */}
      {scenarios.length === 0 && agents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="w-full max-w-md mb-6"
        >
          <div className="flex flex-wrap justify-center gap-3">
            {agents.map((agent, idx) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.2 + idx * 0.08 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg border border-border"
              >
                <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-xs font-semibold text-accent">
                  {agent.name?.charAt(0) || '?'}
                </div>
                <span className="text-xs font-medium text-text">{agent.name}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Scenario Cards Grid */}
      {scenarios.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
          {scenarios.map((scenario, idx) => {
            const Icon = iconMap[scenario.icon] || Package
            return (
              <motion.button
                key={scenario.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                onClick={() => onSelect(scenario)}
                className="group text-left p-4 rounded-xl border border-border bg-bg
                           hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5
                           transition-all duration-200 cursor-pointer"
              >
                {/* Top: Icon + Name */}
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${scenario.color}15`, color: scenario.color }}
                  >
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-text group-hover:text-primary transition-colors">
                      {scenario.name}
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
                      {scenario.tagline}
                    </p>
                  </div>
                  <ArrowRight
                    size={16}
                    className="shrink-0 mt-1 text-text-muted opacity-0 group-hover:opacity-100
                               transform translate-x-0 group-hover:translate-x-1 transition-all"
                  />
                </div>

                {/* Agent Avatars */}
                <div className="flex items-center gap-1 mb-3">
                  <div className="flex -space-x-1.5">
                    {scenario.agents_involved.slice(0, 5).map((agentId) => (
                      <div
                        key={agentId}
                        className="w-6 h-6 rounded-full bg-surface-hover border-2 border-bg
                                   flex items-center justify-center text-[10px] font-medium text-text-muted"
                        title={getAgentName(agentId)}
                      >
                        {getAgentAvatar(agentId)}
                      </div>
                    ))}
                  </div>
                  <span className="text-[11px] text-text-muted ml-1.5">
                    {scenario.agents_involved.length} 人协作
                  </span>
                </div>

                {/* Bottom: Outputs + Time */}
                <div className="flex items-center justify-between text-[11px] text-text-muted">
                  <span>{scenario.expected_outputs.length} 项产出</span>
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    约 {scenario.estimated_minutes} 分钟
                  </span>
                </div>
              </motion.button>
            )
          })}
        </div>
      )}

      {/* Footer hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: scenarios.length > 0 ? 0.6 : 0.4 }}
        className="flex flex-col items-center gap-2 mt-6"
      >
        {scenarios.length > 0 && (
          <p className="text-xs text-text-muted">
            也可以直接在下方输入框输入任意指令
          </p>
        )}
        {onOpenDemo && (
          <button
            onClick={onOpenDemo}
            className="text-xs text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
          >
            <PlayCircle size={12} />
            观看系统演示
          </button>
        )}
      </motion.div>
    </div>
  )
}
