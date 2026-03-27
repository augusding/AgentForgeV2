/**
 * 富交互卡片：将工具调用结果渲染为可操作的 UI 卡片。
 */
import { useState } from 'react'
import { CheckCircle, Circle, Clock, Users, Download,
         BarChart3, Search, ChevronDown, ChevronRight, Target } from 'lucide-react'
import client from '../api/client'
import toast from 'react-hot-toast'

interface CardData { type: string; data: any; toolName: string }

/** 从工具名和结果解析卡片类型 */
export function parseCard(toolName: string, resultStr: string): CardData | null {
  try {
    const data = typeof resultStr === 'string' ? JSON.parse(resultStr) : resultStr
    if (!data || typeof data !== 'object') return null
    // 文件操作结果
    if ((data.status === 'converted' || (data.status === 'created' && data.path)) &&
        ['document_converter', 'word_processor', 'excel_processor', 'pdf_processor', 'ppt_processor'].includes(toolName))
      return { type: 'file', data, toolName }
    if (toolName === 'manage_priority' || toolName === 'manage_work_item') {
      if (data.priorities || data.work_items || data.status) return { type: 'task', data, toolName }
    }
    if (toolName === 'manage_schedule') return { type: 'schedule', data, toolName }
    if (toolName === 'manage_followup') return { type: 'followup', data, toolName }
    if (toolName === 'search_knowledge' && data.results) return { type: 'search', data, toolName }
    if (['calculator', 'datetime'].includes(toolName)) return { type: 'data', data, toolName }
    return null
  } catch { return null }
}

/** 渲染交互卡片 */
export default function ActionCard({ card, onFileClick }: { card: CardData; onFileClick?: (f: any) => void }) {
  switch (card.type) {
    case 'task': return <TaskCard data={card.data} />
    case 'schedule': return <ScheduleCard data={card.data} />
    case 'followup': return <FollowupCard data={card.data} />
    case 'search': return <SearchResultCard data={card.data} />
    case 'data': return <DataCard data={card.data} tool={card.toolName} />
    case 'file': return <FileCard2 data={card.data} onFileClick={onFileClick} />
    default: return null
  }
}

const cs = { background: 'var(--bg)', border: '1px solid var(--border)' }

