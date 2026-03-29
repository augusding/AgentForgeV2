import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Target, Calendar, Users, AlertCircle, Plus, RefreshCw, Sparkles,
         Loader2, CheckCircle2, Clock, ChevronRight, X, MoreHorizontal, Trash2, ArrowUp, ArrowDown, MessageSquare } from 'lucide-react'
import { useWorkstationStore } from '../stores/useWorkstationStore'
import { useAuthStore } from '../stores/useAuthStore'
import client from '../api/client'
import { createTask, updateTask, deleteTask, createSchedule, updateSchedule, deleteSchedule,
         createFollowup, updateFollowup, deleteFollowup, updateWorkItem, deleteWorkItem } from '../api/workitems'
import toast from 'react-hot-toast'

// ── Types ──
interface BriefData {
  greeting: string
  actions: Array<{ title: string; reason: string; urgency: string; category: string; prompt: string }>
  stats: Record<string, number>
  schedules: Array<{ id: string; title: string; scheduled_time: string; duration_minutes: number; description?: string }>
  priorities: Array<{ id: string; title: string; priority: string; status: string; due_date: string; description?: string }>
  work_items: Array<{ id: string; title: string; status: string; priority: string; due_date: string }>
  followups: Array<{ id: string; title: string; target: string; status: string; due_date: string; description?: string }>
}
type TimeRange = 'today' | 'week' | 'month'
type TaskItem = { id: string; title: string; priority: string; status: string; due_date: string; source: string; description?: string }

const P_ICON: Record<string, string> = { P0: '🔴', P1: '🟡', P2: '🔵', P3: '⚪' }
const CAT_ICON: Record<string, string> = { overdue: '🔴', due_today: '🟡', high_priority: '🟠', workflow_error: '⚡', prepare: '📋', plan: '💡' }
const STATUS_MAP: Record<string, string> = { todo: 'active', in_progress: 'in_progress', done: 'done' }

function rangeFilter(dateStr: string, range: TimeRange): boolean {
  if (!dateStr) return range === 'today'
  const d = new Date(dateStr.split(' ')[0])
  const now = new Date(); const today = new Date(now.toDateString())
  if (range === 'today') return d.toDateString() === today.toDateString()
  if (range === 'week') { const end = new Date(today); end.setDate(end.getDate() + 7); return d >= today && d < end }
  const end = new Date(today); end.setDate(end.getDate() + 30); return d >= today && d < end
}

// ── 通用小组件 ──

function RangeTabs({ value, onChange }: { value: TimeRange; onChange: (v: TimeRange) => void }) {
  return (
    <div className="flex gap-1">
      {([['today', '今日'], ['week', '本周'], ['month', '本月']] as [TimeRange, string][]).map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} className="px-2 py-0.5 rounded text-[10px] transition-colors"
          style={{ background: value === k ? 'var(--accent)15' : 'transparent', color: value === k ? 'var(--accent)' : 'var(--text-muted)', fontWeight: value === k ? 600 : 400 }}>{l}</button>
      ))}
    </div>
  )
}

/** 内联编辑：点击文字变 input，失焦或回车保存 */
function InlineEdit({ value, onSave, className, style }: { value: string; onSave: (v: string) => void; className?: string; style?: React.CSSProperties }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { setText(value) }, [value])
  useEffect(() => { if (editing) ref.current?.focus() }, [editing])
  const save = () => { setEditing(false); if (text.trim() && text !== value) onSave(text.trim()) }
  if (editing) return <input ref={ref} value={text} onChange={e => setText(e.target.value)}
    onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setText(value); setEditing(false) } }}
    className={`bg-transparent outline-none border-b w-full ${className || ''}`}
    style={{ borderColor: 'var(--accent)', fontSize: 'inherit', color: 'inherit', ...style }} />
  return <span onClick={() => setEditing(true)} className={`cursor-pointer hover:underline ${className || ''}`} style={style}>{value}</span>
}

