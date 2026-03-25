/**
 * Agent Review Card
 *
 * Builder 阶段生成的 Agent 以可视化卡片展示，支持：
 * - 角色名 + 头像 emoji + 性格标签
 * - 技能列表（星级展示）
 * - 核心信念（bullet points）
 * - 工作红线
 * - 权限范围
 * - 操作按钮：通过 / 修改（对话式）/ 重新生成
 */
import { useState } from 'react'
import {
  Check, Edit3, RefreshCw, ChevronDown, ChevronUp,
  Star, Shield, Brain, Sparkles, Users, Wrench,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────

export interface AgentSkillItem {
  skill: string
  level: number
}

export interface ParsedAgent {
  agent_id: string
  name: string
  squad?: string
  soul?: {
    essence?: string
    beliefs?: string[]
    vibe?: string
    boundaries?: string[]
  }
  rules?: {
    authority?: string[] | string
    methodology?: string
    collaboration?: string
  }
  identity?: {
    display_name?: string
    avatar_emoji?: string
    color?: string
    role_tag?: string
  }
  skills?: AgentSkillItem[]
  config?: {
    delegation?: { enabled?: boolean; can_access?: string[] }
    llm?: Record<string, unknown>
    memory?: Record<string, unknown>
  }
  capabilities?: {
    tools?: string[]
    permission_level?: number
  }
}

interface Props {
  agent: ParsedAgent
  status: 'pending' | 'approved' | 'modified' | 'regenerating'
  onApprove: (agentId: string) => void
  onRequestEdit: (agentId: string) => void
  onRegenerate: (agentId: string) => void
}

// ── Helpers ────────────────────────────────────────────

function StarRating({ level, max = 5 }: { level: number; max?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          size={12}
          className={i < level ? 'text-warning fill-warning' : 'text-text-muted/30'}
        />
      ))}
    </span>
  )
}

function SectionToggle({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-t border-border/50">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-text-secondary hover:text-text transition-colors"
      >
        {icon}
        {title}
        <span className="ml-auto">
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  )
}

const STATUS_CONFIG = {
  pending: { label: '待审核', cls: 'bg-warning/10 text-warning border-warning/30' },
  approved: { label: '已通过', cls: 'bg-success/10 text-success border-success/30' },
  modified: { label: '已修改', cls: 'bg-accent/10 text-accent border-accent/30' },
  regenerating: { label: '重新生成中...', cls: 'bg-surface text-text-muted border-border' },
}

// ── Main Component ─────────────────────────────────────