/* ── 任务卡片 ── */
function TaskCard({ data }: { data: any }) {
  const [items, setItems] = useState<any[]>(data.priorities || data.work_items || [])
  const created = data.status === 'created' || data.status === 'updated'

  const toggle = async (id: string, cur: string) => {
    const ns = cur === 'done' ? 'active' : 'done'
    try { await client.post('/daily-context/priorities', { action: 'update', id, status: ns }); setItems(p => p.map(x => x.id === id ? { ...x, status: ns } : x)); toast.success(ns === 'done' ? '已完成' : '已恢复') } catch { toast.error('操作失败') }
  }

  if (created) return (
    <div className="rounded-lg p-3 my-2" style={cs}>
      <div className="flex items-center gap-2">
        <CheckCircle size={16} style={{ color: '#22c55e' }} />
        <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>任务已{data.status === 'created' ? '创建' : '更新'}</span>
        {data.id && <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>#{data.id.slice(0, 8)}</span>}
      </div>
    </div>
  )

  if (!items.length) return null
  return (
    <div className="rounded-lg overflow-hidden my-2" style={cs}>
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <Target size={14} style={{ color: 'var(--accent)' }} />
        <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>待办事项 ({items.length})</span>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {items.slice(0, 8).map((p: any) => (
          <div key={p.id} className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-hover)] transition-colors">
            <button onClick={() => toggle(p.id, p.status)}>
              {p.status === 'done' ? <CheckCircle size={14} style={{ color: '#22c55e' }} /> : <Circle size={14} style={{ color: 'var(--border)' }} />}
            </button>
            <span className={`text-xs flex-1 ${p.status === 'done' ? 'line-through' : ''}`}
              style={{ color: p.status === 'done' ? 'var(--text-muted)' : 'var(--text)' }}>{p.title}</span>
            {p.priority && <span className="text-[9px] px-1.5 py-0.5 rounded font-medium"
              style={{ background: p.priority === 'P0' ? '#ef444420' : p.priority === 'P1' ? '#f59e0b20' : '#3b82f620',
                       color: p.priority === 'P0' ? '#ef4444' : p.priority === 'P1' ? '#f59e0b' : '#3b82f6' }}>{p.priority}</span>}
            {p.due_date && <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{p.due_date}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── 日程卡片 ── */
function ScheduleCard({ data }: { data: any }) {
  const items = data.schedules || []
  if (data.status === 'created') return (
    <div className="rounded-lg p-3 my-2" style={cs}>
      <div className="flex items-center gap-2"><Clock size={16} style={{ color: '#22c55e' }} />
        <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>日程已创建</span></div>
    </div>
  )
  if (!items.length) return null
  return (
    <div className="rounded-lg overflow-hidden my-2" style={cs}>
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <Clock size={14} style={{ color: 'var(--accent)' }} /><span className="text-xs font-medium" style={{ color: 'var(--text)' }}>日程 ({items.length})</span>
      </div>
      {items.slice(0, 6).map((s: any, i: number) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-[10px] font-mono shrink-0 w-[50px]" style={{ color: 'var(--accent)' }}>{(s.scheduled_time || '').split(' ')[1]?.slice(0, 5) || ''}</span>
          <span className="text-xs" style={{ color: 'var(--text)' }}>{s.title}</span>
          {s.duration_minutes && <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{s.duration_minutes}min</span>}
        </div>
      ))}
    </div>
  )
}

/* ── 跟进卡片 ── */
function FollowupCard({ data }: { data: any }) {
  const items = data.followups || []
  if (data.status === 'created') return (
    <div className="rounded-lg p-3 my-2" style={cs}>
      <div className="flex items-center gap-2"><Users size={16} style={{ color: '#22c55e' }} />
        <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>跟进已创建</span></div>
    </div>
  )
  if (!items.length) return null
  return (
    <div className="rounded-lg overflow-hidden my-2" style={cs}>
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <Users size={14} style={{ color: 'var(--accent)' }} /><span className="text-xs font-medium" style={{ color: 'var(--text)' }}>跟进事项 ({items.length})</span>
      </div>
      {items.slice(0, 6).map((f: any, i: number) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-xs flex-1" style={{ color: 'var(--text)' }}>{f.title}</span>
          {f.target && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>@{f.target}</span>}
          {f.status === 'pending' && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: '#f59e0b20', color: '#f59e0b' }}>待跟进</span>}
        </div>
      ))}
    </div>
  )
}

/* ── 知识库搜索结果卡片 ── */
function SearchResultCard({ data }: { data: any }) {
  const results = data.results || []
  const [expanded, setExpanded] = useState<number | null>(null)
  if (!results.length) {
    if (data.message) return <div className="rounded-lg p-3 my-2 text-xs" style={{ ...cs, color: 'var(--text-muted)' }}>🔍 {data.message}</div>
    return null
  }
  return (
    <div className="rounded-lg overflow-hidden my-2" style={cs}>
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <Search size={14} style={{ color: 'var(--accent)' }} /><span className="text-xs font-medium" style={{ color: 'var(--text)' }}>知识库结果 ({results.length})</span>
      </div>
      {results.slice(0, 5).map((r: any, i: number) => (
        <div key={i} className="px-3 py-2 cursor-pointer hover:bg-[var(--bg-hover)]" style={{ borderBottom: '1px solid var(--border)' }}
          onClick={() => setExpanded(expanded === i ? null : i)}>
          <div className="flex items-center gap-2">
            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--accent)20', color: 'var(--accent)' }}>
              {((r.score || 0) * 100).toFixed(0)}%</span>
            {r.source && <span className="text-[9px] truncate" style={{ color: 'var(--text-muted)' }}>{r.source}</span>}
            {expanded === i ? <ChevronDown size={10} className="ml-auto" style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={10} className="ml-auto" style={{ color: 'var(--text-muted)' }} />}
          </div>
          {expanded === i && <div className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{(r.content || '').slice(0, 300)}</div>}
        </div>
      ))}
    </div>
  )
}