/** 右键菜单 */
function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: Array<{ label: string; icon?: any; color?: string; onClick: () => void }>; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler)
  }, [onClose])
  return (
    <div ref={ref} className="fixed z-50 py-1 rounded-lg shadow-xl min-w-[140px]"
      style={{ left: Math.min(x, window.innerWidth - 160), top: Math.min(y, window.innerHeight - 200), background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      {items.map((item, i) => (
        <button key={i} onClick={() => { item.onClick(); onClose() }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--bg-hover)] transition-colors"
          style={{ color: item.color || 'var(--text)' }}>
          {item.icon && <item.icon size={12} />}{item.label}
        </button>
      ))}
    </div>
  )
}

/** 快速创建 Popover */
function QuickCreate({ type, onCreated, onClose }: { type: 'task' | 'schedule' | 'followup'; onCreated: () => void; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [target, setTarget] = useState('')
  const [priority, setPriority] = useState('P1')
  const [duration, setDuration] = useState(60)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const submit = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      if (type === 'task') {
        await createTask({ title: title.trim(), priority, due_date: date || undefined })
      } else if (type === 'schedule') {
        const scheduled_time = date && time ? `${date} ${time}` : date ? `${date} 09:00` : ''
        if (!scheduled_time) { toast.error('请选择日期'); setSaving(false); return }
        await createSchedule({ title: title.trim(), scheduled_time, duration_minutes: duration })
      } else {
        await createFollowup({ title: title.trim(), target: target || undefined, due_date: date || undefined })
      }
      toast.success('创建成功')
      onCreated()
      onClose()
    } catch { toast.error('创建失败') }
    finally { setSaving(false) }
  }

  const labels = { task: '新建任务', schedule: '新建日程', followup: '新建跟进' }

  return (
    <div ref={ref} className="absolute right-0 top-8 z-50 w-72 rounded-xl shadow-xl p-4 space-y-3"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>{labels[type]}</span>
        <button onClick={onClose} className="p-0.5 rounded hover:bg-[var(--bg-hover)]"><X size={14} style={{ color: 'var(--text-muted)' }} /></button>
      </div>

      <input ref={inputRef} placeholder="标题" value={title} onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && title.trim()) submit() }}
        className="w-full px-3 py-2 rounded-lg text-xs outline-none"
        style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />

      <div className="flex gap-2">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="flex-1 px-2 py-1.5 rounded-lg text-[11px] outline-none"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />

        {type === 'task' && (
          <select value={priority} onChange={e => setPriority(e.target.value)}
            className="px-2 py-1.5 rounded-lg text-[11px] outline-none"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            <option value="P0">P0 紧急</option><option value="P1">P1 重要</option><option value="P2">P2 普通</option>
          </select>
        )}

        {type === 'schedule' && (
          <input type="time" value={time} onChange={e => setTime(e.target.value)}
            className="px-2 py-1.5 rounded-lg text-[11px] outline-none"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        )}

        {type === 'followup' && (
          <input placeholder="跟进对象" value={target} onChange={e => setTarget(e.target.value)}
            className="flex-1 px-2 py-1.5 rounded-lg text-[11px] outline-none"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        )}
      </div>

      {type === 'schedule' && (
        <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <span>时长</span>
          <select value={duration} onChange={e => setDuration(Number(e.target.value))}
            className="px-2 py-1 rounded text-[11px] outline-none"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            <option value={15}>15分</option><option value={30}>30分</option><option value={60}>1小时</option><option value={120}>2小时</option>
          </select>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[11px]"
          style={{ color: 'var(--text-muted)' }}>取消</button>
        <button onClick={submit} disabled={saving || !title.trim()}
          className="px-3 py-1.5 rounded-lg text-[11px] font-medium disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#fff' }}>
          {saving ? '创建中...' : '创建'}
        </button>
      </div>
    </div>
  )
}

// ── 拖拽任务看板列 ──

