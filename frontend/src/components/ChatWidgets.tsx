/**
 * Chat 页面子组件：SessionItem, ToolCalls, CollapsibleContent, CopyBtn, FeedbackBtn
 */
import { useState, useRef, useEffect } from 'react'
import { MessageSquare, Trash2, ChevronDown, ChevronRight, Copy, Check, ThumbsUp, ThumbsDown, AlertCircle } from 'lucide-react'
import { useChatStore } from '../stores/useChatStore'
import { parseCard } from './ActionCards'
import client from '../api/client'
import toast from 'react-hot-toast'

/* ── SessionItem (rename on double-click) ── */
export function SessionItem({ sess, isActive, onSelect, onDelete }: {
  sess: { id: string; title: string }; isActive: boolean; onSelect: () => void; onDelete: () => void
}) {
  const [editing, setEditing] = useState(false); const [title, setTitle] = useState(sess.title); const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (editing) ref.current?.focus() }, [editing]); useEffect(() => { setTitle(sess.title) }, [sess.title])
  const save = async () => { setEditing(false); if (title.trim() && title !== sess.title) { try { await client.patch(`/chat/sessions/${sess.id}/title`, { title: title.trim() }) } catch { setTitle(sess.title) } } else setTitle(sess.title) }
  return (
    <div onClick={onSelect} className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${isActive ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-hover)]'}`}
      style={{ color: isActive ? 'var(--text)' : 'var(--text-muted)' }}>
      <MessageSquare size={14} className="shrink-0" />
      {editing ? <input ref={ref} value={title} onChange={e => setTitle(e.target.value)} onBlur={save} onKeyDown={e => e.key === 'Enter' && save()}
        className="flex-1 bg-transparent outline-none text-sm min-w-0" style={{ color: 'var(--text)' }} onClick={e => e.stopPropagation()} />
      : <span className="flex-1 truncate" onDoubleClick={e => { e.stopPropagation(); setEditing(true) }}>{sess.title || '新对话'}</span>}
      <button onClick={e => { e.stopPropagation(); onDelete() }} className="opacity-0 group-hover:opacity-100 hover:text-[var(--error)]"><Trash2 size={12} /></button>
    </div>)
}

/* ── Tool display names ── */
const TD: Record<string, { label: string; icon: string; verb: string }> = {
  calculator: { label: '计算器', icon: '🔢', verb: '正在计算' }, datetime: { label: '日期时间', icon: '🕐', verb: '获取时间' },
  code_executor: { label: '代码执行', icon: '💻', verb: '执行代码' }, shell_executor: { label: '命令', icon: '⚡', verb: '执行命令' },
  web_search: { label: '联网搜索', icon: '🌐', verb: '正在搜索' }, search_knowledge: { label: '知识库', icon: '📚', verb: '搜索知识库' },
  manage_priority: { label: '待办', icon: '✅', verb: '管理待办' }, manage_schedule: { label: '日程', icon: '📅', verb: '查看日程' },
  manage_followup: { label: '跟进', icon: '👥', verb: '管理跟进' }, manage_work_item: { label: '工作项', icon: '📋', verb: '管理工作项' },
  document_converter: { label: '文档转换', icon: '🔄', verb: '转换文档' }, excel_processor: { label: 'Excel', icon: '📗', verb: '处理 Excel' },
  word_processor: { label: 'Word', icon: '📄', verb: '处理文档' }, pdf_processor: { label: 'PDF', icon: '📕', verb: '处理 PDF' },
  email_sender: { label: '邮件', icon: '✉️', verb: '发送邮件' }, http_request: { label: 'HTTP', icon: '🔗', verb: '请求数据' },
  text_processor: { label: '文本', icon: '📝', verb: '处理文本' }, ppt_processor: { label: 'PPT', icon: '📙', verb: '处理 PPT' },
}

function _desc(name: string, input: any): string {
  const a = typeof input === 'string' ? (() => { try { return JSON.parse(input) } catch { return {} } })() : (input || {})
  if (name === 'document_converter') return a.target_format ? `→ ${a.target_format.toUpperCase()}` : ''
  if (name === 'web_search' || name === 'search_knowledge') return a.query ? `"${a.query}"` : ''
  if (name.startsWith('manage_')) return ({ list: '查看', add: `创建: ${a.title || ''}`, delete: '删除', update: '更新' })[a.action as string] || ''
  if (name === 'calculator') return a.expression || ''
  if (name === 'http_request') return a.url ? `${a.method || 'GET'} ${a.url.slice(0, 30)}` : ''
  return ''
}

function _isOk(r: string): boolean {
  if (!r || r.startsWith('执行错误') || r.startsWith('未找到工具') || r.startsWith('操作被安全') || r.startsWith('工具')) return false
  try { if (JSON.parse(r).error) return false } catch {}; return true
}