/* ── 数据/计算结果卡片 ── */
function DataCard({ data, tool }: { data: any; tool: string }) {
  const label = tool === 'calculator' ? '计算结果' : tool === 'datetime' ? '日期时间' : '数据'
  const resultVal = data.result ?? data.value ?? data

  if (typeof resultVal === 'number' || (typeof resultVal === 'string' && !resultVal.startsWith('{'))) {
    return (
      <div className="rounded-lg p-3 my-2 flex items-center gap-3" style={cs}>
        <BarChart3 size={16} style={{ color: 'var(--accent)' }} />
        <div><div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</div>
          <div className="text-sm font-bold font-mono" style={{ color: 'var(--accent)' }}>{String(resultVal)}</div></div>
      </div>
    )
  }

  return (
    <div className="rounded-lg overflow-hidden my-2" style={cs}>
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <BarChart3 size={14} style={{ color: 'var(--accent)' }} /><span className="text-xs font-medium" style={{ color: 'var(--text)' }}>{label}</span>
      </div>
      <pre className="p-3 text-[10px] font-mono overflow-auto max-h-[150px]" style={{ color: 'var(--text-muted)' }}>
        {typeof resultVal === 'object' ? JSON.stringify(resultVal, null, 2) : String(resultVal)}
      </pre>
    </div>
  )
}

/* ── 文件卡片（点击打开侧栏预览） ── */
function FileCard2({ data, onFileClick }: { data: any; onFileClick?: (f: any) => void }) {
  const name = data.filename || '文件'; const path = data.path || ''; const size = data.size || 0
  const fmt = (data.format || path.split('.').pop() || '').toUpperCase()
  const FI: Record<string, { icon: string; color: string }> = {
    DOCX: { icon: '📄', color: '#2b579a' }, PDF: { icon: '📕', color: '#d32f2f' },
    XLSX: { icon: '📗', color: '#217346' }, PPTX: { icon: '📙', color: '#d24726' },
    CSV: { icon: '📊', color: '#22c55e' }, MD: { icon: '📝', color: '#6366f1' }, TXT: { icon: '📃', color: '#6b7280' },
  }
  const fi = FI[fmt] || { icon: '📎', color: 'var(--accent)' }
  const sizeStr = size > 1048576 ? `${(size / 1048576).toFixed(1)} MB` : size > 1024 ? `${(size / 1024).toFixed(1)} KB` : `${size} B`
  const dl = (e: React.MouseEvent) => {
    e.stopPropagation(); if (!path) return
    const tk = localStorage.getItem('agentforge_token') || ''
    fetch(`/api/v1/files/download/${path}`, { headers: { Authorization: `Bearer ${tk}` } })
      .then(r => r.blob()).then(b => { const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u) })
      .catch(() => toast.error('下载失败'))
  }
  return (
    <div className="my-2 rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      onClick={() => onFileClick?.({ path, filename: name, format: data.format, size })}>
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-xl">{fi.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{name}</div>
          <div className="text-[10px] flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: `${fi.color}15`, color: fi.color }}>{fmt}</span>
            <span>{sizeStr}</span><span>· 点击预览</span>
          </div>
        </div>
        <button onClick={dl} className="p-2 rounded-lg hover:bg-[var(--bg)]" style={{ color: 'var(--text-muted)' }} title="下载">
          <Download size={16} />
        </button>
      </div>
    </div>
  )
}
