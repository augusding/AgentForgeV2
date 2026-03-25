/**
 * 审批卡片 — 人类审批节点
 *
 * DAG 执行遇到 type="approval" 节点时展示。
 * 显示前序步骤交付物摘要 + 审批/拒绝/修改 + 留言输入。
 */
import { useState } from 'react'
import {
  AlertTriangle, Check, Edit3, X,
  ChevronDown, ChevronRight, MessageSquare, FileText,
  Loader2,
} from 'lucide-react'
import type { ApprovalRequest } from '../../types/mission'

interface Props {
  approval: ApprovalRequest
  onResolve: (approvalId: string, decision: string, comment?: string) => void
}

export default function ApprovalCard({ approval, onResolve }: Props) {
  const isPending = approval.status === 'pending'
  const [showDetails, setShowDetails] = useState(false)
  const [showComment, setShowComment] = useState(false)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleDecision = async (decision: string) => {
    // "修改后同意" 时强制展开留言
    if (decision === 'modify' && !showComment) {
      setShowComment(true)
      return
    }
    // "拒绝" 时建议留言
    if (decision === 'reject' && !showComment && !comment.trim()) {
      setShowComment(true)
      return
    }

    setSubmitting(true)
    try {
      await onResolve(approval.id, decision, comment.trim() || undefined)
    } finally {
      setSubmitting(false)
    }
  }

  const statusLabel = {
    approved: '已批准',
    rejected: '已拒绝',
    modified: '已修改后批准',
    pending: '需要你的确认',
  }[approval.status] || approval.status

  const statusColor = {
    approved: 'text-success',
    rejected: 'text-danger',
    modified: 'text-warning',
    pending: 'text-warning',
  }[approval.status] || 'text-text-muted'

  // 解析交付物（如果存在）
  const deliverables = (approval as any).deliverables as Record<string, string> | undefined

  return (
    <div className="my-3 mx-auto max-w-[85%]">
      <div
        className={`rounded-lg border overflow-hidden ${
          isPending
            ? 'bg-warning/[0.04] border-warning/50 shadow-sm'
            : 'bg-surface border-border opacity-80'
        }`}
      >
        {/* Header */}
        <div className="px-4 py-3 flex items-center gap-2.5">
          <AlertTriangle
            size={16}
            className={isPending ? 'text-warning shrink-0' : 'text-text-muted shrink-0'}
          />
          <div className="flex-1 min-w-0">
            <span className={`text-sm font-semibold ${statusColor}`}>
              {statusLabel}
            </span>
            <span className="text-sm text-text-secondary ml-2">
              — {approval.agent_name}
            </span>
          </div>
          {approval.status !== 'pending' && approval.resolved_at && (
            <span className="text-[11px] text-text-muted shrink-0">
              {new Date(approval.resolved_at).toLocaleString('zh-CN', {
                month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
          )}
        </div>

        {/* Summary */}
        <div className="px-4 pb-3">
          <p className="text-sm text-text leading-relaxed">
            {approval.summary}
          </p>
        </div>

        {/* Deliverables / Analysis — 可折叠 */}
        {(approval.full_analysis || (deliverables && Object.keys(deliverables).length > 0)) && (
          <div className="border-t border-border/50">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full px-4 py-2 flex items-center gap-2 text-xs text-text-muted hover:bg-surface-hover transition-colors"
            >
              {showDetails ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <FileText size={12} />
              <span>前序步骤交付物</span>
              {deliverables && (
                <span className="text-[10px] bg-bg px-1.5 py-0.5 rounded">
                  {Object.keys(deliverables).length} 项
                </span>
              )}
            </button>

            {showDetails && (
              <div className="px-4 pb-3 space-y-2">
                {/* 交付物列表 */}
                {deliverables && Object.entries(deliverables).map(([key, value]) => (
                  <div key={key} className="text-xs bg-bg rounded-md px-3 py-2">
                    <span className="font-medium text-accent">{key}</span>
                    <p className="text-text-secondary mt-1 whitespace-pre-line break-words">
                      {String(value).slice(0, 300)}
                      {String(value).length > 300 && '...'}
                    </p>
                  </div>
                ))}

                {/* 详细分析 */}
                {approval.full_analysis && (
                  <div className="text-xs text-text-secondary bg-bg rounded-md px-3 py-2 whitespace-pre-line">
                    {approval.full_analysis}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Comment Input */}
        {isPending && showComment && (
          <div className="px-4 pb-3 border-t border-border/50 pt-3">
            <div className="flex items-start gap-2">
              <MessageSquare size={14} className="text-text-muted mt-1.5 shrink-0" />
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="留言给 Agent（可选）..."
                rows={2}
                className="flex-1 px-3 py-2 text-xs bg-bg border border-border rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-accent text-text placeholder:text-text-muted"
                disabled={submitting}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {isPending && (
          <div className="px-4 py-3 bg-bg/50 border-t border-border/50 flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleDecision('approve')}
              disabled={submitting}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-success rounded-md hover:bg-success/90 disabled:opacity-50 transition-colors"
            >
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              批准
            </button>
            <button
              onClick={() => handleDecision('modify')}
              disabled={submitting}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-warning bg-warning/10 border border-warning/20 rounded-md hover:bg-warning/20 disabled:opacity-50 transition-colors"
            >
              <Edit3 size={13} /> 修改后批准
            </button>
            <button
              onClick={() => handleDecision('reject')}
              disabled={submitting}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-danger bg-danger/10 border border-danger/20 rounded-md hover:bg-danger/20 disabled:opacity-50 transition-colors"
            >
              <X size={13} /> 拒绝
            </button>

            {/* Toggle Comment */}
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

        {/* Resolved Comment Display */}
        {!isPending && (approval as any).comment && (
          <div className="px-4 py-2 border-t border-border/50 bg-bg/30">
            <div className="flex items-start gap-2 text-xs">
              <MessageSquare size={12} className="text-text-muted mt-0.5 shrink-0" />
              <span className="text-text-secondary">{(approval as any).comment}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
