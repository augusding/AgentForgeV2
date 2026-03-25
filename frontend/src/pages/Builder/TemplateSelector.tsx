/**
 * 行业模板选择器
 *
 * Builder 起始阶段的模板选择界面。
 * 用户可选择行业模板快速开始，或从空白开始自定义。
 */
import { useState, useEffect } from 'react'
import {
  LayoutTemplate, Users, GitBranch, Zap,
  ChevronRight, Check, Loader2, Sparkles,
} from 'lucide-react'
import { fetchTemplates, type IndustryTemplateSummary } from '../../api/templates'

interface Props {
  onSelect: (templateId: string | null) => void
  selected?: string | null
}

export default function TemplateSelector({ onSelect, selected }: Props) {
  const [templates, setTemplates] = useState<IndustryTemplateSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  useEffect(() => {
    fetchTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-text-muted" />
        <span className="ml-2 text-sm text-text-muted">加载模板...</span>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-base font-semibold text-text flex items-center gap-2">
          <LayoutTemplate size={18} className="text-accent" />
          选择行业模板
        </h2>
        <p className="text-sm text-text-muted mt-1">
          选择一个行业模板快速开始，或从空白开始完全自定义
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 空白模板 */}
        <button
          onClick={() => onSelect(null)}
          onMouseEnter={() => setHoveredId('blank')}
          onMouseLeave={() => setHoveredId(null)}
          className={`group text-left p-4 rounded-xl border-2 transition-all duration-200 ${
            selected === null
              ? 'border-accent bg-accent/5 shadow-sm'
              : hoveredId === 'blank'
                ? 'border-accent/40 bg-surface-hover'
                : 'border-border bg-surface hover:border-accent/30'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-bg flex items-center justify-center text-lg shrink-0">
              <Sparkles size={20} className="text-text-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-text">从空白开始</h3>
                {selected === null && (
                  <Check size={14} className="text-accent" />
                )}
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                通过对话式采集，完全定制你的 Agent 团队
              </p>
            </div>
            <ChevronRight
              size={16}
              className="text-text-muted shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </div>
        </button>

        {/* 行业模板 */}
        {templates.map(tmpl => (
          <button
            key={tmpl.id}
            onClick={() => onSelect(tmpl.id)}
            onMouseEnter={() => setHoveredId(tmpl.id)}
            onMouseLeave={() => setHoveredId(null)}
            className={`group text-left p-4 rounded-xl border-2 transition-all duration-200 ${
              selected === tmpl.id
                ? 'border-accent bg-accent/5 shadow-sm'
                : hoveredId === tmpl.id
                  ? 'border-accent/40 bg-surface-hover'
                  : 'border-border bg-surface hover:border-accent/30'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-bg flex items-center justify-center text-lg shrink-0">
                {tmpl.icon || '📦'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-text">{tmpl.name}</h3>
                  {selected === tmpl.id && (
                    <Check size={14} className="text-accent" />
                  )}
                </div>
                <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
                  {tmpl.description}
                </p>

                {/* Stats */}
                <div className="flex items-center gap-3 mt-2">
                  <span className="flex items-center gap-1 text-[11px] text-text-secondary">
                    <Users size={11} /> {tmpl.role_count} 角色
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-text-secondary">
                    <GitBranch size={11} /> {tmpl.workflow_count} 流程
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-text-secondary">
                    <Zap size={11} /> {tmpl.skill_count} 技能
                  </span>
                </div>

                {/* Tags */}
                {tmpl.tags && tmpl.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tmpl.tags.map(tag => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 text-[10px] bg-accent/8 text-accent rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <ChevronRight
                size={16}
                className="text-text-muted shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
