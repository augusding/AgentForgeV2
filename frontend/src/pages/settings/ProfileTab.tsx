import { useState, useEffect } from 'react'
import { User, Key, Briefcase, Shield, Mail } from 'lucide-react'
import { useAuthStore } from '../../stores/useAuthStore'
import { changePassword } from '../../api/auth'
import client from '../../api/client'
import toast from 'react-hot-toast'

export default function ProfileTab(_props: { isAdmin?: boolean }) {
  const { user, setActivePosition } = useAuthStore()
  const [oldPw, setOldPw] = useState(''); const [newPw, setNewPw] = useState(''); const [busy, setBusy] = useState(false)
  const [positions, setPositions] = useState<any[]>([])
  useEffect(() => { client.get('/workstation/positions').then((d: any) => setPositions(d.positions || [])).catch(() => {}) }, [])

  const chgPw = async () => {
    if (!oldPw || !newPw) return toast.error('请填写完整')
    if (newPw.length < 6) return toast.error('新密码至少 6 位')
    setBusy(true)
    try { await changePassword(oldPw, newPw); toast.success('密码修改成功'); setOldPw(''); setNewPw('') } catch {} finally { setBusy(false) }
  }

  const role = user?.role === 'admin' ? '管理员' : user?.role === 'superadmin' ? '超级管理员' : '成员'
  const st = { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* 用户信息卡片 */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="px-6 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold"
              style={{ background: 'var(--accent)15', color: 'var(--accent)' }}>
              {(user?.username || '?')[0].toUpperCase()}
            </div>
            <div>
              <h3 className="text-base font-bold">{user?.display_name || user?.username || '-'}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: role === '成员' ? 'var(--bg)' : '#14b8a620', color: role === '成员' ? 'var(--text-muted)' : 'var(--accent)' }}>{role}</span>
                {user?.org_id && <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>org: {user.org_id}</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 grid grid-cols-2 gap-4">
          <InfoRow icon={User} label="用户名" value={user?.username || '-'} />
          <InfoRow icon={Shield} label="用户 ID" value={user?.id || '-'} mono />
          <InfoRow icon={Mail} label="角色" value={role} />
          <InfoRow icon={Briefcase} label="当前岗位" value={positions.find(p => p.position_id === user?.active_position)?.display_name || '未选择'} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 修改密码 */}
        <div className="rounded-2xl p-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-5">
            <Key size={16} style={{ color: 'var(--accent)' }} />
            <h3 className="text-sm font-bold">修改密码</h3>
          </div>
          <div className="space-y-3">
            <input type="password" placeholder="当前密码" value={oldPw} onChange={e => setOldPw(e.target.value)} className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={st} />
            <input type="password" placeholder="新密码（至少 6 位）" value={newPw} onChange={e => setNewPw(e.target.value)} className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={st} />
            <button onClick={chgPw} disabled={busy} className="w-full py-2.5 rounded-xl text-sm text-white font-medium"
              style={{ background: busy ? 'var(--border)' : 'var(--accent)' }}>
              {busy ? '修改中...' : '确认修改'}</button>
          </div>
        </div>

        {/* 切换岗位 */}
        <div className="rounded-2xl p-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-5">
            <Briefcase size={16} style={{ color: 'var(--accent)' }} />
            <h3 className="text-sm font-bold">切换岗位</h3>
          </div>
          <div className="space-y-2 max-h-[200px] overflow-auto">
            {positions.map((p: any) => {
              const active = p.position_id === user?.active_position
              return (
                <button key={p.position_id} onClick={async () => { try { await client.post('/workstation/assign', { position_id: p.position_id }); setActivePosition(p.position_id); toast.success('岗位已切换') } catch {} }}
                  className="w-full text-left px-4 py-3 rounded-xl transition-all"
                  style={{ background: active ? 'var(--accent)10' : 'var(--bg)', border: active ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium" style={{ color: active ? 'var(--accent)' : 'var(--text)' }}>{p.display_name}</div>
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.department}</div>
                    </div>
                    {active && <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'var(--accent)', color: 'white' }}>当前</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon size={14} style={{ color: 'var(--text-muted)' }} />
      <div>
        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</div>
        <div className={`text-sm ${mono ? 'font-mono text-xs' : ''}`}>{value}</div>
      </div>
    </div>
  )
}
