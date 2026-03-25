import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, MessageSquare, Users, BarChart3, FolderOpen, Settings, Zap, ShieldCheck, Clock } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
}

interface Command {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  action: () => void
  keywords: string
}

export default function CommandPalette({ open, onClose }: Props) {
  const nav = useNavigate()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const go = (path: string) => { nav(path); onClose() }

  const commands: Command[] = useMemo(() => [
    { id: 'chat', label: '对话', description: '打开主对话页面', icon: <MessageSquare size={16} />, action: () => go('/chat'), keywords: 'chat conversation 对话' },
    { id: 'team', label: '团队', description: '查看 Agent 团队', icon: <Users size={16} />, action: () => go('/team'), keywords: 'team agent 团队' },
    { id: 'dashboard', label: '仪表盘', description: '查看统计数据', icon: <BarChart3 size={16} />, action: () => go('/dashboard'), keywords: 'dashboard stats 仪表盘 统计' },
    { id: 'missions', label: '任务历史', description: '查看任务记录', icon: <Zap size={16} />, action: () => go('/missions'), keywords: 'missions tasks 任务' },
    { id: 'knowledge', label: '知识库', description: '管理知识文档', icon: <FolderOpen size={16} />, action: () => go('/knowledge'), keywords: 'knowledge files 知识库 文件' },
    { id: 'workflows', label: '工作流', description: '管理自动化工作流', icon: <Zap size={16} />, action: () => go('/workflows'), keywords: 'workflows automation 工作流' },
    { id: 'heartbeats', label: '定时任务', description: '管理 Cron 调度', icon: <Clock size={16} />, action: () => go('/heartbeats'), keywords: 'heartbeats cron schedule 定时' },
    { id: 'approvals', label: '审批', description: '处理待审批项', icon: <ShieldCheck size={16} />, action: () => go('/approvals'), keywords: 'approvals review 审批' },
    { id: 'settings', label: '设置', description: '系统配置', icon: <Settings size={16} />, action: () => go('/settings'), keywords: 'settings config 设置' },
  ], [])

  const filtered = query
    ? commands.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.keywords.toLowerCase().includes(query.toLowerCase())
      )
    : commands

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      filtered[selectedIndex].action()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface rounded-xl shadow-lg border border-border overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={18} className="text-text-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入命令或搜索页面..."
            className="flex-1 text-sm bg-transparent outline-none text-text placeholder:text-text-muted"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 bg-bg border border-border rounded text-text-muted">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-text-muted">没有匹配的命令</div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                onClick={cmd.action}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === selectedIndex ? 'bg-primary/5 text-primary' : 'text-text hover:bg-bg'
                }`}
              >
                <span className={i === selectedIndex ? 'text-primary' : 'text-text-muted'}>{cmd.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{cmd.label}</div>
                  <div className="text-xs text-text-muted">{cmd.description}</div>
                </div>
                {i === selectedIndex && (
                  <kbd className="text-[10px] px-1.5 py-0.5 bg-bg border border-border rounded text-text-muted">Enter</kbd>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border bg-bg text-[10px] text-text-muted">
          <span><kbd className="px-1 py-0.5 bg-surface border border-border rounded">↑↓</kbd> 导航</span>
          <span><kbd className="px-1 py-0.5 bg-surface border border-border rounded">Enter</kbd> 打开</span>
          <span><kbd className="px-1 py-0.5 bg-surface border border-border rounded">Esc</kbd> 关闭</span>
        </div>
      </div>
    </div>
  )
}
