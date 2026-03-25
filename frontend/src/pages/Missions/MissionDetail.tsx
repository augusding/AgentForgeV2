import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useMissionStore } from '../../stores/useMissionStore'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import AgentAvatar from '../../components/AgentAvatar'
import { formatTokenCount, formatCost, formatDuration } from '../../utils/formatToken'
import MissionTrace from './MissionTrace'
import dayjs from 'dayjs'

export default function MissionDetail() {
  const { mission_id } = useParams<{ mission_id: string }>()
  const nav = useNavigate()
  const { activeMission, loading, loadOne } = useMissionStore()

  useEffect(() => {
    if (mission_id) loadOne(mission_id)
  }, [mission_id, loadOne])

  if (loading || !activeMission) return <LoadingSpinner fullPage />

  const m = activeMission

  return (
    <div>
      {/* Back */}
      <button onClick={() => nav('/missions')} className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text mb-4">
        <ArrowLeft size={16} />
        返回任务列表
      </button>

      {/* Header */}
      <div className="bg-surface border border-border rounded-lg p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-text">{m.title}</h2>
            <p className="text-sm text-text-muted mt-1">{m.description}</p>
          </div>
          <StatusBadge status={m.status} />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-5">
          <div>
            <div className="text-xs text-text-muted">模式</div>
            <div className="text-sm font-medium text-text mt-0.5 capitalize">{m.mode}</div>
          </div>
          <div>
            <div className="text-xs text-text-muted">Token</div>
            <div className="text-sm font-medium text-text mt-0.5">{formatTokenCount(m.total_tokens)}</div>
          </div>
          <div>
            <div className="text-xs text-text-muted">花费</div>
            <div className="text-sm font-medium text-text mt-0.5">{formatCost(m.total_cost)}</div>
          </div>
          <div>
            <div className="text-xs text-text-muted">耗时</div>
            <div className="text-sm font-medium text-text mt-0.5">{formatDuration(m.duration_ms)}</div>
          </div>
          <div>
            <div className="text-xs text-text-muted">质量评分</div>
            <div className="text-sm font-medium text-text mt-0.5">
              {m.quality_score ? `${(m.quality_score * 100).toFixed(0)}%` : '—'}
            </div>
          </div>
        </div>

        {/* Agents */}
        <div className="mt-5">
          <div className="text-xs text-text-muted mb-2">参与 Agent</div>
          <div className="flex items-center gap-2">
            {m.involved_agents.map(id => (
              <AgentAvatar key={id} agentId={id} name={id} size="md" />
            ))}
          </div>
        </div>

        {/* Time info */}
        <div className="flex gap-6 mt-4 text-xs text-text-muted">
          <span>创建: {dayjs(m.created_at).format('YYYY-MM-DD HH:mm')}</span>
          {m.started_at && <span>开始: {dayjs(m.started_at).format('YYYY-MM-DD HH:mm')}</span>}
          {m.completed_at && <span>完成: {dayjs(m.completed_at).format('YYYY-MM-DD HH:mm')}</span>}
        </div>
      </div>

      {/* Blackboard */}
      {Object.keys(m.blackboard).length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-5 mb-6">
          <h3 className="text-sm font-semibold text-text mb-3">Blackboard</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(m.blackboard).map(([k, v]) => (
              <div key={k} className="bg-bg rounded-md px-3 py-2">
                <div className="text-xs text-text-muted">{k}</div>
                <div className="text-sm text-text mt-0.5">{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step Trace */}
      <MissionTrace steps={m.steps} />
    </div>
  )
}
