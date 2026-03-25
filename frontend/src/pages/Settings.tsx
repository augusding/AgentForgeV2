import { useState, useEffect } from 'react'
import { User, Key, Briefcase, Server } from 'lucide-react'
import { useAuthStore } from '../stores/useAuthStore'
import { changePassword } from '../api/auth'
import client from '../api/client'
import toast from 'react-hot-toast'

export default function Settings() {
  const { user } = useAuthStore()
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [changingPw, setChangingPw] = useState(false)
  const [health, setHealth] = useState<any>(null)
  const [positions, setPositions] = useState<any[]>([])

  useEffect(() => {
    client.get('/health').then((d: any) => setHealth(d)).catch(() => {})
    client.get('/workstation/positions').then((d: any) => setPositions(d.positions || [])).catch(() => {})
  }, [])

  const handleChangePassword = async () => {
    if (!oldPw || !newPw) return toast.error('请填写完整')
    if (newPw.length < 6) return toast.error('新密码至少 6 位')
    setChangingPw(true)
    try { await changePassword(oldPw, newPw); toast.success('密码修改成功'); setOldPw(''); setNewPw('') }
    catch {} finally { setChangingPw(false) }
  }

  const switchPosition = async (positionId: string) => {
    try { await client.post('/workstation/assign', { position_id: positionId }); toast.success('岗位已切换') } catch {}
  }

  return (
    <div className="p-6 max-w-[700px] mx-auto space-y-6">
      <h1 className="text-lg font-bold">设置</h1>

      <Section icon={User} title="用户信息">
        <InfoRow label="用户名" value={user?.username || '-'} />
        <InfoRow label="角色" value={user?.role || '-'} />
        <InfoRow label="用户ID" value={user?.id || '-'} />
        {user?.org_id && <InfoRow label="组织ID" value={user.org_id} />}
      </Section>

      <Section icon={Key} title="修改密码">
        <div className="space-y-3">
          <input type="password" placeholder="当前密码" value={oldPw} onChange={e => setOldPw(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          <input type="password" placeholder="新密码（至少6位）" value={newPw} onChange={e => setNewPw(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          <button onClick={handleChangePassword} disabled={changingPw}
            className="px-4 py-2 rounded-lg text-sm text-white transition-colors"
            style={{ background: changingPw ? 'var(--border)' : 'var(--accent)' }}>
            {changingPw ? '修改中...' : '确认修改'}
          </button>
        </div>
      </Section>

      <Section icon={Briefcase} title="切换岗位">
        <div className="grid grid-cols-2 gap-2">
          {positions.map((pos: any) => (
            <button key={pos.position_id} onClick={() => switchPosition(pos.position_id)}
              className="text-left px-3 py-2 rounded-lg text-sm transition-colors hover:border-[var(--accent)]"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div className="font-medium">{pos.display_name}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{pos.department}</div>
            </button>
          ))}
        </div>
      </Section>

      <Section icon={Server} title="系统信息">
        {health ? (
          <>
            <InfoRow label="名称" value={health.name || 'AgentForge'} />
            <InfoRow label="版本" value={health.version || '-'} />
            <InfoRow label="状态" value={health.status || '-'} />
            <InfoRow label="数据库" value={health.db || '-'} />
            <InfoRow label="LLM" value={health.llm || '-'} />
            <InfoRow label="工具数" value={String(health.tools || 0)} />
            <InfoRow label="Profiles" value={(health.profiles || []).join(', ') || '-'} />
            {health.ws_connections !== undefined && <InfoRow label="WS 连接" value={String(health.ws_connections)} />}
          </>
        ) : <div className="text-sm" style={{ color: 'var(--text-muted)' }}>加载中...</div>}
      </Section>
    </div>
  )
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} style={{ color: 'var(--accent)' }} />
        <h2 className="text-sm font-medium">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span>{value}</span>
    </div>
  )
}
