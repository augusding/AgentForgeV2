import { useState, useEffect } from 'react'
import { TrendingUp, RefreshCw, Loader2, Trash2, User } from 'lucide-react'
import client from '../../api/client'
import toast from 'react-hot-toast'

interface Signal { id: string; position_id: string; user_id: string; signal_type: string; user_need: string; suggest_field: string; suggest_change: string; scope: string; trigger_reason: string; created_at: number }
interface ProfileEntry { id: string; category: string; content: string; source: string; confidence: number; updated_at: number }

const SIG_CLR: Record<string, string> = { '追问': '#f59e0b', '纠正': '#ef4444', '放弃': '#6b7280' }
const FLD_CLR: Record<string, string> = { context: '#3b82f6', behavior: '#a855f7', identity: '#0ea5e9', values: '#10b981' }
const CAT_LBL: Record<string, string> = { team_rule: '团队规范', personal_context: '工作上下文', preferred_style: '沟通偏好' }
const CAT_CLR: Record<string, string> = { team_rule: '#f59e0b', personal_context: '#3b82f6', preferred_style: '#a855f7' }

function Badge({ color, text }: { color: string; text: string }) {
  return <span style={{ background: color + '18', color, border: `1px solid ${color}33`, fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600, whiteSpace: 'nowrap' as const }}>{text}</span>
}
function ago(ts: number) { const d = Date.now() / 1000 - ts; return d < 3600 ? `${Math.floor(d / 60)}分钟前` : d < 86400 ? `${Math.floor(d / 3600)}小时前` : `${Math.floor(d / 86400)}天前` }

function SignalList() {
  const [signals, setSignals] = useState<Signal[]>([]); const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState(''); const [filterScope, setFilterScope] = useState('')
  const load = () => {
    setLoading(true); const p = new URLSearchParams({ limit: '100' })
    if (filterType) p.set('signal_type', filterType)
    client.get(`/evolution/signals?${p}`).then((d: any) => setSignals(d.signals || [])).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [filterType])
  const filtered = filterScope ? signals.filter(s => s.scope === filterScope) : signals
  const grouped = filtered.reduce<Record<string, Signal[]>>((a, s) => { (a[s.position_id] = a[s.position_id] || []).push(s); return a }, {})

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>类型：</span>
        {['', '追问', '纠正', '放弃'].map(t => <button key={t} onClick={() => setFilterType(t)} className="px-2 py-0.5 rounded-full text-[10px]"
          style={{ background: filterType === t ? 'var(--accent)' : 'var(--bg-surface)', color: filterType === t ? 'white' : 'var(--text-muted)', border: '1px solid var(--border)' }}>{t || '全部'}</button>)}
        <span className="ml-3 text-xs" style={{ color: 'var(--text-muted)' }}>范围：</span>
        {[['', '全部'], ['shared', '共性'], ['personal', '个人']].map(([v, l]) => <button key={v} onClick={() => setFilterScope(v)} className="px-2 py-0.5 rounded-full text-[10px]"
          style={{ background: filterScope === v ? 'var(--accent)' : 'var(--bg-surface)', color: filterScope === v ? 'white' : 'var(--text-muted)', border: '1px solid var(--border)' }}>{l}</button>)}
        <button onClick={load} className="ml-auto p-1.5 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /></button>
      </div>
      {loading ? <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto" size={20} style={{ color: 'var(--accent)' }} /></div>
       : !Object.keys(grouped).length ? <div className="rounded-xl p-8 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
           <TrendingUp size={28} className="mx-auto mb-2" style={{ color: 'var(--border)' }} />
           <p className="text-xs" style={{ color: 'var(--text-muted)' }}>暂无信号。用户对话后系统自动分析。</p></div>
       : Object.entries(grouped).map(([posId, items]) => (
         <div key={posId}>
           <div className="flex items-center gap-2 mb-2">
             <span className="text-xs font-semibold">{posId}</span>
             <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>{items.length} 条</span>
           </div>
           <div className="space-y-1.5 mb-4">
             {items.map(s => (
               <div key={s.id} className="px-3 py-2.5 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                 <div className="flex items-start gap-2">
                   <Badge color={SIG_CLR[s.signal_type] || '#6b7280'} text={s.signal_type} />
                   {s.scope === 'personal' && <Badge color="#0ea5e9" text="个人" />}
                   <p className="flex-1 text-xs min-w-0">{s.user_need || '—'}</p>
                   <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>{ago(s.created_at)}</span>
                 </div>
                 {s.suggest_change && <div className="mt-1.5 flex items-start gap-1.5">
                   <span className="text-[9px] mt-0.5 shrink-0" style={{ color: 'var(--text-muted)' }}>建议改</span>
                   <Badge color={FLD_CLR[s.suggest_field] || '#6b7280'} text={s.suggest_field} />
                   <span className="text-[10px] italic" style={{ color: 'var(--text-muted)' }}>{s.suggest_change}</span>
                 </div>}
               </div>
             ))}
           </div>
         </div>
       ))}
    </div>
  )
}