/* ── ToolCalls (rich status) ── */
export function ToolCalls({ tools }: { tools: Array<{ type: string; name: string; input?: any; result?: string }> }) {
  const [detail, setDetail] = useState(false)
  const starts = tools.filter(t => t.type === 'tool_start'); const results = tools.filter(t => t.type === 'tool_result')
  const pairs = starts.map((s, i) => ({ name: s.name, input: s.input, result: results[i]?.result, done: !!results[i], ok: results[i] ? _isOk(results[i].result || '') : false }))
  const allDone = pairs.every(p => p.done)

  return (
    <div className="mb-2 space-y-0.5">
      {pairs.map((p, i) => {
        const d = TD[p.name] || { label: p.name, icon: '🔧', verb: p.name }
        const desc = _desc(p.name, p.input)
        return (
          <div key={i} className="flex items-center gap-2 py-0.5">
            {p.done ? (p.ok ? <Check size={13} style={{ color: '#22c55e' }} /> : <AlertCircle size={13} style={{ color: '#ef4444' }} />)
              : <div className="w-3.5 h-3.5 rounded-full border-[1.5px] border-t-[var(--accent)] border-[var(--border)] animate-spin" />}
            <span className="text-[11px]">{d.icon}</span>
            <span className="text-xs" style={{ color: p.done ? 'var(--text-muted)' : 'var(--text)' }}>{p.done ? d.label : d.verb}</span>
            {desc && <span className="text-[10px] truncate max-w-[200px]" style={{ color: 'var(--text-muted)' }}>{desc}</span>}
            {p.done && !p.ok && p.result && <span className="text-[9px] truncate max-w-[120px]" style={{ color: '#ef4444' }}>
              {(() => { try { return JSON.parse(p.result!).error || '失败' } catch { return '失败' } })()}</span>}
          </div>)
      })}
      {allDone && pairs.length > 0 && <>
        <button onClick={() => setDetail(!detail)} className="flex items-center gap-1 text-[9px] pt-0.5" style={{ color: 'var(--text-muted)' }}>
          {detail ? <ChevronDown size={10} /> : <ChevronRight size={10} />}{detail ? '收起' : '详情'}</button>
        {detail && <div className="ml-5 space-y-2 border-l pl-3 mt-1" style={{ borderColor: 'var(--border)' }}>
          {pairs.map((p, i) => <div key={i} className="text-[10px]">
            <div className="font-mono" style={{ color: 'var(--accent)' }}>{p.name}</div>
            {p.input && <pre className="mt-0.5 p-1.5 rounded overflow-x-auto" style={{ background: 'var(--bg)', color: 'var(--text-muted)', fontSize: 9 }}>
              {typeof p.input === 'string' ? p.input : JSON.stringify(p.input, null, 2)}</pre>}
            {p.result && !parseCard(p.name, p.result) && <pre className="mt-0.5 p-1.5 rounded overflow-x-auto"
              style={{ background: 'var(--bg)', color: p.ok ? 'var(--text-muted)' : '#ef4444', fontSize: 9 }}>{p.result.slice(0, 300)}</pre>}
          </div>)}</div>}
      </>}
    </div>)
}

/* ── CollapsibleContent (long message fold) ── */
export function Collapsible({ children, maxH = 400 }: { children: React.ReactNode; maxH?: number }) {
  const [collapsed, setCollapsed] = useState(true); const [needs, setNeeds] = useState(false); const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (ref.current && ref.current.scrollHeight > maxH) setNeeds(true) }, [children, maxH])
  return (
    <div className="relative">
      <div ref={ref} style={{ maxHeight: needs && collapsed ? maxH : undefined, overflow: needs && collapsed ? 'hidden' : undefined }}>{children}</div>
      {needs && <div className={collapsed ? 'absolute bottom-0 left-0 right-0' : ''}>
        {collapsed && <div className="h-12 bg-gradient-to-t from-[var(--bg-surface)] to-transparent" />}
        <button onClick={() => setCollapsed(!collapsed)} className="w-full text-center py-1 text-xs hover:text-[var(--accent)]" style={{ color: 'var(--text-muted)' }}>
          {collapsed ? '▼ 展开全文' : '▲ 收起'}</button>
      </div>}
    </div>)
}

/* ── CopyBtn ── */
export function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); toast.success('已复制'); setTimeout(() => setCopied(false), 2000) }}
    className="p-1 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }} title="复制">
    {copied ? <Check size={13} style={{ color: 'var(--success)' }} /> : <Copy size={13} />}
  </button>
}

/* ── FeedbackBtn ── */
export function FeedbackBtn({ msgId }: { msgId: string }) {
  const fb = useChatStore(s => s.feedbacks[msgId])
  const toggle = useChatStore(s => s.toggleFeedback)
  return <>
    <button onClick={() => toggle(msgId, 'up')} className="p-1 rounded hover:bg-[var(--bg-hover)]"
      style={{ color: fb === 'up' ? 'var(--success)' : 'var(--text-muted)' }}><ThumbsUp size={13} fill={fb === 'up' ? 'currentColor' : 'none'} /></button>
    <button onClick={() => toggle(msgId, 'down')} className="p-1 rounded hover:bg-[var(--bg-hover)]"
      style={{ color: fb === 'down' ? 'var(--error)' : 'var(--text-muted)' }}><ThumbsDown size={13} fill={fb === 'down' ? 'currentColor' : 'none'} /></button>
  </>
}

/* ── timeAgo ── */
export function timeAgo(ts?: number): string {
  if (!ts) return ''
  const diff = Date.now() / 1000 - ts
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  const d = new Date(ts * 1000)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}
