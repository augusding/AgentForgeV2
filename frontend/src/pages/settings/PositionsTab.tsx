import { useState, useEffect, useCallback } from 'react'
import { Briefcase, ChevronDown, ChevronRight, Loader2, Target } from 'lucide-react'
import client from '../../api/client'

export default function PositionsTab() {
  const [positions, setPositions] = useState<any[]>([]); const [exp, setExp] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, any>>({}); const [loading, setLoading] = useState(true)

  useEffect(() => { client.get('/workstation/positions').then((d: any) => setPositions(d.positions || [])).catch(() => {}).finally(() => setLoading(false)) }, [])

  const loadDet = useCallback(async (pid: string) => {
    if (details[pid]) return
    try { const d = await client.get(`/workstation/positions/${pid}`); setDetails(p => ({ ...p, [pid]: d })) } catch {}
  }, [details])

  const toggle = (pid: string) => { if (exp === pid) setExp(null); else { setExp(pid); loadDet(pid) } }

  if (loading) return <div className="text-center py-8"><Loader2 className="animate-spin mx-auto" size={20} style={{ color: 'var(--accent)' }} /></div>

  return (
    <div className="space-y-6">
      {positions.length === 0 ? (
        <div className="rounded-xl p-6 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <Briefcase size={32} className="mx-auto mb-2" style={{ color: 'var(--border)' }} />
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>暂无岗位。在 profiles/ 目录添加。</p>
        </div>
      ) : (
        <div className="space-y-3">{positions.map((pos: any) => (
          <div key={pos.position_id} className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <button onClick={() => toggle(pos.position_id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-hover)]">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm"
                style={{ background: `${pos.color || 'var(--accent)'}20`, color: pos.color || 'var(--accent)' }}>💼</div>
              <div className="flex-1"><div className="text-sm font-medium">{pos.display_name}</div>
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{pos.department} · {pos.domain || ''}</div></div>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>{pos.position_id}</span>
              {exp === pos.position_id ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
            </button>
            {exp === pos.position_id && (
              <div className="px-4 pb-4 pt-2 space-y-4 border-t" style={{ borderColor: 'var(--border)' }}>
                {details[pos.position_id] ? (() => { const d = details[pos.position_id]; return (<>
                  {(d.description || d.role || d.goal) && (
                    <div className="rounded-lg p-3" style={{ background: 'var(--bg)' }}>
                      <div className="text-[10px] font-medium mb-2 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}><Target size={10} /> AI 角色</div>
                      {d.description && <div className="text-xs mb-1">{d.description}</div>}
                      {d.role && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>角色: {d.role}</div>}
                      {d.goal && <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>目标: {d.goal}</div>}
                    </div>)}
                  <div className="flex gap-3">
                    {d.default_model && <div className="flex-1 rounded-lg p-2.5" style={{ background: 'var(--bg)' }}>
                      <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>默认模型</div>
                      <div className="text-xs font-mono font-medium" style={{ color: 'var(--accent)' }}>{d.default_model}</div></div>}
                    {d.complex_model && <div className="flex-1 rounded-lg p-2.5" style={{ background: 'var(--bg)' }}>
                      <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>复杂模型</div>
                      <div className="text-xs font-mono font-medium" style={{ color: 'var(--accent)' }}>{d.complex_model}</div></div>}
                  </div>
                </>)})() : <Loader2 className="animate-spin" size={14} style={{ color: 'var(--accent)' }} />}
              </div>)}
          </div>))}</div>
      )}
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>岗位在 <code className="px-1 py-0.5 rounded text-[10px] font-mono" style={{ background: 'var(--bg)' }}>profiles/</code> 目录管理，定义了 AI 的角色、目标和领域知识。</div>
      </div>
    </div>
  )
}
