import { useState, useEffect, useRef, useMemo, useImperativeHandle, forwardRef } from 'react'
import { Target, Calendar, Users, Search, Globe, FileText, Table, Repeat } from 'lucide-react'

export interface SlashCommand {
  command: string; label: string; description: string; icon: any; group: string
  mode: 'direct' | 'input' | 'template'
  prompt: string; template?: string; toolHint?: string
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { command: '/todo', label: '查看待办', description: '列出所有待办事项和优先级', icon: Target, group: '📋 工作管理', mode: 'direct', prompt: '列出我当前所有的待办事项，按优先级排列', toolHint: 'manage_priority' },
  { command: '/task', label: '创建任务', description: '快速创建新的待办事项', icon: Target, group: '📋 工作管理', mode: 'input', prompt: '帮我创建一个任务：', toolHint: 'manage_priority' },
  { command: '/schedule', label: '查看日程', description: '查看今天的日程安排', icon: Calendar, group: '📋 工作管理', mode: 'direct', prompt: '查看我今天的日程安排', toolHint: 'manage_schedule' },
  { command: '/followup', label: '跟进提醒', description: '创建待跟进事项', icon: Users, group: '📋 工作管理', mode: 'input', prompt: '帮我创建一个跟进提醒：', toolHint: 'manage_followup' },
  { command: '/search', label: '搜索知识库', description: '在知识库文档中搜索', icon: Search, group: '🔍 信息查询', mode: 'input', prompt: '在知识库中搜索：', toolHint: 'search_knowledge' },
  { command: '/web', label: '联网搜索', description: '搜索互联网获取最新信息', icon: Globe, group: '🔍 信息查询', mode: 'input', prompt: '搜索最新信息：', toolHint: 'web_search' },
  { command: '/doc', label: '生成文档', description: '创建 Word/PDF 等文档', icon: FileText, group: '📄 内容生成', mode: 'template', prompt: '', toolHint: 'word_processor',
    template: '帮我生成一份文档：\n\n文档类型：（如：方案、报告、会议纪要、制度、通知）\n主题：\n要点：\n- \n- \n- ' },
  { command: '/report', label: '工作报告', description: '生成周报/月报/项目报告', icon: FileText, group: '📄 内容生成', mode: 'template', prompt: '', toolHint: 'word_processor',
    template: '帮我生成工作报告：\n\n报告类型：（周报/月报/项目报告）\n时间范围：\n主要工作：\n- \n- \n关键成果：\n- \n下阶段计划：\n- ' },
  { command: '/excel', label: '处理表格', description: '创建、分析 Excel 数据', icon: Table, group: '📄 内容生成', mode: 'template', prompt: '', toolHint: 'excel_processor',
    template: '帮我处理 Excel 表格：\n\n操作：（创建/分析/修改）\n说明：\n\n💡 提示：如需处理已有文件，请先用左下角📎按钮上传' },
  { command: '/convert', label: '文件转换', description: 'PDF/Word/Excel/PPT 格式互转', icon: Repeat, group: '📄 内容生成', mode: 'template', prompt: '', toolHint: 'document_converter',
    template: '帮我转换文件格式：\n\n目标格式：（Word/PDF/Excel/PPT/CSV）\n\n💡 提示：请先用左下角📎按钮上传要转换的文件' },
]

const MB: Record<string, { text: string; color: string; bg: string }> = {
  direct: { text: '直接执行', color: '#22c55e', bg: '#22c55e15' },
  input: { text: '输入内容', color: '#3b82f6', bg: '#3b82f615' },
  template: { text: '填写模板', color: '#a855f7', bg: '#a855f715' },
}

export interface SlashMenuHandle { handleKey: (e: KeyboardEvent | React.KeyboardEvent) => boolean }
interface Props { query: string; visible: boolean; onSelect: (cmd: SlashCommand) => void; onClose: () => void }

const SlashCommandMenu = forwardRef<SlashMenuHandle, Props>(({ query, visible, onSelect, onClose }, ref) => {
  const [sel, setSel] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const flat = useMemo(() => { const q = query.toLowerCase(); return q ? SLASH_COMMANDS.filter(c => c.command.includes(q) || c.label.includes(q) || c.description.includes(q)) : SLASH_COMMANDS }, [query])
  const grouped = useMemo(() => { const g: Record<string, SlashCommand[]> = {}; for (const c of flat) { if (!g[c.group]) g[c.group] = []; g[c.group].push(c) }; return g }, [flat])

  useEffect(() => { setSel(0) }, [query])
  useEffect(() => { if (!visible) return; const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) onClose() }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [visible, onClose])

  useImperativeHandle(ref, () => ({
    handleKey(e) {
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
    <div ref={menuRef} className="absolute bottom-full left-0 right-0 mb-2 rounded-xl shadow-2xl overflow-hidden max-h-[380px] overflow-y-auto z-50"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>/ 快捷命令 · ↑↓ 选择 · Enter 确认</span>
      </div>
      {Object.entries(grouped).map(([group, cmds]) => (
        <div key={group}>
          <div className="px-3 py-1.5 text-[10px] font-bold" style={{ color: 'var(--text-muted)', background: 'var(--bg)' }}>{group}</div>
          {cmds.map(cmd => { const idx = flat.indexOf(cmd); const Icon = cmd.icon; const b = MB[cmd.mode]
            return (
              <button key={cmd.command} onClick={() => onSelect(cmd)} onMouseEnter={() => setSel(idx)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${idx === sel ? 'bg-[var(--bg-hover)]' : ''}`}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: idx === sel ? 'var(--accent)20' : 'var(--bg)', color: 'var(--accent)' }}><Icon size={14} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium" style={{ color: 'var(--accent)' }}>{cmd.command}</span>
                    <span className="text-xs" style={{ color: 'var(--text)' }}>{cmd.label}</span></div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{cmd.description}</div>
                </div>
                <span className="text-[8px] px-1.5 py-0.5 rounded shrink-0" style={{ background: b.bg, color: b.color }}>{b.text}</span>
              </button>)
          })}
        </div>
      ))}
    </div>
  )
})

SlashCommandMenu.displayName = 'SlashCommandMenu'
export default SlashCommandMenu
