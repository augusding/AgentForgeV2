import { useMarketplaceStore } from '../../stores/useMarketplaceStore'
import BuiltinTools from './BuiltinTools'
import InstalledServers from './InstalledServers'
import MarketplaceSearch from './MarketplaceSearch'
import SecurityAuditDialog from './SecurityAuditDialog'
import { Wrench, Server, Store } from 'lucide-react'

const TABS = [
  { key: 'builtin' as const, label: '内置工具', icon: <Wrench size={16} /> },
  { key: 'installed' as const, label: '已安装', icon: <Server size={16} /> },
  { key: 'marketplace' as const, label: '工具市场', icon: <Store size={16} /> },
] as const

export default function Marketplace() {
  const { activeTab, setActiveTab, auditTarget, installedServers } = useMarketplaceStore()

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 pt-5 pb-0">
        <h1 className="text-lg font-bold text-text">工具市场</h1>
        <p className="text-xs text-text-muted mt-0.5">
          管理内置工具、已安装 MCP 工具，搜索并安装新工具
        </p>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 border-b border-border">
          {TABS.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === key
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-text'
              }`}
            >
              {icon}
              {label}
              {key === 'installed' && installedServers.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-hover text-text-muted ml-0.5">
                  {installedServers.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {activeTab === 'builtin' && <BuiltinTools />}
        {activeTab === 'installed' && <InstalledServers />}
        {activeTab === 'marketplace' && <MarketplaceSearch />}
      </div>

      {/* Security audit dialog */}
      {auditTarget && <SecurityAuditDialog />}
    </div>
  )
}
