/**
 * 审批列表页面
 *
 * 展示所有审批请求，支持筛选、留言输入、批准/拒绝/修改。
 */
import { useEffect, useState } from 'react'
import {
  CheckCircle, XCircle, Edit3, MessageSquare,
  ChevronDown, ChevronRight, FileText,
} from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import AgentAvatar from '../../components/AgentAvatar'
import StatusBadge from '../../components/StatusBadge'
import { useApprovalStore } from '../../stores/useApprovalStore'
import type { ApprovalRequest } from '../../types/mission'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'

type FilterValue = 'all' | 'pending' | 'approved' | 'rejected'

/** 单个审批卡片 — 可展开留言和交付物 */
function ApprovalItem({
  approval,
  onResolve,
}: {
  approval: ApprovalRequest
  onResolve: (id: string, decision: string, comment?: string) => Promise<void>
}) {
  const [showDetails, setShowDetails] = useState(false)
  const [showComment, setShowComment] = useState(false)
  const [comment, setComment] = useState('')
  const isPending = approval.status === 'pending'
  const deliverables = approval.deliverables as Record<string, string> | undefined

  const handleAction = async (decision: string) => {
    if (decision === 'modify' && !showComment) {
      setShowComment(true)
      return
    }
    if (decision === 'reject' && !showComment && !comment.trim()) {
      setShowComment(true)
      return
    }
    await onResolve(approval.id, decision, comment.trim() || undefined)
  }

  return (
    <div className={`bg-surface border rounded-lg overflow-hidden ${isPending ? 'border-warning/50' : 'border-border'}`}>
      <div className="p-5">
        <div className="flex items-start gap-4">
          <AgentAvatar agentId={approval.agent_id} name={approval.agent_name} size="md" />
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-text">{approval.summary}</h4>
                <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                  <span>{approval.agent_name}</span>
                  <span>·</span>
                  <span>{dayjs(approval.created_at).format('MM-DD HH:mm')}</span>
                  {approval.expires_at && (
                    <>
                      <span>·</span>
                      <span className={dayjs(approval.expires_at).isBefore(dayjs()) ? 'text-danger' : ''}>
                        截止 {dayjs(approval.expires_at).format('MM-DD HH:mm')}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <StatusBadge status={approval.status} />
            </div>

            {/* Analysis */}
            {approval.full_analysis && (
              <div className="mt-3 text-sm text-text-secondary bg-bg rounded-md px-3 py-2 whitespace-pre-line">
                {approval.full_analysis}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Deliverables — 可折叠 */}
      {deliverables && Object.keys(deliverables).length > 0 && (
        <div className="border-t border-border/50">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full px-5 py-2 flex items-center gap-2 text-xs text-text-muted hover:bg-surface-hover transition-colors"
          >
            {showDetails ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <FileText size={12} />
            <span>交付物 ({Object.keys(deliverables).length} 项)</span>
          </button>
          {showDetails && (
            <div className="px-5 pb-3 space-y-2">
              {Object.entries(deliverables).map(([key, value]) => (
                <div key={key} className="text-xs bg-bg rounded-md px-3 py-2">
                  <span className="font-medium text-accent">{key}</span>
                  <p className="text-text-secondary mt-1 whitespace-pre-line break-words">
                    {String(value).slice(0, 400)}
                    {String(value).length > 400 && '...'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Comment Input */}
      {isPending && showComment && (
        <div className="px-5 py-3 border-t border-border/50">
          <div className="flex items-start gap-2">
            <MessageSquare size={14} className="text-text-muted mt-1.5 shrink-0" />
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="留言给 Agent..."
              rows={2}
              className="flex-1 px-3 py-2 text-xs bg-bg border border-border rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-accent text-text placeholder:text-text-muted"
            />
          </div>
        </div>
      )}

      {/* Actions */}
      {isPending && (
        <div className="px-5 py-3 bg-bg/30 border-t border-border/50 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleAction('approve')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-success rounded-lg hover:bg-success/90 transition-colors"
          >
            <CheckCircle size={14} /> 批准
          </button>
          <button
            onClick={() => handleAction('modify')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-warning bg-warning/10 rounded-lg hover:bg-warning/20 transition-colors"
          >
            <Edit3 size={14} /> 修改后批准
          </button>
          <button
            onClick={() => handleAction('reject')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-danger bg-danger/10 rounded-lg hover:bg-danger/20 transition-colors"
          >
            <XCircle size={14} /> 拒绝
          </button>
          {!showComment && (
            <button
              onClick={() => setShowComment(true)}
              className="ml-auto flex items-center gap-1 text-[11px] text-text-muted hover:text-text transition-colors"
            >
              <MessageSquare size={11} /> 留言
            </button>
          )}
        </div>
      )}

      {/* Resolved info */}
      {approval.resolved_at && (
        <div className="px-5 py-2 border-t border-border/50 flex items-center gap-3 text-xs text-text-muted">
          <span>处理于 {dayjs(approval.resolved_at).format('YYYY-MM-DD HH:mm')}</span>
          {approval.comment && (
            <span className="flex items-center gap-1">
              <MessageSquare size={11} /> {approval.comment}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default function Approvals() {
  const { approvals, loading, load, resolve } = useApprovalStore()
  const [filter, setFilter] = useState<FilterValue>('all')

  useEffect(() => {
    load()
  }, [load])

  const handleResolve = async (id: string, decision: string, comment?: string) => {
    try {
      await resolve(id, decision, comment)
      toast.success(
        decision === 'approve' ? '已批准'
          : decision === 'reject' ? '已拒绝'
            : '已修改后批准'
      )
    } catch {
      toast.error('操作失败')
    }
  }

  const filtered = approvals.filter(a => {
    if (filter === 'all') return true
    return a.status === filter
  })

  const pendingCount = approvals.filter(a => a.status === 'pending').length

  if (loading) {
    return (
      <div>
        <PageHeader title="待审批" description="需要人工确认的 Agent 决策" />
        <LoadingSpinner fullPage />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="待审批" description={`${pendingCount} 项待处理`} />

      {/* Filters */}
      <div className="flex gap-1.5 mb-6">
        {([
          { label: '全部', value: 'all' as FilterValue },
          { label: '待处理', value: 'pending' as FilterValue },
          { label: '已批准', value: 'approved' as FilterValue },
          { label: '已拒绝', value: 'rejected' as FilterValue },
        ]).map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              filter === f.value
                ? 'bg-primary text-white border-primary'
                : 'bg-surface text-text-muted border-border hover:border-primary/40'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState title={filter === 'pending' ? '没有待处理的审批' : '暂无审批记录'} />
      ) : (
        <div className="space-y-4">
          {filtered.map(a => (
            <ApprovalItem key={a.id} approval={a} onResolve={handleResolve} />
          ))}
        </div>
      )}
    </div>
  )
}
