import { useState, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { User, Cpu, Radio, Shield, Users, FileText, Download, Briefcase, Sparkles, Info, BookOpen, Brain } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import LoadingSpinner from '../../components/LoadingSpinner'
import { useConfigStore } from '../../stores/useConfigStore'
import { useAuthStore } from '../../stores/useAuthStore'
import ProfileSettings from './ProfileSettings'
import LLMSettings from './LLMSettings'
import ChannelSettings from './ChannelSettings'
import GuardrailSettings from './GuardrailSettings'
import UserManagement from './UserManagement'
import AuditLog from './AuditLog'
import DataExport from './DataExport'
import PositionManagement from './PositionManagement'
import SkillMarket from './SkillMarket'
import AboutSystem from './AboutSystem'
import PlaybookManagement from './PlaybookManagement'
import MemoryManagement from './MemoryManagement'

const BASE_TABS = [
  { id: 'profile', label: '行业模板', icon: User, path: '/settings/profile', adminOnly: false, superadminOnly: true },
  { id: 'positions', label: '岗位配置', icon: Briefcase, path: '/settings/positions', adminOnly: false, superadminOnly: false },
  { id: 'skills', label: 'Skill 市场', icon: Sparkles, path: '/settings/skills', adminOnly: false, superadminOnly: false },
  { id: 'llm', label: 'LLM 配置', icon: Cpu, path: '/settings/llm', adminOnly: true, superadminOnly: false },
  { id: 'channels', label: '通道管理', icon: Radio, path: '/settings/channels', adminOnly: false, superadminOnly: false },
  { id: 'guardrails', label: '安全护栏', icon: Shield, path: '/settings/guardrails', adminOnly: false, superadminOnly: false },
  { id: 'users', label: '用户管理', icon: Users, path: '/settings/users', adminOnly: true, superadminOnly: false },
  { id: 'audit', label: '操作日志', icon: FileText, path: '/settings/audit', adminOnly: true, superadminOnly: false },
  { id: 'export', label: '数据导出', icon: Download, path: '/settings/export', adminOnly: true, superadminOnly: false },
  { id: 'playbook', label: '经验规则', icon: BookOpen, path: '/settings/playbook', adminOnly: false, superadminOnly: false },
  { id: 'memory', label: 'AI 记忆', icon: Brain, path: '/settings/memory', adminOnly: false, superadminOnly: false },
  { id: 'about', label: '关于系统', icon: Info, path: '/settings/about', adminOnly: true, superadminOnly: false },
]

const TAB_COMPONENTS: Record<string, React.FC> = {
  profile: ProfileSettings,
  positions: PositionManagement,
  skills: SkillMarket,
  llm: LLMSettings,
  channels: ChannelSettings,
  guardrails: GuardrailSettings,
  users: UserManagement,
  audit: AuditLog,
  export: DataExport,
  playbook: PlaybookManagement,
  memory: MemoryManagement,
  about: AboutSystem,
}

export default function SettingsPage() {
  const location = useLocation()
  const nav = useNavigate()
  const { config, loading, load } = useConfigStore()
  const currentUser = useAuthStore(s => s.user)
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin'
  const isSuperadmin = currentUser?.role === 'superadmin'
  const TABS = useMemo(
    () => BASE_TABS.filter(t => {
      if (t.superadminOnly && !isSuperadmin) return false
      if (t.adminOnly && !isAdmin) return false
      return true
    }),
    [isAdmin, isSuperadmin],
  )

  // Determine active tab from URL (default to 'llm' if profile tab not available)
  const defaultTab = isSuperadmin ? 'profile' : isAdmin ? 'llm' : 'channels'
  const pathTab = location.pathname.split('/settings/')[1] || defaultTab
  const [activeTab, setActiveTab] = useState(pathTab)

  useEffect(() => {
    setActiveTab(pathTab)
  }, [pathTab])

  useEffect(() => {
    if (!config) load()
  }, [config, load])

  const handleTabClick = (tab: typeof TABS[number]) => {
    setActiveTab(tab.id)
    nav(tab.path)
  }

  if (loading || !config) {
    return (
      <div>
        <PageHeader title="系统设置" description="配置 Profile、LLM、通道与护栏" />
        <LoadingSpinner fullPage />
      </div>
    )
  }

  // Fallback to LLMSettings if active tab not in available tabs
  const validTab = TABS.some(t => t.id === activeTab) ? activeTab : defaultTab
  const ActiveComponent = TAB_COMPONENTS[validTab] || LLMSettings

  return (
    <div>
      <PageHeader title="系统设置" description="配置 Profile、LLM、通道与护栏" />

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar tabs */}
        <nav className="md:w-48 shrink-0">
          <div className="space-y-1">
            {TABS.map(tab => {
              const active = activeTab === tab.id
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                    active
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-text-muted hover:bg-bg hover:text-text'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <ActiveComponent />
        </div>
      </div>
    </div>
  )
}
