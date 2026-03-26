import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, BookOpen, Zap, Target, Users,
         CheckCircle, XCircle, Loader2, RefreshCw, ArrowRight, Sparkles,
         BarChart3, FileText, Calendar } from 'lucide-react'
import { useWorkstationStore } from '../stores/useWorkstationStore'
import { useAuthStore } from '../stores/useAuthStore'
import client from '../api/client'

interface ActionItem {
  title: string; reason: string; action: string
  type: 'chat' | 'workflow' | 'followup' | 'task'
  urgency: 'high' | 'medium' | 'low'
  metadata?: Record<string, any>
}

interface BriefData {
  greeting: string; summary: string; actions: ActionItem[]
  stats: Record<string, number>
  workflow_status: Array<{ name: string; status: string; error: string; workflow_id: string }>
  today_schedules: Array<{ title: string; scheduled_time: string }>
  recent_sessions: Array<{ id: string; title: string }>
}

const urgencyStyle = (u: string) => ({
  high: { bg: '#ef444415', border: '#ef444440', color: '#ef4444', icon: '🔴' },
  medium: { bg: '#f59e0b15', border: '#f59e0b40', color: '#f59e0b', icon: '🟡' },
  low: { bg: '#22c55e15', border: '#22c55e40', color: '#22c55e', icon: '🟢' },
}[u] || { bg: 'var(--bg-surface)', border: 'var(--border)', color: 'var(--text-muted)', icon: '⚪' })

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

  const handleAction = (a: ActionItem) => {
    if (a.type === 'chat') navigate(`/chat?prompt=${encodeURIComponent(a.metadata?.prompt || a.title)}`)
    else if (a.type === 'workflow') navigate(a.metadata?.workflowId ? `/workflows/${a.metadata.workflowId}` : '/workflows')
    else navigate(`/chat?prompt=${encodeURIComponent(`帮我处理：${a.title}`)}`)
  }

  // ── Loading ──
  if (homeLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent)' }} /></div>

  // ── 未选岗位 ──
  if (!home?.assigned) {
    return (
      <div className="p-8 max-w-[900px] mx-auto text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--accent)15' }}>
          <Sparkles size={32} style={{ color: 'var(--accent)' }} />
        </div>
        <h1 className="text-xl font-bold mb-2">选择您的工位岗位</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>选择岗位后，AI 助手将根据职责提供定制化支持</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-left">
          {positions.map(pos => (
            <button key={pos.position_id} onClick={() => assignPosition(pos.position_id)}
              className="p-5 rounded-xl text-left transition-all hover:border-[var(--accent)] hover:shadow-lg"
              style={{ background: 'var(--bg-surface)', border: '2px solid var(--border)' }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 text-lg"
                style={{ background: `${pos.color || 'var(--accent)'}20`, color: pos.color || 'var(--accent)' }}>
                {pos.icon === 'bot' ? '🤖' : '💼'}
              </div>
              <h3 className="font-medium text-sm mb-0.5">{pos.display_name}</h3>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{pos.department}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── AI 驾驶舱 ──
  const pos = home.position
  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-6">
      {/* 顶部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
            style={{ background: `${pos?.color || 'var(--accent)'}20`, color: pos?.color || 'var(--accent)' }}>✦</div>
          <div>
            <h1 className="text-lg font-bold">{pos?.display_name || '工位'}</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
            </p>
          </div>
        </div>
        <button onClick={loadBrief} disabled={loadingBrief} className="p-2 rounded-lg hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}>
          <RefreshCw size={16} className={loadingBrief ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* AI 行动建议 */}
      <div className="rounded-xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-bold">{brief?.greeting || '你好'}，今日行动</h2>
          {loadingBrief && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />}
        </div>
        {brief?.summary && <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>{brief.summary}</p>}
        {brief?.actions?.length ? (
          <div className="space-y-2">
            {brief.actions.map((a, i) => {
              const us = urgencyStyle(a.urgency)
              return (
                <button key={i} onClick={() => handleAction(a)}
                  className="w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all hover:shadow-md group"
                  style={{ background: us.bg, border: `1px solid ${us.border}` }}>
                  <span className="text-sm mt-0.5">{us.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{a.title}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{a.reason}</div>
                    <div className="text-[10px] mt-1 flex items-center gap-1" style={{ color: us.color }}>
                      {a.type === 'chat' && <MessageSquare size={10} />}
                      {a.type === 'workflow' && <Zap size={10} />}
                      {a.type === 'followup' && <Users size={10} />}
                      {a.type === 'task' && <Target size={10} />}
                      {a.action}
                    </div>
                  </div>
                  <ArrowRight size={14} className="shrink-0 mt-1 opacity-0 group-hover:opacity-100" style={{ color: us.color }} />
                </button>
              )
            })}
          </div>
        ) : !loadingBrief ? (
          <div className="text-center py-6">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>暂无行动建议</p>
            <button onClick={() => navigate('/chat?prompt=' + encodeURIComponent('帮我规划今天的工作'))}
              className="mt-2 text-xs px-3 py-1.5 rounded-lg" style={{ color: 'var(--accent)', border: '1px solid var(--accent)' }}>
              告诉 AI 你今天要做什么
            </button>
          </div>
        ) : null}
      </div>

      {/* 工作流状态 + 今日概览 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5"><Zap size={14} style={{ color: 'var(--accent)' }} /><h3 className="text-xs font-bold">工作流状态</h3></div>
            <button onClick={() => navigate('/workflows')} className="text-[10px]" style={{ color: 'var(--accent)' }}>查看全部</button>
          </div>
          {brief?.workflow_status?.length ? (
            <div className="space-y-1.5">
              {brief.workflow_status.slice(0, 4).map((wf, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[var(--bg-hover)]"
                  onClick={() => wf.workflow_id && navigate(`/workflows/${wf.workflow_id}`)}>
                  {wf.status === 'completed' ? <CheckCircle size={12} style={{ color: '#22c55e' }} /> : <XCircle size={12} style={{ color: '#ef4444' }} />}
                  <span className="text-xs flex-1 truncate">{wf.name}</span>
                </div>
              ))}
            </div>
          ) : <div className="text-center py-4 text-[10px]" style={{ color: 'var(--text-muted)' }}>暂无工作流</div>}
        </div>

        <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-1.5 mb-3"><BarChart3 size={14} style={{ color: 'var(--accent)' }} /><h3 className="text-xs font-bold">今日概览</h3></div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: Target, label: '待办', value: brief?.stats?.pending_tasks ?? '-', color: '#3b82f6' },
              { icon: Calendar, label: '日程', value: brief?.stats?.today_schedules ?? '-', color: '#22c55e' },
              { icon: Users, label: '跟进', value: brief?.stats?.overdue_followups ?? '-', color: (brief?.stats?.overdue_followups || 0) > 0 ? '#ef4444' : '#6b7280' },
              { icon: Zap, label: '工作流', value: brief?.stats?.total_workflows ?? '-', color: '#a855f7' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--bg)' }}>
                <Icon size={14} style={{ color }} />
                <div><div className="text-sm font-bold">{value}</div><div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{label}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 今日日程 */}
      {brief?.today_schedules?.length ? (
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-1.5 mb-3"><Calendar size={14} style={{ color: 'var(--accent)' }} /><h3 className="text-xs font-bold">今日日程</h3></div>
          <div className="space-y-1.5">
            {brief.today_schedules.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-[10px] shrink-0" style={{ color: 'var(--accent)' }}>{s.scheduled_time?.split(' ')[1]?.slice(0, 5) || ''}</span>
                <span>{s.title}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* 快捷操作 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { to: '/chat', icon: MessageSquare, label: '对话', desc: 'AI 助手', color: '#3b82f6' },
          { to: '/knowledge', icon: BookOpen, label: '知识库', desc: '文档检索', color: '#22c55e' },
          { to: '/workflows', icon: Zap, label: '工作流', desc: '自动化', color: '#a855f7' },
          { to: '/chat?prompt=' + encodeURIComponent('帮我创建一个任务'), icon: FileText, label: '新任务', desc: '快速创建', color: '#f59e0b' },
        ].map(({ to, icon: Icon, label, desc, color }) => (
          <button key={label} onClick={() => navigate(to)}
            className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all hover:shadow-md hover:border-[var(--accent)]"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}15`, color }}><Icon size={20} /></div>
            <div className="text-xs font-medium">{label}</div>
            <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{desc}</div>
          </button>
        ))}
      </div>

      {/* 最近对话 */}
      {brief?.recent_sessions?.length ? (
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5"><MessageSquare size={14} style={{ color: 'var(--accent)' }} /><h3 className="text-xs font-bold">最近对话</h3></div>
            <button onClick={() => navigate('/chat')} className="text-[10px]" style={{ color: 'var(--accent)' }}>查看全部</button>
          </div>
          <div className="space-y-1">
            {brief.recent_sessions.map((s, i) => (
              <button key={i} onClick={() => navigate('/chat')}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}>
                <MessageSquare size={12} /><span className="truncate">{s.title || '新对话'}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