function ProfileViewer({ positions }: { positions: string[] }) {
  const [pid, setPid] = useState(positions[0] || '')
  const [entries, setEntries] = useState<ProfileEntry[]>([]); const [loading, setLoading] = useState(false)
  const load = (p: string) => { if (!p) return; setLoading(true); client.get(`/evolution/profile?position_id=${p}`).then((d: any) => setEntries(d.entries || [])).catch(() => {}).finally(() => setLoading(false)) }
  useEffect(() => { load(pid) }, [pid])
  const del = async (id: string) => { try { await client.delete(`/evolution/profile/${id}`); setEntries(p => p.filter(e => e.id !== id)); toast.success('已删除') } catch { toast.error('失败') } }

  return (
    <div className="space-y-4">
      {positions.length > 1 && <div className="flex gap-2 flex-wrap">
        {positions.map(p => <button key={p} onClick={() => setPid(p)} className="px-2.5 py-1 rounded-full text-[10px]"
          style={{ background: pid === p ? 'var(--accent)' : 'var(--bg-surface)', color: pid === p ? 'white' : 'var(--text-muted)', border: '1px solid var(--border)' }}>{p}</button>)}
      </div>}
      {loading ? <div className="py-8 text-center"><Loader2 className="animate-spin mx-auto" size={18} style={{ color: 'var(--accent)' }} /></div>
       : !entries.length ? <div className="rounded-xl p-6 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
           <User size={24} className="mx-auto mb-2" style={{ color: 'var(--border)' }} />
           <p className="text-xs" style={{ color: 'var(--text-muted)' }}>暂无个人画像。对话中提到团队规范后自动记录。</p></div>
       : <div className="space-y-1.5">{entries.map(e => (
           <div key={e.id} className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg group" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
             <Badge color={CAT_CLR[e.category] || '#6b7280'} text={CAT_LBL[e.category] || e.category} />
             <div className="flex-1 min-w-0">
               <p className="text-xs">{e.content}</p>
               <div className="flex items-center gap-2 mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                 <span>{ago(e.updated_at)}</span><span>· {Math.round(e.confidence * 100)}%</span>
                 {e.source === 'auto' && <span>· 自动</span>}</div>
             </div>
             <button onClick={() => del(e.id)} className="p-1 rounded opacity-0 group-hover:opacity-100" style={{ color: 'var(--text-muted)' }}><Trash2 size={11} /></button>
           </div>
         ))}</div>}
    </div>
  )
}

type SubTab = 'signals' | 'profile'
export default function EvolutionTab() {
  const [sub, setSub] = useState<SubTab>('signals')
  const [positions, setPositions] = useState<string[]>([])
  useEffect(() => {
    client.get('/sessions?limit=50').then((d: any) => {
      const ss = Array.isArray(d) ? d : d.sessions || []
      setPositions([...new Set(ss.map((s: any) => s.position_id).filter(Boolean))] as string[])
    }).catch(() => {})
  }, [])

  return (
    <div className="space-y-5">
      <div className="rounded-xl px-4 py-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          系统在后台分析对话，识别 AI 回答不足的场景，并提取团队规范和工作偏好。
          <strong style={{ color: 'var(--text)' }}> 进化信号</strong>是配置改进建议；
          <strong style={{ color: 'var(--text)' }}> 个人画像</strong>让 AI 记住你的规范。
        </p>
      </div>
      <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', width: 'fit-content' }}>
        {([['signals', '进化信号'], ['profile', '个人画像']] as [SubTab, string][]).map(([id, label]) =>
          <button key={id} onClick={() => setSub(id)} className="px-4 py-1.5 rounded text-xs"
            style={{ background: sub === id ? 'var(--accent)' : 'transparent', color: sub === id ? 'white' : 'var(--text-muted)' }}>{label}</button>)}
      </div>
      {sub === 'signals' ? <SignalList /> : <ProfileViewer positions={positions} />}
    </div>
  )
}
