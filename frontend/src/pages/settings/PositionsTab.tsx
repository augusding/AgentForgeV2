import { useState, useEffect } from 'react'
import { Briefcase, Loader2, Save, X } from 'lucide-react'
import client from '../../api/client'
import toast from 'react-hot-toast'

interface PosData {
  position_id: string; display_name: string; icon: string; color: string
  department: string; domain: string; description: string
  identity: string; values: string; behavior: string; context: string
  role: string; goal: string; default_model: string; complex_model: string
}

const FIELDS: Array<{ key: keyof PosData; label: string; type: 'text' | 'textarea'; group: string }> = [
  { key: 'display_name', label: '岗位名称', type: 'text', group: '基础' },
  { key: 'department', label: '部门', type: 'text', group: '基础' },
  { key: 'domain', label: '领域', type: 'text', group: '基础' },
  { key: 'description', label: '职责描述', type: 'textarea', group: '基础' },
  { key: 'identity', label: '身份层（我是谁）', type: 'textarea', group: '六层模型' },
  { key: 'values', label: '价值观层（判断原则）', type: 'textarea', group: '六层模型' },
  { key: 'behavior', label: '行为层（表达方式）', type: 'textarea', group: '六层模型' },
  { key: 'context', label: '知识层（专业知识）', type: 'textarea', group: '六层模型' },
  { key: 'default_model', label: '默认模型', type: 'text', group: '模型' },
  { key: 'complex_model', label: '复杂模型', type: 'text', group: '模型' },
]

export default function PositionsTab({ isAdmin }: { isAdmin?: boolean }) {
  const [positions, setPositions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<PosData | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d: any = await client.get('/workstation/positions')
      const list = d.positions || []
      // Load full details for each position
      const detailed = await Promise.all(list.map(async (p: any) => {
        try { return await client.get(`/positions/${p.position_id}`) as PosData }
        catch { return p as PosData }
      }))
      // 非 admin 只看自己的岗位
      if (!isAdmin) {
        const activePos = localStorage.getItem('agentforge_active_position') || ''
        const myPos = detailed.filter((p: any) => p.position_id === activePos)
        setPositions(myPos.length ? myPos : detailed.slice(0, 1))
      } else {
        setPositions(detailed)
      }
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const startEdit = (pos: PosData) => setEditing({ ...pos })

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    try {
      await client.patch(`/positions/${editing.position_id}`, editing)
      toast.success('已保存')
      setEditing(null)
      await load()
    } catch { toast.error('保存失败') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="text-center py-8"><Loader2 className="animate-spin mx-auto" size={20} style={{ color: 'var(--accent)' }} /></div>

  return (
    <div className="space-y-4">
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {isAdmin ? '管理所有岗位的六层专家配置。点击卡片编辑。' : '查看和编辑你当前岗位的配置。'}
      </p>

      {!positions.length ? (
        <div className="rounded-xl p-6 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <Briefcase size={32} className="mx-auto mb-2" style={{ color: 'var(--border)' }} />
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>暂无岗位</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          {positions.map((pos: PosData) => (
            <div key={pos.position_id}
              onClick={() => startEdit(pos)}
              className="rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg hover:border-[var(--accent)]"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-base"
                  style={{ background: `${pos.color || 'var(--accent)'}20`, color: pos.color || 'var(--accent)' }}>✦</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{pos.display_name}</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{pos.department}{pos.domain ? ` · ${pos.domain}` : ''}</div>
                </div>
              </div>
              {pos.description && <p className="text-xs mb-2 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{pos.description}</p>}
              <div className="flex flex-wrap gap-1.5">
                {pos.identity && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: '#3b82f615', color: '#3b82f6' }}>身份层 ✓</span>}
                {pos.values && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: '#22c55e15', color: '#22c55e' }}>价值观 ✓</span>}
                {pos.behavior && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: '#a855f715', color: '#a855f7' }}>行为 ✓</span>}
                {pos.context && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: '#f59e0b15', color: '#f59e0b' }}>知识 ✓</span>}
                {!pos.identity && !pos.values && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: '#ef444415', color: '#ef4444' }}>未配置</span>}
              </div>
              <div className="flex gap-2 mt-2">
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>{pos.default_model || 'sonnet'}</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>{pos.position_id}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 编辑弹窗 */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                  style={{ background: `${editing.color || 'var(--accent)'}20`, color: editing.color || 'var(--accent)' }}>✦</div>
                <div>
                  <div className="text-sm font-bold">{editing.display_name}</div>
                  <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{editing.position_id}</div>
                </div>
              </div>
              <button onClick={() => setEditing(null)} className="p-2 rounded-lg hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
              {['基础', '六层模型', '模型'].map(group => (
                <div key={group}>
                  <h3 className="text-xs font-bold mb-2" style={{ color: 'var(--text-muted)' }}>{group}</h3>
                  <div className="space-y-3">
                    {FIELDS.filter(f => f.group === group).map(field => (
                      <div key={field.key}>
                        <label className="text-[11px] mb-1 block" style={{ color: 'var(--text-muted)' }}>{field.label}</label>
                        {field.type === 'textarea' ? (
                          <textarea
                            value={(editing as any)[field.key] || ''}
                            onChange={e => setEditing(prev => prev ? { ...prev, [field.key]: e.target.value } : null)}
                            rows={field.key === 'context' ? 8 : 3}
                            className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-none"
                            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit', lineHeight: 1.6 }}
                          />
                        ) : (
                          <input
                            value={(editing as any)[field.key] || ''}
                            onChange={e => setEditing(prev => prev ? { ...prev, [field.key]: e.target.value } : null)}
                            className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg text-xs"
                style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>取消</button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs text-white"
                style={{ background: saving ? 'var(--border)' : 'var(--accent)' }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
