import { useMarketplaceStore } from '../../stores/useMarketplaceStore'
import { PermissionIcon, RiskBadge } from './ToolCard'
import {
  X, Loader2, ShieldCheck, AlertTriangle,
} from 'lucide-react'

const PERM_LABELS: Record<string, string> = {
  network: '网络访问',
  filesystem: '文件系统',
  system: '系统命令',
  env: '环境变量/密钥',
  database: '数据库',
}

export default function SecurityAuditDialog() {
  const {
    auditReport, auditTarget, auditLoading, installLoading,
    confirmInstall, cancelInstall,
  } = useMarketplaceStore()

  if (!auditTarget) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={cancelInstall} />

      {/* Dialog */}
      <div className="relative w-full max-w-md mx-4 bg-surface border border-border rounded-xl shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-accent" />
            <h3 className="text-sm font-semibold text-text">安全审查</h3>
          </div>
          <button onClick={cancelInstall} className="text-text-muted hover:text-text">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {auditLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-text-muted" />
            </div>
          )}

          {auditReport && !auditLoading && (
            <>
              {/* Tool info */}
              <div>
                <h4 className="text-sm font-medium text-text">
                  {auditTarget.name_zh || auditTarget.name}
                </h4>
                <p className="text-xs text-text-muted mt-0.5">
                  {auditReport.package_name} ({auditReport.registry_type})
                </p>
              </div>

              {/* Risk level */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-secondary">风险等级:</span>
                <RiskBadge level={auditReport.risk_level} />
                <div className="flex-1 h-2 rounded-full bg-surface-hover overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      auditReport.risk_level === 'low' ? 'bg-emerald-400 w-1/3' :
                      auditReport.risk_level === 'medium' ? 'bg-amber-400 w-2/3' :
                      'bg-red-400 w-full'
                    }`}
                  />
                </div>
              </div>

              {/* Permissions */}
              <div>
                <p className="text-xs text-text-secondary mb-2">需要的权限:</p>
                <div className="flex flex-wrap gap-2">
                  {auditReport.permissions.map((perm) => (
                    <span
                      key={perm}
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-surface-hover text-text-secondary"
                    >
                      <PermissionIcon perm={perm} />
                      {PERM_LABELS[perm] || perm}
                    </span>
                  ))}
                </div>
              </div>

              {/* Warnings */}
              {auditReport.warnings.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle size={14} className="text-amber-400" />
                    <span className="text-xs font-medium text-amber-400">注意</span>
                  </div>
                  {auditReport.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-300/80 mt-0.5">{w}</p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {auditReport && !auditLoading && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
            <button
              onClick={cancelInstall}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text rounded-lg hover:bg-surface-hover transition-colors"
            >
              取消
            </button>
            <button
              onClick={confirmInstall}
              disabled={installLoading}
              className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {installLoading && <Loader2 size={14} className="animate-spin" />}
              确认安装
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
