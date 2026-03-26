import { useState, useEffect, useRef, useMemo, useImperativeHandle, forwardRef } from 'react'
import { Target, Calendar, Users, Search, FileText, Zap,
         Bell, Table, Code, Globe, BarChart3, Repeat } from 'lucide-react'

export interface SlashCommand {
  command: string; label: string; description: string; icon: any; group: string
  prompt: string; directSend?: boolean
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { command: '/task', label: '创建任务', description: '创建或查看待办事项', icon: Target, group: '📋 任务管理', prompt: '帮我创建一个任务：' },
  { command: '/schedule', label: '查看日程', description: '查看今天的日程安排', icon: Calendar, group: '📋 任务管理', prompt: '查看我今天的日程安排', directSend: true },
  { command: '/followup', label: '创建跟进', description: '创建跟进提醒', icon: Users, group: '📋 任务管理', prompt: '帮我创建一个跟进提醒：' },
  { command: '/todo', label: '查看待办', description: '列出所有待办事项', icon: Target, group: '📋 任务管理', prompt: '列出我当前所有的待办事项和优先级', directSend: true },
  { command: '/search', label: '搜索知识库', description: '在知识库中搜索信息', icon: Search, group: '📊 数据查询', prompt: '在知识库中搜索：' },
  { command: '/data', label: '查询数据', description: '查询系统统计数据', icon: BarChart3, group: '📊 数据查询', prompt: '查询我的工作数据统计，包括本周的对话数、Token 用量和工作流执行情况', directSend: true },
  { command: '/report', label: '生成报告', description: '用 AI 生成工作报告', icon: FileText, group: '📊 数据查询', prompt: '帮我生成一份工作报告，内容包括：' },
  { command: '/summary', label: '总结工作', description: '总结最近的工作内容', icon: Repeat, group: '📊 数据查询', prompt: '总结我最近的工作内容和进展', directSend: true },
  { command: '/workflow', label: '运行工作流', description: '触发执行工作流', icon: Zap, group: '⚡ 自动化', prompt: '帮我运行工作流：' },
  { command: '/notify', label: '发送通知', description: '通过飞书/钉钉/邮件发送通知', icon: Bell, group: '⚡ 自动化', prompt: '帮我发送一条通知：' },
  { command: '/excel', label: '处理 Excel', description: '创建、读取或分析 Excel 文件', icon: Table, group: '🛠️ 工具', prompt: '帮我处理 Excel：' },
  { command: '/doc', label: '生成文档', description: '生成 Word 或 PDF 文档', icon: FileText, group: '🛠️ 工具', prompt: '帮我生成一份文档：' },
  { command: '/code', label: '执行代码', description: '运行 Python 代码', icon: Code, group: '🛠️ 工具', prompt: '帮我执行以下代码：' },
  { command: '/web', label: '搜索网页', description: '搜索互联网获取最新信息', icon: Globe, group: '🛠️ 工具', prompt: '帮我搜索：' },
]

export interface SlashMenuHandle { handleKey: (e: KeyboardEvent | React.KeyboardEvent) => boolean }

interface Props { query: string; visible: boolean; onSelect: (cmd: SlashCommand) => void; onClose: () => void }

const SlashCommandMenu = forwardRef<SlashMenuHandle, Props>(({ query, visible, onSelect, onClose }, ref) => {
  const [sel, setSel] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  const flat = useMemo(() => {
    const q = query.toLowerCase()
    return q ? SLASH_COMMANDS.filter(c => c.command.includes(q) || c.label.includes(q) || c.description.includes(q)) : SLASH_COMMANDS
  }, [query])

  const grouped = useMemo(() => {
    const g: Record<string, SlashCommand[]> = {}
    for (const c of flat) { if (!g[c.group]) g[c.group] = []; g[c.group].push(c) }
    return g
  }, [flat])

  useEffect(() => { setSel(0) }, [query])

  useEffect(() => {
    if (!visible) return
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) onClose() }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [visible, onClose])

  useImperativeHandle(ref, () => ({
    handleKey(e: KeyboardEvent | React.KeyboardEvent): boolean {
      if (!visible || !flat.length) return false
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel(i => Math.min(i + 1, flat.length - 1)); return true }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSel(i => Math.max(i - 1, 0)); return true }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (flat[sel]) onSelect(flat[sel]); return true }
      if (e.key === 'Escape') { onClose(); return true }
      return false
    },
  }), [visible, flat, sel, onSelect, onClose])

  if (!visible || !flat.length) return null

  return (
    <div ref={menuRef} className="absolute bottom-full left-0 right-0 mb-2 rounded-xl shadow-2xl overflow-hidden max-h-[350px] overflow-y-auto z-50"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>输入命令快速操作 · ↑↓ 选择 · Enter 确认</span>
      </div>
      {Object.entries(grouped).map(([group, cmds]) => (
        <div key={group}>
          <div className="px-3 py-1.5 text-[10px] font-bold" style={{ color: 'var(--text-muted)', background: 'var(--bg)' }}>{group}</div>
          {cmds.map(cmd => {
            const idx = flat.indexOf(cmd); const Icon = cmd.icon
            return (
              <button key={cmd.command} onClick={() => onSelect(cmd)} onMouseEnter={() => setSel(idx)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${idx === sel ? 'bg-[var(--bg-hover)]' : ''}`}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: idx === sel ? 'var(--accent)20' : 'var(--bg)', color: 'var(--accent)' }}><Icon size={14} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium" style={{ color: 'var(--accent)' }}>{cmd.command}</span>
                    <span className="text-xs" style={{ color: 'var(--text)' }}>{cmd.label}</span>
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{cmd.description}</div>
                </div>
                {cmd.directSend && <span className="text-[8px] px-1.5 py-0.5 rounded shrink-0" style={{ background: 'var(--accent)15', color: 'var(--accent)' }}>直接执行</span>}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
})

SlashCommandMenu.displayName = 'SlashCommandMenu'
export default SlashCommandMenu
