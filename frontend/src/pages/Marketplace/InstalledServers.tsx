import { useEffect } from 'react'
import { useMarketplaceStore } from '../../stores/useMarketplaceStore'
import { RiskBadge } from './ToolCard'
import { Loader2, Power, Trash2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'

const STATUS_MAP: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  installed: { icon: <CheckCircle2 size={14} />, label: '已安装', color: 'text-emerald-400' },
  error: { icon: <XCircle size={14} />, label: '错误', color: 'text-red-400' },
  uninstalled: { icon: <AlertTriangle size={14} />, label: '已卸载', color: 'text-text-muted' },
}

export default function InstalledServers() {
  const {
    installedServers, installedLoading, loadInstalledServers,
    toggle, remove,
  } = useMarketplaceStore()

  useEffect(() => {
    loadInstalledServers()
  }, [])

  if (installedLoading && installedServers.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    )
  }

  if (installedServers.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-text-muted text-sm">还没有安装任何 MCP 工具</p>
        <p className="text-text-muted text-xs mt-1">
          前往"工具市场"搜索并安装你需要的工具
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {installedServers.map((srv) => {
        const status = STATUS_MAP[srv.status] || STATUS_MAP.installed
        return (
          <div
            key={srv.id}
            className="bg-surface border border-border rounded-lg px-4 py-3 flex items-center gap-4 hover:border-accent/30 transition-colors"
          >
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-semibold text-text truncate">
                  {srv.name_zh || srv.name}
                </h4>
                <span className={`inline-flex items-center gap-1 text-xs ${status.color}`}>
                  {status.icon} {status.label}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-hover text-text-muted">
                  {srv.registry_type}
                </span>
                {srv.security_report?.risk_level && (
                  <RiskBadge level={srv.security_report.risk_level} />
                )}
              </div>
              <p className="text-xs text-text-muted truncate mt-0.5">
                {srv.description_zh || srv.description || srv.package_identifier}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => toggle(srv.id, !srv.enabled)}
                className={`p-1.5 rounded-md transition-colors ${
                  srv.enabled
                    ? 'text-emerald-400 hover:bg-emerald-500/10'
                    : 'text-text-muted hover:bg-surface-hover'
                }`}
                title={srv.enabled ? '点击禁用' : '点击启用'}
              >
                <Power size={16} />
              </button>
              <button
                onClick={() => {
                  if (confirm('确定要卸载该工具吗？')) remove(srv.id)
                }}
                className="p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="卸载"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
