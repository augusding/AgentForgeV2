import { useConfigStore } from '../../stores/useConfigStore'
import { Check } from 'lucide-react'

const INDUSTRY_ICONS: Record<string, string> = {
  ecommerce: '🛒',
  internet: '💻',
  realestate: '🏠',
  education: '📚',
}

export default function ProfileSettings() {
  const { config, switchProfile } = useConfigStore()
  if (!config) return null

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-text mb-1">行业模板</h3>
        <p className="text-sm text-text-muted">选择适合你业务的行业模板，Agent 团队和工作流将根据行业自动配置</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {config.profiles.map(p => {
          const active = p.id === config.current_profile_id
          return (
            <button
              key={p.id}
              onClick={() => switchProfile(p.id)}
              className={`text-left p-5 rounded-lg border-2 transition-all ${
                active
                  ? 'border-accent bg-accent/5 shadow-sm'
                  : 'border-border bg-surface hover:border-primary/30'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{INDUSTRY_ICONS[p.industry] || '🏢'}</span>
                {active && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
                    <Check size={14} />
                    当前使用
                  </span>
                )}
              </div>
              <h4 className="text-sm font-semibold text-text">{p.name}</h4>
              <p className="text-xs text-text-muted mt-1">{p.description}</p>
              <div className="flex gap-4 mt-3 text-xs text-text-muted">
                <span>{p.agent_count} Agents</span>
                <span>{p.workflow_count} Workflows</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