export default function AgentReviewCard({ agent, status, onApprove, onRequestEdit, onRegenerate }: Props) {
  const {
    agent_id,
    soul,
    identity,
    skills,
    rules,
    config,
    capabilities,
  } = agent

  const displayName = identity?.display_name || agent.name || agent_id
  const emoji = identity?.avatar_emoji || '🤖'
  const color = identity?.color || '#6366f1'
  const roleTag = identity?.role_tag || agent.squad || ''
  const statusCfg = STATUS_CONFIG[status]

  return (
    <div
      className="rounded-lg border border-border bg-surface overflow-hidden transition-shadow hover:shadow-md"
      style={{ borderTopColor: color, borderTopWidth: 3 }}
    >
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 flex items-start gap-3">
        {/* Avatar */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{ backgroundColor: color + '18' }}
        >
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-text truncate">{displayName}</h3>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${statusCfg.cls}`}>
              {statusCfg.label}
            </span>
          </div>
          {roleTag && (
            <span className="text-xs text-text-muted">{roleTag}</span>
          )}
          {soul?.essence && (
            <p className="text-xs text-text-secondary mt-1 line-clamp-2 leading-relaxed">
              {soul.essence.trim()}
            </p>
          )}
        </div>
      </div>

      {/* ── Skills ── */}
      {skills && skills.length > 0 && (
        <div className="px-4 pb-3">
          <div className="flex flex-wrap gap-2">
            {skills.map(sk => (
              <div
                key={sk.skill}
                className="flex items-center gap-1.5 text-xs bg-bg px-2 py-1 rounded-md border border-border/50"
              >
                <span className="text-text font-medium">{sk.skill.replace(/_/g, ' ')}</span>
                <StarRating level={sk.level} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Expandable Sections ── */}

      {/* Beliefs */}
      {soul?.beliefs && soul.beliefs.length > 0 && (
        <SectionToggle title="核心信念" icon={<Brain size={12} />} defaultOpen>
          <ul className="space-y-1">
            {soul.beliefs.map((b, i) => (
              <li key={i} className="text-xs text-text-secondary pl-3 relative before:content-[''] before:absolute before:left-0 before:top-[7px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-accent/40">
                {b.replace(/^["']|["']$/g, '')}
              </li>
            ))}
          </ul>
        </SectionToggle>
      )}

      {/* Vibe */}
      {soul?.vibe && (
        <SectionToggle title="气质风格" icon={<Sparkles size={12} />}>
          <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">
            {soul.vibe.trim()}
          </p>
        </SectionToggle>
      )}

      {/* Boundaries */}
      {soul?.boundaries && soul.boundaries.length > 0 && (
        <SectionToggle title="工作红线" icon={<Shield size={12} />}>
          <ul className="space-y-1">
            {soul.boundaries.map((b, i) => (
              <li key={i} className="text-xs text-danger/80 pl-3 relative before:content-[''] before:absolute before:left-0 before:top-[7px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-danger/40">
                {b.replace(/^["']|["']$/g, '')}
              </li>
            ))}
          </ul>
        </SectionToggle>
      )}

      {/* Authority / Methodology */}
      {rules && (
        <SectionToggle title="工作规则" icon={<Wrench size={12} />}>
          {rules.authority && (
            <div className="mb-2">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">权限</span>
              {Array.isArray(rules.authority) ? (
                <ul className="mt-1 space-y-0.5">
                  {rules.authority.map((a, i) => (
                    <li key={i} className="text-xs text-text-secondary">
                      {a.replace(/^["']|["']$/g, '')}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-text-secondary mt-1">{rules.authority}</p>
              )}
            </div>
          )}
          {rules.collaboration && (
            <div>
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">协作方式</span>
              <p className="text-xs text-text-secondary mt-1 whitespace-pre-line leading-relaxed">
                {rules.collaboration.trim()}
              </p>
            </div>
          )}
        </SectionToggle>
      )}

      {/* Delegation / Permissions */}
      {(config?.delegation || capabilities) && (
        <SectionToggle title="权限范围" icon={<Users size={12} />}>
          {config?.delegation && (
            <div className="mb-2">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                委派权限: {config.delegation.enabled ? '开启' : '关闭'}
              </span>
              {config.delegation.can_access && config.delegation.can_access.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {config.delegation.can_access.map(a => (
                    <span key={a} className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded">
                      {a}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {capabilities?.tools && capabilities.tools.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">可用工具</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {capabilities.tools.map(t => (
                  <span key={t} className="text-[10px] bg-surface-hover text-text-secondary px-1.5 py-0.5 rounded">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </SectionToggle>
      )}

      {/* ── Action Buttons ── */}
      {status === 'pending' && (
        <div className="px-4 py-3 bg-bg/50 border-t border-border/50 flex items-center gap-2">
          <button
            onClick={() => onApprove(agent_id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-success rounded-md hover:bg-success/90 transition-colors"
          >
            <Check size={13} /> 通过
          </button>
          <button
            onClick={() => onRequestEdit(agent_id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent bg-accent/10 border border-accent/20 rounded-md hover:bg-accent/20 transition-colors"
          >
            <Edit3 size={13} /> 修改
          </button>
          <button
            onClick={() => onRegenerate(agent_id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary bg-surface-hover border border-border rounded-md hover:bg-surface transition-colors ml-auto"
          >
            <RefreshCw size={13} /> 重新生成
          </button>
        </div>
      )}

      {status === 'approved' && (
        <div className="px-4 py-2.5 bg-success/5 border-t border-success/20 flex items-center gap-2 text-xs text-success font-medium">
          <Check size={14} /> 已审核通过
        </div>
      )}

      {status === 'regenerating' && (
        <div className="px-4 py-2.5 bg-bg/50 border-t border-border/50 flex items-center gap-2 text-xs text-text-muted">
          <RefreshCw size={14} className="animate-spin" /> 正在重新生成...
        </div>
      )}
    </div>
  )
}

// ── YAML Parser Utility ────────────────────────────────

/**
 * 将 YAML 字符串解析为 ParsedAgent 对象。
 * 在 Builder 上下文中，preview.agents 存储的是 YAML 字符串，
 * 需要解析后才能渲染为卡片。
 *
 * 注：使用简单的 YAML 解析（前端依赖 js-yaml 或 yaml 包）。
 * 如果未安装 YAML 解析器，回退到正则提取关键字段。
 */
export function parseAgentYaml(yamlStr: string): ParsedAgent | null {
  try {
    // 尝试使用动态 import 的 yaml 解析
    // 由于前端可能已有 yaml 依赖，我们使用简单的 JSON-style 解析
    return parseAgentYamlFallback(yamlStr)
  } catch {
    return null
  }
}

function parseAgentYamlFallback(yaml: string): ParsedAgent {
  const lines = yaml.split('\n')
  const agent: ParsedAgent = { agent_id: '', name: '' }

  // Simple key extraction
  const getSimple = (key: string): string => {
    const line = lines.find(l => l.match(new RegExp(`^${key}:\\s*`)))
    if (!line) return ''
    return line.replace(new RegExp(`^${key}:\\s*`), '').replace(/^["']|["']$/g, '').trim()
  }

  agent.agent_id = getSimple('agent_id')
  agent.name = getSimple('name')
  agent.squad = getSimple('squad')

  // Parse blocks — we'll use a simplified approach for key sections
  const getBlock = (startPattern: string, endPatterns: string[]): string => {
    let collecting = false
    let indent = 0
    const result: string[] = []

    for (const line of lines) {
      if (line.match(new RegExp(`^${startPattern}:`))) {
        collecting = true
        indent = line.search(/\S/)
        continue
      }
      if (collecting) {
        // Stop if we hit a line at same or lower indent that's a new key
        if (line.trim() && !line.startsWith(' '.repeat(indent + 1)) && !line.startsWith('\t')) {
          if (endPatterns.some(p => line.match(new RegExp(`^${p}:`)))) break
          if (line.search(/\S/) <= indent && line.trim().endsWith(':')) break
        }
        result.push(line)
      }
    }
    return result.join('\n')
  }

  // Parse soul section
  const soulBlock = getBlock('soul', ['rules', 'identity', 'skills', 'config'])
  if (soulBlock) {
    agent.soul = {
      essence: extractMultilineValue(soulBlock, 'essence'),
      beliefs: extractListValues(soulBlock, 'beliefs'),
      vibe: extractMultilineValue(soulBlock, 'vibe'),
      boundaries: extractListValues(soulBlock, 'boundaries'),
    }
  }

  // Parse rules
  const rulesBlock = getBlock('rules', ['identity', 'skills', 'config'])
  if (rulesBlock) {
    agent.rules = {
      authority: extractListValues(rulesBlock, 'authority'),
      methodology: extractMultilineValue(rulesBlock, 'methodology'),
      collaboration: extractMultilineValue(rulesBlock, 'collaboration'),
    }
  }

  // Parse identity
  const identBlock = getBlock('identity', ['skills', 'config', 'capabilities'])
  if (identBlock) {
    agent.identity = {
      display_name: extractInlineValue(identBlock, 'display_name'),
      avatar_emoji: extractInlineValue(identBlock, 'avatar_emoji'),
      color: extractInlineValue(identBlock, 'color'),
      role_tag: extractInlineValue(identBlock, 'role_tag'),
    }
  }

  // Parse skills
  const skillLines = yaml.match(/-\s*skill:\s*["']?(\w+)["']?\s*\n\s+level:\s*(\d)/g)
  if (skillLines) {
    agent.skills = skillLines.map(s => {
      const skillMatch = s.match(/skill:\s*["']?(\w+)["']?/)
      const levelMatch = s.match(/level:\s*(\d)/)
      return {
        skill: skillMatch?.[1] || '',
        level: parseInt(levelMatch?.[1] || '1'),
      }
    })
  }

  // Parse config.delegation
  const delegEnabled = yaml.match(/delegation:\s*\n\s+enabled:\s*(true|false)/)
  const canAccess = yaml.match(/can_access:\s*\n((?:\s+-\s*["']?\w[\w-]*["']?\s*\n?)+)/)
  if (delegEnabled || canAccess) {
    agent.config = {
      delegation: {
        enabled: delegEnabled?.[1] === 'true',
        can_access: canAccess?.[1]
          ?.split('\n')
          .map(l => l.replace(/^\s*-\s*["']?/, '').replace(/["']?\s*$/, '').trim())
          .filter(Boolean) || [],
      },
    }
  }

  // Parse capabilities.tools
  const toolsMatch = yaml.match(/tools:\s*\[([^\]]+)\]/)
  if (toolsMatch) {
    agent.capabilities = {
      tools: toolsMatch[1].split(',').map(t => t.replace(/["'\s]/g, '').trim()).filter(Boolean),
    }
  }

  return agent
}

function extractMultilineValue(block: string, key: string): string {
  const lines = block.split('\n')
  let collecting = false
  const result: string[] = []
  let keyIndent = -1

  for (const line of lines) {
    if (line.match(new RegExp(`\\s+${key}:\\s*\\|?`))) {
      collecting = true
      keyIndent = line.search(/\S/)
      continue
    }
    if (collecting) {
      const currentIndent = line.search(/\S/)
      if (line.trim() === '') {
        result.push('')
        continue
      }
      if (currentIndent <= keyIndent && line.trim()) break
      result.push(line.trim())
    }
  }
  return result.join('\n').trim()
}

function extractListValues(block: string, key: string): string[] {
  const lines = block.split('\n')
  let collecting = false
  const result: string[] = []
  let keyIndent = -1

  for (const line of lines) {
    if (line.match(new RegExp(`\\s+${key}:`))) {
      collecting = true
      keyIndent = line.search(/\S/)
      continue
    }
    if (collecting) {
      const currentIndent = line.search(/\S/)
      if (currentIndent <= keyIndent && line.trim() && !line.trim().startsWith('-')) break
      const match = line.match(/^\s*-\s*(.+)/)
      if (match) {
        result.push(match[1].replace(/^["']|["']$/g, '').trim())
      }
    }
  }
  return result
}

function extractInlineValue(block: string, key: string): string {
  const match = block.match(new RegExp(`${key}:\\s*["']?([^"'\\n]+)["']?`))
  return match?.[1]?.trim() || ''
}
