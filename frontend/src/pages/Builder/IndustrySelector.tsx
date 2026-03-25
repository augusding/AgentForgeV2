/**
 * 行业选择卡片（Intake Round 1）
 *
 * 从 intake UI data 接收模板列表，用户选择后回调。
 */
import { useState } from 'react'
import {
  Users, GitBranch, Zap, Sparkles,
  ChevronRight, Check, FileText,
} from 'lucide-react'
import type { TemplateOption } from '../../types/builder'

interface Props {
  templates: TemplateOption[]
  onSelect: (industryId: string) => void
  onCustom: (description: string) => void
  disabled?: boolean
}

export default function IndustrySelector({ templates, onSelect, onCustom, disabled }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [showCustom, setShowCustom] = useState(false)
  const [customDesc, setCustomDesc] = useState('')

  const handleSelect = (id: string | null) => {
    if (disabled) return
    setSelected(id)
    if (id) {
      onSelect(id)
    } else {
      setShowCustom(true)
    }
  }

  const handleCustomSubmit = () => {
    if (customDesc.trim()) {
      onCustom(customDesc.trim())
    }
  }

  return (
    <div className="py-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 行业模板卡片 */}
        {templates.map(tmpl => (
          <button
            key={tmpl.id}
            onClick={() => handleSelect(tmpl.id)}
            disabled={disabled}
            className={`group text-left p-4 rounded-xl border-2 transition-all duration-200 ${
              selected === tmpl.id
                ? 'border-accent bg-accent/5 shadow-sm'
                : 'border-border bg-surface hover:border-accent/30 hover:bg-surface-hover'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-bg flex items-center justify-center text-lg shrink-0">
                {tmpl.icon || '📦'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-text">{tmpl.name}</h3>
                  {selected === tmpl.id && <Check size={14} className="text-accent" />}
                </div>
                <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{tmpl.description}</p>

                <div className="flex items-center gap-3 mt-2">
                  {tmpl.role_count != null && (
                    <span className="flex items-center gap-1 text-[11px] text-text-secondary">
                      <Users size={11} /> {tmpl.role_count} 角色
                    </span>
                  )}
                  {tmpl.workflow_count != null && (
                    <span className="flex items-center gap-1 text-[11px] text-text-secondary">
                      <GitBranch size={11} /> {tmpl.workflow_count} 流程
                    </span>
                  )}
                  {tmpl.skill_count != null && (
                    <span className="flex items-center gap-1 text-[11px] text-text-secondary">
                      <Zap size={11} /> {tmpl.skill_count} 技能
                    </span>
                  )}
                </div>

                {tmpl.tags && tmpl.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tmpl.tags.map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-accent/8 text-accent rounded">
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

        {/* 自定义行业 */}
        <button
          onClick={() => handleSelect(null)}
          disabled={disabled}
          className={`group text-left p-4 rounded-xl border-2 transition-all duration-200 ${
            showCustom
              ? 'border-accent bg-accent/5 shadow-sm'
              : 'border-border bg-surface hover:border-accent/30 hover:bg-surface-hover'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-bg flex items-center justify-center text-lg shrink-0">
              <Sparkles size={20} className="text-text-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-text">其他行业 / 自定义</h3>
              <p className="text-xs text-text-muted mt-0.5">
                通过对话式采集，完全定制你的 Agent 团队
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* 自定义行业描述输入 */}
      {showCustom && (
        <div className="mt-4 p-4 rounded-xl border border-border bg-surface">
          <label className="text-sm text-text-secondary flex items-center gap-1.5 mb-2">
            <FileText size={14} />
            请简单描述您的行业和业务
          </label>
          <textarea
            value={customDesc}
            onChange={e => setCustomDesc(e.target.value)}
            placeholder="例如：我们是做 SaaS 产品的，主要为中小企业提供…"
            rows={3}
            className="w-full resize-none bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
            disabled={disabled}
          />
          <button
            onClick={handleCustomSubmit}
            disabled={!customDesc.trim() || disabled}
            className="mt-2 px-4 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            继续
          </button>
        </div>
      )}
    </div>
  )
}
