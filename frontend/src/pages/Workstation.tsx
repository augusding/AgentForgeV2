import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Target, Calendar, Users, AlertCircle, Plus, RefreshCw, Sparkles, Loader2, CheckCircle2, Clock } from 'lucide-react'
import { useWorkstationStore } from '../stores/useWorkstationStore'
import { useAuthStore } from '../stores/useAuthStore'
import client from '../api/client'

interface BriefData {
  greeting: string; summary: string
  actions: Array<{ title: string; reason: string; urgency: string }>
  stats: Record<string, number>
  today_schedules: Array<{ id: string; title: string; scheduled_time: string; duration_minutes: number }>
  priorities: Array<{ id: string; title: string; priority: string; status: string; due_date: string }>
  work_items: Array<{ id: string; title: string; status: string; priority: string; due_date: string }>
  followups: Array<{ id: string; title: string; target: string; status: string; due_date: string }>
}

const P_ICON: Record<string, string> = { P0: '🔴', P1: '🟡', P2: '🔵', P3: '⚪' }

export default function Workstation() {
  const { home, positions, loading: homeLoading, loadHome, assignPosition: rawAssign } = useWorkstationStore()
  const { setActivePosition } = useAuthStore()
  const navigate = useNavigate()
  const [brief, setBrief] = useState<BriefData | null>(null)
  const [loadingBrief, setLoadingBrief] = useState(false)

  const assignPosition = async (pid: string) => { await rawAssign(pid); setActivePosition(pid) }
  useEffect(() => { loadHome() }, [])
  useEffect(() => { if (home?.assigned) loadBrief() }, [home?.assigned])

  const loadBrief = async () => {
    setLoadingBrief(true)
    try { setBrief(await client.post('/workstation/daily-brief', {}) as any) } catch {}
    finally { setLoadingBrief(false) }
  }

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

  const pos = home.position
  const allTasks = [
    ...(brief?.priorities || []).map(t => ({ ...t, source: 'priority' })),
    ...(brief?.work_items || []).map(t => ({ ...t, source: 'work_item' })),
  ]
  const todoTasks = allTasks.filter(t => ['active', 'todo', 'pending'].includes(t.status))
  const doingTasks = allTasks.filter(t => ['in_progress', 'doing'].includes(t.status))
  const doneTasks = allTasks.filter(t => ['completed', 'done'].includes(t.status))
  const schedules = brief?.today_schedules || []
  const followups = (brief?.followups || []).filter(f => f.status !== 'done')
  const overdue = todoTasks.filter(t => t.due_date && new Date(t.due_date) < new Date(new Date().toDateString()))

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
                {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
              </p>
            </div>
          </div>
          <button onClick={loadBrief} disabled={loadingBrief} className="p-2 rounded-lg hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}>
            <RefreshCw size={16} className={loadingBrief ? 'animate-spin' : ''} /></button>
        </div>

        {/* ① 概览条 */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { icon: Target, label: '待办', value: todoTasks.length, color: '#3b82f6', bg: '#3b82f610' },
            { icon: Calendar, label: '今日日程', value: schedules.length, color: '#22c55e', bg: '#22c55e10' },
            { icon: Users, label: '跟进', value: followups.length, color: '#a855f7', bg: '#a855f710' },
            { icon: AlertCircle, label: '逾期', value: overdue.length, color: overdue.length > 0 ? '#ef4444' : '#6b7280', bg: overdue.length > 0 ? '#ef444410' : 'var(--bg-surface)' },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: bg, border: '1px solid var(--border)' }}>
              <Icon size={18} style={{ color }} />
              <div><div className="text-xl font-bold" style={{ color }}>{value}</div>
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</div></div>
            </div>
          ))}
        </div>

        {/* ② 任务看板 */}
        <div className="rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2">
              <Target size={16} style={{ color: 'var(--accent)' }} />
              <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>任务</h2>
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>{allTasks.length}</span>
            </div>
            <button onClick={() => navigate('/chat?prompt=' + encodeURIComponent('帮我创建一个任务'))}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px]" style={{ color: 'var(--accent)', border: '1px solid var(--accent)30' }}>
              <Plus size={12} /> 新建</button>
          </div>
          <div className="grid grid-cols-3 gap-0 min-h-[160px]">
            <TaskCol title="待处理" count={todoTasks.length} color="#f59e0b" tasks={todoTasks} nav={navigate} />
            <TaskCol title="进行中" count={doingTasks.length} color="#3b82f6" tasks={doingTasks} nav={navigate} border />
            <TaskCol title="已完成" count={doneTasks.length} color="#22c55e" tasks={doneTasks.slice(0, 5)} nav={navigate} border done />
          </div>
        </div>

        {/* ③④ 日程 + 跟进 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <Calendar size={14} style={{ color: '#22c55e' }} />
              <h3 className="text-xs font-bold" style={{ color: 'var(--text)' }}>今日日程</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>{schedules.length}</span>
            </div>
            <div className="px-4 py-3">
              {schedules.length ? <div className="space-y-2">{schedules.map((s, i) => {
                const time = s.scheduled_time?.split(' ')[1]?.slice(0, 5) || ''
                return (<div key={i} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full mt-1.5" style={{ background: '#22c55e' }} />
                    {i < schedules.length - 1 && <div className="w-px flex-1 mt-1" style={{ background: 'var(--border)' }} />}
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="text-xs font-medium" style={{ color: 'var(--text)' }}>{s.title}</div>
                    <div className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                      <Clock size={10} /> {time}{s.duration_minutes ? ` · ${s.duration_minutes}分钟` : ''}</div>
                  </div>
                </div>)
              })}</div> : <div className="text-center py-6 text-[11px]" style={{ color: 'var(--text-muted)' }}>今天没有日程安排</div>}
            </div>
          </div>

          <div className="rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <Users size={14} style={{ color: '#a855f7' }} />
              <h3 className="text-xs font-bold" style={{ color: 'var(--text)' }}>跟进提醒</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>{followups.length}</span>
            </div>
            <div className="px-4 py-3">
              {followups.length ? <div className="space-y-2">{followups.map((f, i) => {
                const isOD = f.due_date && new Date(f.due_date) < new Date(new Date().toDateString())
                const dl = f.due_date ? Math.ceil((new Date(f.due_date).getTime() - Date.now()) / 86400000) : null
                return (<div key={i} className="flex items-start gap-2.5 px-3 py-2 rounded-lg" style={{ background: isOD ? '#ef444408' : 'var(--bg)' }}>
                  <span className="text-sm mt-0.5">{f.target ? '👤' : '📋'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{f.target ? `${f.target} — ` : ''}{f.title}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: isOD ? '#ef4444' : 'var(--text-muted)' }}>
                      {isOD ? `逾期 ${Math.abs(dl!)} 天` : dl !== null ? (dl === 0 ? '今天到期' : `${dl} 天后`) : ''}</div>
                  </div>
                </div>)
              })}</div> : <div className="text-center py-6 text-[11px]" style={{ color: 'var(--text-muted)' }}>暂无跟进事项</div>}
            </div>
          </div>
        </div>

        {/* ⑤ AI 建议 */}
        {brief?.actions?.length ? (
          <div className="rounded-xl px-5 py-3 flex items-start gap-3" style={{ background: 'var(--accent)08', border: '1px dashed var(--accent)30' }}>
            <Sparkles size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
            <div>
              <div className="text-xs font-medium mb-1" style={{ color: 'var(--text)' }}>AI 建议</div>
              <div className="text-[11px] space-y-1" style={{ color: 'var(--text-muted)' }}>
                {brief.actions.slice(0, 3).map((a, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span>{a.urgency === 'high' ? '🔴' : a.urgency === 'medium' ? '🟡' : '🟢'}</span>
                    <span>{a.title}</span>
                    <button onClick={() => navigate(`/chat?prompt=${encodeURIComponent(`帮我处理：${a.title}`)}`)}
                      className="text-[10px] ml-1 underline" style={{ color: 'var(--accent)' }}>处理</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function TaskCol({ title, count, color, tasks, nav, border, done }: {
  title: string; count: number; color: string; tasks: any[]; nav: any; border?: boolean; done?: boolean
}) {
  return (
    <div className={`px-4 py-3 ${border ? 'border-l' : ''}`} style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
        <span className="text-[11px] font-medium" style={{ color: 'var(--text)' }}>{title}</span>
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{count}</span>
      </div>
      {tasks.length ? <div className="space-y-1.5">{tasks.map((t, i) => (
        <div key={i} className="px-2.5 py-2 rounded-lg cursor-pointer hover:bg-[var(--bg-hover)]" style={{ background: 'var(--bg)' }}
          onClick={() => nav(`/chat?prompt=${encodeURIComponent(`查看任务详情：${t.title}`)}`)}>
          <div className="flex items-center gap-1.5">
            {done ? <CheckCircle2 size={11} style={{ color: '#22c55e' }} /> : <span className="text-[10px]">{P_ICON[t.priority] || '⚪'}</span>}
            <span className={`text-xs flex-1 truncate ${done ? 'line-through' : ''}`}
              style={{ color: done ? 'var(--text-muted)' : 'var(--text)' }}>{t.title}</span>
          </div>
          {!done && t.due_date && <div className="text-[9px] mt-1 ml-4" style={{
            color: new Date(t.due_date) < new Date(new Date().toDateString()) ? '#ef4444' : 'var(--text-muted)' }}>截止 {t.due_date}</div>}
        </div>
      ))}</div> : <div className="text-center py-4 text-[10px]" style={{ color: 'var(--text-muted)' }}>{done ? '暂无完成' : '暂无任务'}</div>}
    </div>
  )
}
