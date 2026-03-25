import {
  Shield, ShieldAlert, ShieldCheck,
  Globe, HardDrive, Terminal, KeyRound, Database,
} from 'lucide-react'

interface Props {
  name: string
  nameZh: string
  description: string
  descriptionZh: string
  level?: string
  riskLevel?: string
  registryType?: string
  version?: string
  category?: string
  visible?: boolean
  actions?: React.ReactNode
}

const CATEGORY_LABELS: Record<string, { text: string; color: string }> = {
  document:  { text: '文档',   color: 'bg-blue-500/15 text-blue-400' },
  image:     { text: '图片',   color: 'bg-purple-500/15 text-purple-400' },
  audio:     { text: '音频',   color: 'bg-pink-500/15 text-pink-400' },
  web:       { text: '网络',   color: 'bg-cyan-500/15 text-cyan-400' },
  system:    { text: '系统',   color: 'bg-orange-500/15 text-orange-400' },
  data:      { text: '数据',   color: 'bg-teal-500/15 text-teal-400' },
  developer: { text: '开发',   color: 'bg-gray-500/15 text-gray-400' },
}

const LEVEL_LABELS: Record<string, { text: string; color: string }> = {
  builtin: { text: '内置', color: 'bg-emerald-500/15 text-emerald-400' },
  official: { text: '官方', color: 'bg-blue-500/15 text-blue-400' },
  trial: { text: '试用', color: 'bg-amber-500/15 text-amber-400' },
  temporary: { text: '临时', color: 'bg-gray-500/15 text-gray-400' },
}

const RISK_COLORS: Record<string, string> = {
  low: 'text-emerald-400',
  medium: 'text-amber-400',
  high: 'text-red-400',
}

const PERM_ICONS: Record<string, React.ReactNode> = {
  network: <Globe size={14} />,
  filesystem: <HardDrive size={14} />,
  system: <Terminal size={14} />,
  env: <KeyRound size={14} />,
  database: <Database size={14} />,
}

export function PermissionIcon({ perm }: { perm: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-text-muted" title={perm}>
      {PERM_ICONS[perm] || <Shield size={14} />}
    </span>
  )
}

export function RiskBadge({ level }: { level: string }) {
  const labels: Record<string, string> = { low: '低风险', medium: '中风险', high: '高风险' }
  const icons: Record<string, React.ReactNode> = {
    low: <ShieldCheck size={14} />,
    medium: <ShieldAlert size={14} />,
    high: <ShieldAlert size={14} />,
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${RISK_COLORS[level] || 'text-text-muted'}`}>
      {icons[level]}
      {labels[level] || level}
    </span>
  )
}

export default function ToolCard({
  name,
  nameZh,
  description,
  descriptionZh,
  level,
  riskLevel,
  registryType,
  version,
  category,
  visible,
  actions,
}: Props) {
  const lvl = level ? LEVEL_LABELS[level] : null
  const riskStr = riskLevel || undefined
  const cat = category ? CATEGORY_LABELS[category] : null

  return (
    <div className={`bg-surface border border-border rounded-lg p-4 hover:border-accent/40 transition-colors flex flex-col gap-2 ${
      visible === false ? 'opacity-60' : ''
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-text truncate">{nameZh || name}</h3>
            {cat && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cat.color}`}>
                {cat.text}
              </span>
            )}
            {lvl && !cat && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${lvl.color}`}>
                {lvl.text}
              </span>
            )}
            {registryType && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-hover text-text-muted">
                {registryType}
              </span>
            )}
            {version && (
              <span className="text-[10px] text-text-muted">v{version}</span>
            )}
          </div>
          {nameZh && nameZh !== name && (
            <p className="text-[11px] text-text-muted truncate mt-0.5">{name}</p>
          )}
        </div>
        {riskStr && <RiskBadge level={riskStr} />}
      </div>
      <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
        {descriptionZh || description}
      </p>
      {actions && <div className="mt-auto pt-2">{actions}</div>}
    </div>
  )
}
