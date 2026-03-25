import { useState, useEffect, useMemo } from 'react'
import { useMarketplaceStore } from '../../stores/useMarketplaceStore'
import ToolCard from './ToolCard'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import type { ToolCategory } from '../../types/marketplace'

// ── 分类定义 ──────────────────────────────────────────────
const CATEGORIES: { key: ToolCategory | 'all'; label: string; icon: string }[] = [
  { key: 'all',       label: '全部',     icon: '📦' },
  { key: 'document',  label: '文档处理', icon: '📄' },
  { key: 'image',     label: '图片处理', icon: '🖼️' },
  { key: 'audio',     label: '音频处理', icon: '🎵' },
  { key: 'web',       label: '网络操作', icon: '🌐' },
  { key: 'system',    label: '系统工具', icon: '⚙️' },
  { key: 'data',      label: '数据分析', icon: '📊' },
]

export default function BuiltinTools() {
  const { builtinTools, builtinLoading, loadBuiltinTools } = useMarketplaceStore()
  const [activeCategory, setActiveCategory] = useState<ToolCategory | 'all'>('all')
  const [showDeveloper, setShowDeveloper] = useState(false)

  useEffect(() => {
    // 总是重新加载以获取最新的 category/visible 字段
    loadBuiltinTools()
  }, [])

  // 过滤工具
  const filteredTools = useMemo(() => {
    let tools = builtinTools

    // 隐藏 developer 工具（除非用户打开开关）
    if (!showDeveloper) {
      tools = tools.filter(t => t.visible !== false)
    }

    // 分类过滤
    if (activeCategory !== 'all') {
      tools = tools.filter(t => t.category === activeCategory)
    }

    return tools
  }, [builtinTools, activeCategory, showDeveloper])

  // 统计每个分类的可见工具数
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 }
    for (const t of builtinTools) {
      if (!showDeveloper && t.visible === false) continue
      counts.all = (counts.all || 0) + 1
      counts[t.category] = (counts[t.category] || 0) + 1
    }
    return counts
  }, [builtinTools, showDeveloper])

  // 隐藏工具计数
  const hiddenCount = useMemo(
    () => builtinTools.filter(t => t.visible === false).length,
    [builtinTools],
  )

  if (builtinLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    )
  }

  if (builtinTools.length === 0) {
    return (
      <div className="text-center py-16 text-text-muted text-sm">
        暂无内置工具信息
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── 分类标签栏 ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {CATEGORIES.map(cat => {
          const count = categoryCounts[cat.key] || 0
          const isActive = activeCategory === cat.key
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-surface-hover text-text-muted hover:text-text hover:bg-border/50'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              {count > 0 && (
                <span className={`ml-0.5 text-[10px] ${
                  isActive ? 'text-white/80' : 'text-text-muted'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── 工具网格 ── */}
      {filteredTools.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredTools.map((tool) => (
            <ToolCard
              key={tool.name}
              name={tool.name}
              nameZh={tool.name_zh}
              description={tool.description}
              descriptionZh={tool.description_zh}
              level={tool.level}
              riskLevel={tool.risk_level}
              category={tool.category}
              visible={tool.visible}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-text-muted text-sm">
          该分类下暂无工具
        </div>
      )}

      {/* ── 开发者工具开关 ── */}
      {hiddenCount > 0 && (
        <div className="flex items-center justify-center pt-2">
          <button
            onClick={() => setShowDeveloper(prev => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-muted hover:text-text transition-colors"
          >
            {showDeveloper ? <EyeOff size={13} /> : <Eye size={13} />}
            {showDeveloper ? '隐藏开发者工具' : `显示开发者工具 (${hiddenCount})`}
          </button>
        </div>
      )}
    </div>
  )
}