function DragTaskCol({ title, count, color, tasks, colStatus, onDrop, onUpdate, onDelete, onChat, border, done }: {
  title: string; count: number; color: string; tasks: TaskItem[]; colStatus: string
  onDrop: (taskId: string, source: string, newStatus: string) => void
  onUpdate: (task: TaskItem, field: string, value: string) => void
  onDelete: (task: TaskItem) => void
  onChat: (prompt: string) => void
  border?: boolean; done?: boolean
}) {
  const [dragOver, setDragOver] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; task: TaskItem } | null>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const data = e.dataTransfer.getData('application/json')
    if (!data) return
    const { id, source } = JSON.parse(data)
    onDrop(id, source, colStatus)
  }

  return (
    <div className={`px-4 py-3 min-h-[160px] transition-colors ${border ? 'border-l' : ''}`}
      style={{ borderColor: 'var(--border)', background: dragOver ? 'var(--accent)08' : 'transparent' }}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
        <span className="text-[11px] font-medium" style={{ color: 'var(--text)' }}>{title}</span>
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{count}</span>
      </div>
      {tasks.length ? <div className="space-y-1.5">{tasks.map(t => (
        <div key={t.id} draggable
          onDragStart={e => { e.dataTransfer.setData('application/json', JSON.stringify({ id: t.id, source: t.source })); e.dataTransfer.effectAllowed = 'move' }}
          onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, task: t }) }}
          className="px-2.5 py-2 rounded-lg cursor-grab active:cursor-grabbing hover:bg-[var(--bg-hover)] group"
          style={{ background: 'var(--bg)' }}>
          <div className="flex items-center gap-1.5">
            {done ? <CheckCircle2 size={11} style={{ color: '#22c55e' }} /> : <span className="text-[10px]">{P_ICON[t.priority] || '⚪'}</span>}
            <InlineEdit value={t.title} onSave={v => onUpdate(t, 'title', v)}
              className={`text-xs flex-1 truncate ${done ? 'line-through' : ''}`}
              style={{ color: done ? 'var(--text-muted)' : 'var(--text)' }} />
            <button onClick={e => { e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, task: t }) }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--bg-hover)]">
              <MoreHorizontal size={12} style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
          {!done && t.due_date && <div className="text-[9px] mt-1 ml-4" style={{
            color: new Date(t.due_date) < new Date(new Date().toDateString()) ? '#ef4444' : 'var(--text-muted)' }}>截止 {t.due_date}</div>}
        </div>
      ))}</div> : <div className="text-center py-4 text-[10px]" style={{ color: 'var(--text-muted)' }}>{done ? '暂无完成' : '拖拽到此列'}</div>}

      {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)} items={[
        ...(done ? [] : [
          { label: '标记完成', icon: CheckCircle2, color: '#22c55e', onClick: () => onUpdate(ctxMenu.task, 'status', 'done') },
        ]),
        ...(done ? [{ label: '恢复待办', icon: Target, color: '#3b82f6', onClick: () => onUpdate(ctxMenu.task, 'status', 'active') }] : []),
        { label: '提升优先级', icon: ArrowUp, color: '#f59e0b', onClick: () => {
          const levels = ['P2', 'P1', 'P0']; const cur = levels.indexOf(ctxMenu.task.priority)
          if (cur < levels.length - 1) onUpdate(ctxMenu.task, 'priority', levels[cur + 1])
        }},
        { label: '降低优先级', icon: ArrowDown, onClick: () => {
          const levels = ['P2', 'P1', 'P0']; const cur = levels.indexOf(ctxMenu.task.priority)
          if (cur > 0) onUpdate(ctxMenu.task, 'priority', levels[cur - 1])
        }},
        { label: 'AI 协助', icon: MessageSquare, color: 'var(--accent)', onClick: () => onChat(`帮我处理任务：${ctxMenu.task.title}`) },
        { label: '删除', icon: Trash2, color: '#ef4444', onClick: () => onDelete(ctxMenu.task) },
      ]} />}
    </div>
  )
}


// ── 主组件 ──

