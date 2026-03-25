import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, BookOpen, Zap } from 'lucide-react'
import { useWorkstationStore } from '../stores/useWorkstationStore'
import { useAuthStore } from '../stores/useAuthStore'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Workstation() {
  const { home, positions, loading, loadHome, assignPosition: rawAssign } = useWorkstationStore()
  const { setActivePosition } = useAuthStore()
  const navigate = useNavigate()

  const assignPosition = async (positionId: string) => {
    await rawAssign(positionId)
    setActivePosition(positionId)
  }

  useEffect(() => { loadHome() }, [])

  if (loading) return <LoadingSpinner label="加载工位..." />

  if (!home) {
    return (
      <div className="p-8 max-w-[1000px] mx-auto">
        <h1 className="text-xl font-bold mb-2">选择您的工位</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>选择一个岗位以获取定制化的 AI 助手</p>
        <div className="grid grid-cols-3 gap-4">
          {positions.map(pos => (
            <button key={pos.position_id} onClick={() => assignPosition(pos.position_id)}
              className="p-4 rounded-xl text-left transition-colors hover:border-[var(--accent)]"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="text-2xl mb-2">{pos.icon === 'bot' ? '🤖' : '💼'}</div>
              <h3 className="font-medium text-sm">{pos.display_name}</h3>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{pos.department}</p>
              <p className="text-xs mt-2 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{pos.description}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const pos = home.position
  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${pos?.color || '#3B82F6'}20` }}>
          <span style={{ color: pos?.color || '#3B82F6' }}>💼</span>
        </div>
        <div>
          <h1 className="text-lg font-bold">{pos?.display_name || '工位'}</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{pos?.description || ''}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { to: '/chat', icon: MessageSquare, label: '开始对话' },
          { to: '/knowledge', icon: BookOpen, label: '知识库' },
          { to: '/workflows', icon: Zap, label: '工作流' },
        ].map(({ to, icon: Icon, label }) => (
          <button key={to} onClick={() => navigate(to)}
            className="p-4 rounded-xl flex items-center gap-3 transition-colors hover:border-[var(--accent)]"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <Icon size={20} style={{ color: 'var(--accent)' }} />
            <span className="text-sm">{label}</span>
          </button>
        ))}
      </div>

      {(home.recent_chats?.length ?? 0) > 0 && (
        <div>
          <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-muted)' }}>最近对话</h2>
          <div className="space-y-2">
            {home.recent_chats.map((chat: any) => (
              <div key={chat.session_id} onClick={() => navigate('/chat')}
                className="p-3 rounded-lg text-sm cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                {chat.title || '新对话'}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
