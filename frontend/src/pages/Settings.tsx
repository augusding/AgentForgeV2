import { useState } from 'react'
import { User, Cpu, Briefcase, BarChart3, Brain, Server, FileText, TrendingUp, Puzzle, Search } from 'lucide-react'
import { useAuthStore } from '../stores/useAuthStore'
import ProfileTab from './settings/ProfileTab'
import LLMTab from './settings/LLMTab'
import PositionsTab from './settings/PositionsTab'
import UsageTab from './settings/UsageTab'
import MemoryTab from './settings/MemoryTab'
import SystemTab from './settings/SystemTab'
import LogsTab from './settings/LogsTab'
import TracesTab from './settings/TracesTab'
import EvolutionTab from './settings/EvolutionTab'

type TabId = 'profile' | 'llm' | 'positions' | 'usage' | 'memory' | 'system' | 'logs' | 'traces' | 'evolution' | 'skills'

interface TabDef { id: TabId; label: string; icon: any; desc: string; adminOnly?: boolean }

const TABS: TabDef[] = [
  { id: 'profile', label: '个人设置', icon: User, desc: '账号与密码' },
  { id: 'positions', label: '岗位管理', icon: Briefcase, desc: '岗位配置' },
  { id: 'usage', label: '用量统计', icon: BarChart3, desc: 'Token 与调用量' },
  { id: 'memory', label: 'AI 记忆', icon: Brain, desc: '偏好与习惯' },
  { id: 'evolution', label: '进化信号', icon: TrendingUp, desc: '质量分析' },
  { id: 'skills', label: '我的 Skill', icon: Puzzle, desc: '技能扩展' },
  { id: 'llm', label: 'LLM 配置', icon: Cpu, desc: 'AI 模型管理', adminOnly: true },
  { id: 'system', label: '系统信息', icon: Server, desc: '版本与状态', adminOnly: true },
  { id: 'logs', label: '系统日志', icon: FileText, desc: '运行日志', adminOnly: true },
  { id: 'traces', label: '请求追踪', icon: Search, desc: '全链路追踪', adminOnly: true },
]

const COMPS: Record<TabId, React.FC<{ isAdmin?: boolean }>> = {
  profile: ProfileTab, llm: LLMTab, positions: PositionsTab,
  usage: UsageTab, memory: MemoryTab, system: SystemTab, logs: LogsTab,
  traces: TracesTab, evolution: EvolutionTab, skills: SkillsPlaceholder,
}

function SkillsPlaceholder() {
  return (
    <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <Puzzle size={40} className="mx-auto mb-4" style={{ color: 'var(--border)' }} />
      <h3 className="text-base font-medium mb-2">我的 Skill</h3>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        自定义技能扩展，提升 AI 专业能力。
      </p>
      <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>即将推出</p>
    </div>
  )
}

export default function Settings() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin)
  const [tab, setTab] = useState<TabId>(visibleTabs[0]?.id || 'profile')
  const Content = COMPS[tab]

  return (
    <div className="flex h-full">
      {/* 侧边栏 */}
      <div className="w-[240px] shrink-0 border-r overflow-auto py-6 px-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <h1 className="text-base font-bold px-3 mb-2">设置</h1>
        <p className="text-[10px] px-3 mb-5" style={{ color: 'var(--text-muted)' }}>
          {isAdmin ? '管理员' : '成员'} · {user?.username}
        </p>

        {/* 分组渲染 */}
        <div className="space-y-1 mb-6">
          <p className="text-[9px] font-medium uppercase tracking-wider px-3 mb-2" style={{ color: 'var(--text-muted)' }}>个人</p>
          {visibleTabs.filter(t => !t.adminOnly).map(t => <TabButton key={t.id} tab={t} active={tab === t.id} onClick={() => setTab(t.id)} />)}
        </div>

        {isAdmin && (
          <div className="space-y-1">
            <p className="text-[9px] font-medium uppercase tracking-wider px-3 mb-2" style={{ color: 'var(--text-muted)' }}>管理</p>
            {visibleTabs.filter(t => t.adminOnly).map(t => <TabButton key={t.id} tab={t} active={tab === t.id} onClick={() => setTab(t.id)} />)}
          </div>
        )}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1000px] mx-auto p-8">
          <div className="flex items-center gap-3 mb-8">
            {(() => { const T = TABS.find(t => t.id === tab); const Icon = T?.icon || User; return (
              <>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent)15', color: 'var(--accent)' }}>
                  <Icon size={20} /></div>
                <div>
                  <h2 className="text-lg font-bold">{T?.label}</h2>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{T?.desc}</p>
                </div>
              </>
            ) })()}
          </div>
          <Content isAdmin={isAdmin} />
        </div>
      </div>
    </div>
  )
}

function TabButton({ tab, active, onClick }: { tab: TabDef; active: boolean; onClick: () => void }) {
  const Icon = tab.icon
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
      style={{
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? 'white' : 'var(--text-muted)',
      }}>
      <Icon size={16} />
      <div>
        <div className="text-xs font-medium">{tab.label}</div>
      </div>
    </button>
  )
}