export default function Workstation() {
  const { home, positions, loading: homeLoading, loadHome, assignPosition: rawAssign } = useWorkstationStore()
  const { setActivePosition } = useAuthStore()
  const navigate = useNavigate()
  const [brief, setBrief] = useState<BriefData | null>(null)
  const [loadingBrief, setLoadingBrief] = useState(false)
  const [taskRange, setTaskRange] = useState<TimeRange>('today')
  const [scheduleRange, setScheduleRange] = useState<TimeRange>('today')
  const [followupRange, setFollowupRange] = useState<TimeRange>('week')

  // QuickCreate popover state
  const [showCreate, setShowCreate] = useState<'task' | 'schedule' | 'followup' | null>(null)
  // 右键菜单 state
  const [scheduleCtx, setScheduleCtx] = useState<{ x: number; y: number; item: any } | null>(null)
  const [followupCtx, setFollowupCtx] = useState<{ x: number; y: number; item: any } | null>(null)

  const location = useLocation()
  const assignPosition = async (pid: string) => { await rawAssign(pid); setActivePosition(pid) }
  useEffect(() => { loadHome() }, [])
  useEffect(() => { if (home?.assigned) loadBrief() }, [home?.assigned])
  useEffect(() => { if (location.pathname === '/' && home?.assigned) loadBrief() }, [location.pathname])

  const loadBrief = async () => {
    setLoadingBrief(true)
    try { setBrief(await client.post('/workstation/daily-brief', {}) as any) } catch {}
    finally { setLoadingBrief(false) }
  }

  const toChat = (prompt: string) => navigate('/chat?prompt=' + encodeURIComponent(prompt))

  // ── CRUD handlers ──
  const handleTaskUpdate = async (task: TaskItem, field: string, value: string) => {
    try {
      if (task.source === 'work_item') {
        const mapped = field === 'status' ? { status: STATUS_MAP[value] || value } : { [field]: value }
        await updateWorkItem(task.id, mapped)
      } else {
        await updateTask(task.id, { [field]: value })
      }
      await loadBrief()
    } catch { toast.error('更新失败') }
  }

  const handleTaskDelete = async (task: TaskItem) => {
    try {
      if (task.source === 'work_item') await deleteWorkItem(task.id)
      else await deleteTask(task.id)
      toast.success('已删除'); await loadBrief()
    } catch { toast.error('删除失败') }
  }

  const handleTaskDrop = async (taskId: string, source: string, newStatus: string) => {
    const statusValue = newStatus === 'todo' ? 'active' : newStatus === 'doing' ? 'in_progress' : 'done'
    try {
      if (source === 'work_item') await updateWorkItem(taskId, { status: statusValue })
      else await updateTask(taskId, { status: statusValue })
      await loadBrief()
    } catch { toast.error('状态更新失败') }
  }

  const handleScheduleDelete = async (id: string) => {
    try { await deleteSchedule(id); toast.success('已删除'); await loadBrief() }
    catch { toast.error('删除失败') }
  }

  const handleFollowupUpdate = async (id: string, field: string, value: string) => {
    try { await updateFollowup(id, { [field]: value }); await loadBrief() }
    catch { toast.error('更新失败') }
  }

  const handleFollowupDelete = async (id: string) => {
    try { await deleteFollowup(id); toast.success('已删除'); await loadBrief() }
    catch { toast.error('删除失败') }
  }

  // ── Loading / Onboarding ──
  if (homeLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent)' }} /></div>

  if (!home?.assigned) {
    return (
      <div className="p-8 max-w-[900px] mx-auto text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--accent)15' }}>
          <Sparkles size={32} style={{ color: 'var(--accent)' }} /></div>
        <h1 className="text-xl font-bold mb-2">选择您的工位岗位</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>选择岗位后，AI 助手将根据职责提供定制化支持</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-left">
          {positions.map(pos => (
            <button key={pos.position_id} onClick={() => assignPosition(pos.position_id)}
              className="p-5 rounded-xl text-left transition-all hover:border-[var(--accent)] hover:shadow-lg"
              style={{ background: 'var(--bg-surface)', border: '2px solid var(--border)' }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 text-lg"
                style={{ background: `${pos.color || 'var(--accent)'}20`, color: pos.color || 'var(--accent)' }}>
                {pos.icon === 'bot' ? '🤖' : '💼'}</div>
              <h3 className="font-medium text-sm mb-0.5">{pos.display_name}</h3>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{pos.department}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── 数据处理 ──
  const pos = home.position
  const allTasks: TaskItem[] = [...(brief?.priorities || []).map(t => ({ ...t, source: 'priority' })),
                                ...(brief?.work_items || []).map(t => ({ ...t, source: 'work_item' }))]
  const filteredTasks = taskRange === 'today' ? allTasks : allTasks.filter(t => !t.due_date || rangeFilter(t.due_date, taskRange))
  const todoTasks = filteredTasks.filter(t => ['active', 'todo', 'pending'].includes(t.status))
  const doingTasks = filteredTasks.filter(t => ['in_progress', 'doing'].includes(t.status))
  const doneTasks = filteredTasks.filter(t => ['completed', 'done'].includes(t.status))

  const allSchedules = brief?.schedules || []
  const filteredSchedules = allSchedules.filter(s => rangeFilter(s.scheduled_time, scheduleRange))
  const allFollowups = (brief?.followups || []).filter(f => f.status !== 'done')
  const filteredFollowups = followupRange === 'week' ? allFollowups : allFollowups.filter(f => !f.due_date || rangeFilter(f.due_date, followupRange))
  const overdue = allTasks.filter(t => ['active', 'todo', 'pending'].includes(t.status) && t.due_date && new Date(t.due_date) < new Date(new Date().toDateString()))

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 max-w-[1000px] mx-auto space-y-5">
        {/* 顶栏 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{ background: `${pos?.color || 'var(--accent)'}15`, color: pos?.color || 'var(--accent)' }}>✦</div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{pos?.display_name || '工位'}</h1>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</p>
            </div>
          </div>
          <button onClick={loadBrief} disabled={loadingBrief} className="p-2 rounded-lg hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}>
            <RefreshCw size={16} className={loadingBrief ? 'animate-spin' : ''} /></button>
        </div>

        {/* ① 概览条 */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { icon: Target, label: '待办', value: allTasks.filter(t => ['active', 'todo', 'pending'].includes(t.status)).length, color: '#3b82f6', bg: '#3b82f610' },
            { icon: Calendar, label: '日程', value: allSchedules.filter(s => rangeFilter(s.scheduled_time, 'today')).length, color: '#22c55e', bg: '#22c55e10' },
            { icon: Users, label: '跟进', value: allFollowups.length, color: '#a855f7', bg: '#a855f710' },
            { icon: AlertCircle, label: '逾期', value: overdue.length, color: overdue.length > 0 ? '#ef4444' : '#6b7280', bg: overdue.length > 0 ? '#ef444410' : 'var(--bg-surface)' },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: bg, border: '1px solid var(--border)' }}>
              <Icon size={18} style={{ color }} />
              <div><div className="text-xl font-bold" style={{ color }}>{value}</div>
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</div></div>
            </div>
          ))}
        </div>

        {/* AI 建议 */}
        {brief?.actions?.length ? (
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
              <Sparkles size={14} style={{ color: 'var(--accent)' }} />
              <h3 className="text-xs font-bold" style={{ color: 'var(--text)' }}>AI 建议</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>{brief.actions.length}</span>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {brief.actions.slice(0, 5).map((a, i) => (
                <button key={i} onClick={() => toChat(a.prompt)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--bg-hover)] transition-colors group">
                  <span className="text-sm shrink-0">{CAT_ICON[a.category] || '💡'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium" style={{ color: 'var(--text)' }}>{a.title}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{a.reason}</div>
                  </div>
                  <ChevronRight size={14} className="shrink-0 opacity-0 group-hover:opacity-100" style={{ color: 'var(--accent)' }} />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* ② 任务看板 — 支持拖拽 */}
        <div className="rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2">
              <Target size={16} style={{ color: 'var(--accent)' }} />
              <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>任务</h2>
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>{filteredTasks.length}</span>
            </div>
            <div className="flex items-center gap-2 relative">
              <RangeTabs value={taskRange} onChange={setTaskRange} />
              <button onClick={() => setShowCreate(showCreate === 'task' ? null : 'task')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px]" style={{ color: 'var(--accent)', border: '1px solid var(--accent)30' }}>
                <Plus size={12} /> 新建</button>
              {showCreate === 'task' && <QuickCreate type="task" onCreated={loadBrief} onClose={() => setShowCreate(null)} />}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-0">
            <DragTaskCol title="待处理" count={todoTasks.length} color="#f59e0b" tasks={todoTasks} colStatus="todo"
              onDrop={handleTaskDrop} onUpdate={handleTaskUpdate} onDelete={handleTaskDelete} onChat={toChat} />
            <DragTaskCol title="进行中" count={doingTasks.length} color="#3b82f6" tasks={doingTasks} colStatus="doing"
              onDrop={handleTaskDrop} onUpdate={handleTaskUpdate} onDelete={handleTaskDelete} onChat={toChat} border />
            <DragTaskCol title="已完成" count={doneTasks.length} color="#22c55e" tasks={doneTasks.slice(0, 5)} colStatus="done"
              onDrop={handleTaskDrop} onUpdate={handleTaskUpdate} onDelete={handleTaskDelete} onChat={toChat} border done />
          </div>
        </div>

        {/* ③④ 日程 + 跟进 */}
        <div className="grid grid-cols-2 gap-4">
          {/* 日程 */}
          <div className="rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <Calendar size={14} style={{ color: '#22c55e' }} />
                <h3 className="text-xs font-bold" style={{ color: 'var(--text)' }}>日程</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>{filteredSchedules.length}</span>
              </div>
              <div className="flex items-center gap-1 relative">
                <RangeTabs value={scheduleRange} onChange={setScheduleRange} />
                <button onClick={() => setShowCreate(showCreate === 'schedule' ? null : 'schedule')}
                  className="p-1 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--accent)' }}><Plus size={14} /></button>
                {showCreate === 'schedule' && <QuickCreate type="schedule" onCreated={loadBrief} onClose={() => setShowCreate(null)} />}
              </div>
            </div>
            <div className="px-4 py-3">
              {filteredSchedules.length ? <div className="space-y-2">{filteredSchedules.map((s, i) => {
                const time = s.scheduled_time?.split(' ')[1]?.slice(0, 5) || ''
                const dateP = scheduleRange !== 'today' ? s.scheduled_time?.split(' ')[0]?.slice(5) + ' ' : ''
                return (<div key={i} className="flex items-start gap-3 group"
                  onContextMenu={e => { e.preventDefault(); setScheduleCtx({ x: e.clientX, y: e.clientY, item: s }) }}>
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full mt-1.5" style={{ background: '#22c55e' }} />
                    {i < filteredSchedules.length - 1 && <div className="w-px flex-1 mt-1" style={{ background: 'var(--border)' }} />}
                  </div>
                  <div className="flex-1 pb-2">
                    <InlineEdit value={s.title} onSave={v => { updateSchedule(s.id, { title: v }).then(loadBrief).catch(() => toast.error('更新失败')) }}
                      className="text-xs font-medium" style={{ color: 'var(--text)' }} />
                    <div className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                      <Clock size={10} /> {dateP}{time}{s.duration_minutes ? ` · ${s.duration_minutes}分钟` : ''}
                    </div>
                  </div>
                  <button onClick={() => handleScheduleDelete(s.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--bg-hover)]">
                    <Trash2 size={11} style={{ color: 'var(--text-muted)' }} />
                  </button>
                </div>)
              })}</div> : <div className="text-center py-6 text-[11px]" style={{ color: 'var(--text-muted)' }}>暂无日程</div>}
            </div>
          </div>

          {/* 跟进 */}
          <div className="rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <Users size={14} style={{ color: '#a855f7' }} />
                <h3 className="text-xs font-bold" style={{ color: 'var(--text)' }}>跟进提醒</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>{filteredFollowups.length}</span>
              </div>
              <div className="flex items-center gap-1 relative">
                <RangeTabs value={followupRange} onChange={setFollowupRange} />
                <button onClick={() => setShowCreate(showCreate === 'followup' ? null : 'followup')}
                  className="p-1 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--accent)' }}><Plus size={14} /></button>
                {showCreate === 'followup' && <QuickCreate type="followup" onCreated={loadBrief} onClose={() => setShowCreate(null)} />}
              </div>
            </div>
            <div className="px-4 py-3">
              {filteredFollowups.length ? <div className="space-y-2">{filteredFollowups.map((f, i) => {
                const isOD = f.due_date && new Date(f.due_date) < new Date(new Date().toDateString())
                const dl = f.due_date ? Math.ceil((new Date(f.due_date).getTime() - Date.now()) / 86400000) : null
                return (<div key={i} className="flex items-start gap-2.5 px-3 py-2 rounded-lg group"
                  onContextMenu={e => { e.preventDefault(); setFollowupCtx({ x: e.clientX, y: e.clientY, item: f }) }}
                  style={{ background: isOD ? '#ef444408' : 'var(--bg)' }}>
                  <span className="text-sm mt-0.5">{f.target ? '👤' : '📋'}</span>
                  <div className="flex-1 min-w-0">
                    <InlineEdit value={`${f.target ? f.target + ' — ' : ''}${f.title}`}
                      onSave={v => { handleFollowupUpdate(f.id, 'title', v) }}
                      className="text-xs font-medium truncate" style={{ color: 'var(--text)' }} />
                    <div className="text-[10px] mt-0.5" style={{ color: isOD ? '#ef4444' : 'var(--text-muted)' }}>
                      {isOD ? `逾期 ${Math.abs(dl!)} 天` : dl !== null ? (dl === 0 ? '今天到期' : `${dl} 天后`) : ''}</div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 flex gap-0.5">
                    <button onClick={() => handleFollowupUpdate(f.id, 'status', 'done')}
                      className="p-1 rounded hover:bg-[var(--bg-hover)]"><CheckCircle2 size={11} style={{ color: '#22c55e' }} /></button>
                    <button onClick={() => handleFollowupDelete(f.id)}
                      className="p-1 rounded hover:bg-[var(--bg-hover)]"><Trash2 size={11} style={{ color: 'var(--text-muted)' }} /></button>
                  </div>
                </div>)
              })}</div> : <div className="text-center py-6 text-[11px]" style={{ color: 'var(--text-muted)' }}>暂无跟进事项</div>}
            </div>
          </div>
        </div>

        {scheduleCtx && <ContextMenu x={scheduleCtx.x} y={scheduleCtx.y} onClose={() => setScheduleCtx(null)} items={[
          { label: 'AI 调整', icon: MessageSquare, color: 'var(--accent)', onClick: () => toChat(`帮我调整日程：${scheduleCtx.item.title}`) },
          { label: '删除', icon: Trash2, color: '#ef4444', onClick: () => handleScheduleDelete(scheduleCtx.item.id) },
        ]} />}

        {followupCtx && <ContextMenu x={followupCtx.x} y={followupCtx.y} onClose={() => setFollowupCtx(null)} items={[
          { label: '标记完成', icon: CheckCircle2, color: '#22c55e', onClick: () => handleFollowupUpdate(followupCtx.item.id, 'status', 'done') },
          { label: 'AI 跟进', icon: MessageSquare, color: 'var(--accent)', onClick: () => toChat(`帮我跟进：${followupCtx.item.title}`) },
          { label: '删除', icon: Trash2, color: '#ef4444', onClick: () => handleFollowupDelete(followupCtx.item.id) },
        ]} />}
      </div>
    </div>
  )
}
