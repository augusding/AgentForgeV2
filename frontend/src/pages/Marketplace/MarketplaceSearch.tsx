import { useState } from 'react'
import { useMarketplaceStore } from '../../stores/useMarketplaceStore'
import ToolCard from './ToolCard'
import { Search, Loader2, Download } from 'lucide-react'

export default function MarketplaceSearch() {
  const {
    searchResults, searchLoading, search,
    requestInstall, auditTarget,
  } = useMarketplaceStore()
  const [query, setQuery] = useState('')

  const handleSearch = () => {
    const q = query.trim()
    if (q) search(q)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="搜索 MCP 工具...（如 filesystem、github、slack）"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-9 pr-3 py-2 text-sm bg-surface border border-border rounded-lg text-text placeholder:text-text-muted focus:outline-none focus:border-accent/60 transition-colors"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={searchLoading || !query.trim()}
          className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
        >
          {searchLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          搜索
        </button>
      </div>

      {/* Results */}
      {searchLoading && searchResults.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-2 text-text-muted">
            <Loader2 size={24} className="animate-spin" />
            <span className="text-sm">正在搜索 MCP Registry...</span>
          </div>
        </div>
      )}

      {!searchLoading && searchResults.length === 0 && query && (
        <div className="text-center py-16 text-text-muted text-sm">
          未找到匹配的工具，请尝试其他关键词
        </div>
      )}

      {!searchLoading && searchResults.length === 0 && !query && (
        <div className="text-center py-16">
          <p className="text-text-muted text-sm">搜索 MCP 官方 Registry 中的 18,000+ 工具</p>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {['filesystem', 'github', 'slack', 'database', 'browser'].map((kw) => (
              <button
                key={kw}
                onClick={() => { setQuery(kw); search(kw) }}
                className="text-xs px-3 py-1.5 rounded-full bg-surface-hover text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
              >
                {kw}
              </button>
            ))}
          </div>
        </div>
      )}

      {searchResults.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {searchResults.map((srv, i) => (
            <ToolCard
              key={`${srv.name}-${i}`}
              name={srv.name}
              nameZh={srv.name_zh}
              description={srv.description}
              descriptionZh={srv.description_zh}
              version={srv.version}
              registryType={srv.packages[0]?.registry_type}
              actions={
                srv.packages.length > 0 ? (
                  <button
                    onClick={() => requestInstall(srv)}
                    disabled={auditTarget?.name === srv.name}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent/10 text-accent rounded-md hover:bg-accent/20 disabled:opacity-50 transition-colors"
                  >
                    <Download size={14} />
                    安装
                  </button>
                ) : (
                  <span className="block text-center text-[11px] text-text-muted py-1">
                    暂无可安装的包
                  </span>
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
