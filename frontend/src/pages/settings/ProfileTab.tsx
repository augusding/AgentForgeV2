import { useState, useEffect } from 'react'
import { User, Key, Briefcase } from 'lucide-react'
import { useAuthStore } from '../../stores/useAuthStore'
import { changePassword } from '../../api/auth'
import client from '../../api/client'
import toast from 'react-hot-toast'

export default function ProfileTab() {
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

  const st = { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }
  return (
    <div className="space-y-6">
      <Card icon={User} title="账号信息">
        <Row label="用户名" value={user?.username || '-'} />
        <Row label="角色" value={user?.role === 'admin' ? '管理员' : user?.role === 'superadmin' ? '超级管理员' : '成员'} />
        <Row label="用户 ID" value={user?.id || '-'} mono />
        {user?.org_id && <Row label="组织 ID" value={user.org_id} mono />}
      </Card>

      <Card icon={Key} title="修改密码">
        <div className="space-y-3 max-w-[400px]">
          <input type="password" placeholder="当前密码" value={oldPw} onChange={e => setOldPw(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={st} />
          <input type="password" placeholder="新密码（至少6位）" value={newPw} onChange={e => setNewPw(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={st} />
          <button onClick={chgPw} disabled={busy} className="px-4 py-2 rounded-lg text-sm text-white" style={{ background: busy ? 'var(--border)' : 'var(--accent)' }}>
            {busy ? '修改中...' : '确认修改'}</button>
        </div>
      </Card>

      <Card icon={Briefcase} title="当前岗位">
        <div className="grid grid-cols-2 gap-2">
          {positions.map((p: any) => (
            <button key={p.position_id} onClick={async () => { try { await client.post('/workstation/assign', { position_id: p.position_id }); setActivePosition(p.position_id); toast.success('岗位已切换') } catch {} }}
              className="text-left px-3 py-2.5 rounded-lg hover:border-[var(--accent)]" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div className="text-xs font-medium" style={{ color: 'var(--text)' }}>{p.display_name}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.department}</div>
            </button>))}
        </div>
      </Card>
    </div>
  )
}

function Card({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><Icon size={14} style={{ color: 'var(--accent)' }} /> {title}</h3>
      {children}
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className={mono ? 'font-mono text-xs' : ''} style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  )
}
