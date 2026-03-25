/**
 * Chat 页面子组件：SessionItem, ToolCalls, CollapsibleContent, CopyBtn, FeedbackBtn
 */
import { useState, useRef, useEffect } from 'react'
import { MessageSquare, Trash2, Wrench, ChevronDown, ChevronRight, Copy, Check, ThumbsUp, ThumbsDown } from 'lucide-react'
import { useChatStore } from '../stores/useChatStore'
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

/* ── ToolCalls (paired start/result) ── */
export function ToolCalls({ tools }: { tools: Array<{ type: string; name: string; input?: any; result?: string }> }) {
  const [open, setOpen] = useState(false)
  const starts = tools.filter(t => t.type === 'tool_start'); const results = tools.filter(t => t.type === 'tool_result')
  const pairs = starts.map((s, i) => ({ name: s.name, input: s.input, result: results[i]?.result, done: !!results[i] }))
  const allDone = pairs.every(p => p.done); const Arr = open ? ChevronDown : ChevronRight
  return (
    <div className="mb-3 rounded-lg p-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-xs w-full hover:text-[var(--accent)]" style={{ color: 'var(--text-muted)' }}>
        {allDone ? <Check size={12} style={{ color: 'var(--success)' }} /> : <div className="w-3 h-3 border-2 border-t-[var(--accent)] border-[var(--border)] rounded-full animate-spin" />}
        <span>使用了 {pairs.length} 个工具: {pairs.map(p => p.name).join(', ')}</span><Arr size={12} className="ml-auto" /></button>
      {open && <div className="mt-2 space-y-2">{pairs.map((p, i) => <div key={i} className="text-xs pl-5">
        <div className="flex items-center gap-1">
          {p.done ? <Check size={10} style={{ color: 'var(--success)' }} /> : <div className="w-2.5 h-2.5 border border-t-[var(--accent)] border-[var(--border)] rounded-full animate-spin" />}
          <span className="font-medium" style={{ color: 'var(--accent)' }}>{p.name}</span></div>
        {p.input && <pre className="mt-1 p-2 rounded text-[10px] overflow-x-auto" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>{typeof p.input === 'string' ? p.input : JSON.stringify(p.input, null, 2)}</pre>}
        {p.result && <pre className="mt-1 p-2 rounded text-[10px] overflow-x-auto" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>{p.result.slice(0, 500)}</pre>}
      </div>)}</div>}
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
