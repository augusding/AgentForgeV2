import { useState } from 'react'
import { User, Cpu, Briefcase, BarChart3, Brain, Server, FileText, TrendingUp } from 'lucide-react'
import ProfileTab from './settings/ProfileTab'
import LLMTab from './settings/LLMTab'
import PositionsTab from './settings/PositionsTab'
import UsageTab from './settings/UsageTab'
import MemoryTab from './settings/MemoryTab'
import SystemTab from './settings/SystemTab'
import LogsTab from './settings/LogsTab'
import EvolutionTab from './settings/EvolutionTab'

type TabId = 'profile' | 'llm' | 'positions' | 'usage' | 'memory' | 'system' | 'logs' | 'evolution'

const TABS: Array<{ id: TabId; label: string; icon: any; desc: string }> = [
  { id: 'profile', label: '个人设置', icon: User, desc: '账号信息与密码' },
  { id: 'llm', label: 'LLM 配置', icon: Cpu, desc: 'AI 模型与 API Key' },
  { id: 'positions', label: '岗位管理', icon: Briefcase, desc: '查看岗位配置' },
  { id: 'usage', label: '用量统计', icon: BarChart3, desc: 'Token 与调用量' },
  { id: 'memory', label: 'AI 记忆', icon: Brain, desc: '用户偏好与习惯' },
  { id: 'system', label: '系统信息', icon: Server, desc: '版本与运行状态' },
  { id: 'logs', label: '系统日志', icon: FileText, desc: '结构化运行日志' },
  { id: 'evolution', label: '进化信号', icon: TrendingUp, desc: '对话质量与配置建议' },
]

const COMPS: Record<TabId, React.FC> = {
  profile: ProfileTab, llm: LLMTab, positions: PositionsTab,
  usage: UsageTab, memory: MemoryTab, system: SystemTab, logs: LogsTab,
  evolution: EvolutionTab,
}

export default function Settings() {
  const [tab, setTab] = useState<TabId>('profile')
  const Content = COMPS[tab]

  return (
    <div className="flex h-full">
      <div className="w-[220px] shrink-0 border-r overflow-auto py-4 px-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <h1 className="text-sm font-bold px-3 mb-4">设置</h1>
        <div className="space-y-1">
          {TABS.map(t => {
            const Icon = t.icon; const on = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors"
                style={{ background: on ? 'var(--accent)15' : 'transparent', color: on ? 'var(--accent)' : 'var(--text-muted)' }}>
                <Icon size={16} />
                <div><div className="text-xs font-medium">{t.label}</div><div className="text-[9px] opacity-60">{t.desc}</div></div>
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6"><div className="max-w-[700px]"><Content /></div></div>
    </div>
  )
}
