import { useNavigate } from 'react-router-dom'
import type { Mission } from '../../types/mission'
import StatusBadge from '../../components/StatusBadge'
import AgentAvatar from '../../components/AgentAvatar'
import { formatTokenCount, formatCost, formatDuration } from '../../utils/formatToken'
import dayjs from 'dayjs'

interface Props {
  mission: Mission
}

const STATUS_LABEL: Record<string, string> = {
  pending: '等待中',
  in_progress: '执行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
  waiting_approval: '待审批',
}

const MODE_LABEL: Record<string, string> = {
  direct: '直达',
  squad: '协作',
  workflow: '工作流',
}

export default function MissionCard({ mission }: Props) {
  const nav = useNavigate()

  return (
    <div
      className="bg-surface border border-border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => nav(`/missions/${mission.id}`)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-text truncate">{mission.title}</h4>
          <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{mission.description}</p>
        </div>
        <StatusBadge status={mission.status} label={STATUS_LABEL[mission.status]} />
      </div>

      {/* Progress */}
      {mission.total_steps && mission.total_steps > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-text-muted mb-1">
            <span>进度 {mission.current_step || 0}/{mission.total_steps}</span>
            <span>{MODE_LABEL[mission.mode] || mission.mode}</span>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{ width: `${((mission.current_step || 0) / mission.total_steps) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Agents */}
      <div className="flex items-center gap-1 mb-3">
        {mission.involved_agents.slice(0, 5).map(id => (
          <AgentAvatar key={id} agentId={id} name={id} size="sm" />
        ))}
        {mission.involved_agents.length > 5 && (
          <span className="text-xs text-text-muted ml-1">+{mission.involved_agents.length - 5}</span>
        )}
      </div>

      {/* Stats footer */}
      <div className="flex items-center gap-4 text-xs text-text-muted">
        <span>{formatTokenCount(mission.total_tokens)} tokens</span>
        <span>{formatCost(mission.total_cost)}</span>
        <span>{formatDuration(mission.duration_ms)}</span>
        <span className="ml-auto">{dayjs(mission.created_at).format('MM-DD HH:mm')}</span>
      </div>

      {/* Tags */}
      {mission.tags && mission.tags.length > 0 && (
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {mission.tags.map(tag => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-primary/5 text-primary rounded">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
