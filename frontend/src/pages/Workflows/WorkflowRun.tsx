import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, Loader2,
  AlertTriangle, SkipForward, ChevronDown, ChevronRight,
  Timer,
} from 'lucide-react'
import { fetchDagStatus, type DagNodeStatus, type DagStatus } from '../../api/workstation'
import { resolveApproval } from '../../api/approvals'
import wsClient from '../../api/ws'

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  completed: { icon: CheckCircle2, color: 'text-success', label: '已完成' },
  running:   { icon: Loader2,      color: 'text-accent',  label: '执行中' },
  pending:   { icon: Clock,        color: 'text-text-muted', label: '等待中' },
  ready:     { icon: Clock,        color: 'text-info',    label: '就绪' },
  failed:    { icon: XCircle,      color: 'text-danger',  label: '失败' },
  skipped:   { icon: SkipForward,  color: 'text-text-muted', label: '跳过' },
  waiting:   { icon: AlertTriangle, color: 'text-warning', label: '等待审批' },
}

interface NodeCardProps {
  node: DagNodeStatus
  index: number
  onApprove?: (approvalId: string, decision: 'approved' | 'rejected') => Promise<void>
}

function NodeCard({ node, index, onApprove }: NodeCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [approving, setApproving] = useState(false)
  const cfg = STATUS_CONFIG[node.status] || STATUS_CONFIG.pending
  const Icon = cfg.icon
  const isRunning = node.status === 'running'

  const handleApproval = async (decision: 'approved' | 'rejected') => {
    if (!node.approval?.approval_id || !onApprove) return
    setApproving(true)
    try {
      await onApprove(node.approval.approval_id, decision)
    } finally {
      setApproving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
      className={`border rounded-xl p-4 transition-colors ${
        isRunning
          ? 'border-accent/50 bg-accent/5'
          : node.status === 'completed'
          ? 'border-success/30 bg-surface'
          : node.status === 'failed'
          ? 'border-danger/30 bg-surface'
          : node.status === 'waiting'
          ? 'border-warning/50 bg-warning/5'
          : 'border-border bg-surface'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Status icon */}
        <div className={`shrink-0 ${cfg.color}`}>
          <Icon size={20} className={isRunning ? 'animate-spin' : ''} />
        </div>

        {/* Node info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text">{node.id}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.color} bg-current/10`}
                  style={{ backgroundColor: 'var(--color-surface-hover)' }}>
              {cfg.label}
            </span>
          </div>
          {node.agent_id && (
            <p className="text-xs text-text-muted mt-0.5">Agent: {node.agent_id}</p>
          )}
        </div>

        {/* Duration */}
        <div className="text-right shrink-0">
          {node.duration_ms > 0 && (
            <span className="text-xs text-text-muted">
              {node.duration_ms < 1000
                ? `${node.duration_ms}ms`
                : `${(node.duration_ms / 1000).toFixed(1)}s`}
            </span>
          )}
          {node.tokens_used != null && node.tokens_used > 0 && (
            <p className="text-[10px] text-text-muted">{node.tokens_used} tokens</p>
          )}
        </div>

        {/* Expand toggle */}
        {node.output_preview && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 text-text-muted hover:text-text transition-colors"
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        )}
      </div>

      {/* Inline approval buttons */}
      {node.status === 'waiting' && node.approval && (
        <div className="mt-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
          {node.approval.summary && (
            <p className="text-xs text-text-secondary mb-2">{node.approval.summary}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => handleApproval('approved')}
              disabled={approving}
              className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-success text-white hover:bg-success/90 disabled:opacity-50 transition-colors"
            >
              {approving ? '处理中...' : '批准'}
            </button>
            <button
              onClick={() => handleApproval('rejected')}
              disabled={approving}
              className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-danger text-white hover:bg-danger/90 disabled:opacity-50 transition-colors"
            >
              {approving ? '处理中...' : '驳回'}
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {node.error && (
        <div className="mt-2 p-2 rounded-lg bg-danger/10 text-danger text-xs">
          {node.error}
        </div>
      )}

      {/* Output preview */}
      {expanded && node.output_preview && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="mt-3 p-3 rounded-lg bg-surface-hover text-xs text-text-secondary whitespace-pre-wrap max-h-60 overflow-y-auto"
        >
          {node.output_preview}
        </motion.div>
      )}
    </motion.div>
  )
}

export default function WorkflowRun() {
  const { missionId } = useParams<{ missionId: string }>()
  const [searchParams] = useSearchParams()
  const workflowLabel = searchParams.get('label') || ''
  const navigate = useNavigate()

  const [dagStatus, setDagStatus] = useState<DagStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(Date.now())
  const [elapsed, setElapsed] = useState(0)

  const isDone = dagStatus?.found && ['completed', 'failed'].includes(dagStatus.status)
  const isPaused = dagStatus?.found && dagStatus.status === 'paused'

  const poll = useCallback(async () => {
    if (!missionId) return
    try {
      const data = await fetchDagStatus(missionId)
      setDagStatus(data)
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to fetch status')
    }
  }, [missionId])

  const handleApproval = async (approvalId: string, decision: 'approved' | 'rejected') => {
    try {
      await resolveApproval(approvalId, decision)
      setTimeout(poll, 500)
    } catch (e: any) {
      setError(e.message || 'Approval failed')
    }
  }

  // Start polling
  useEffect(() => {
    poll()
    timerRef.current = setInterval(poll, 2000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [poll])

  // Stop polling when done
  useEffect(() => {
    if (isDone && timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [isDone])

  // WebSocket: instant node status updates
  useEffect(() => {
    if (!missionId) return
    const unsub = wsClient.on('dag_node_update', (data) => {
      if (data.mission_id !== missionId) return
      // Merge WS event into dagStatus for instant feedback
      setDagStatus(prev => {
        if (!prev || !prev.found) return prev
        const nodeId = data.node_id as string
        const newStatus = data.status as string
        const nodes = prev.nodes.map(n =>
          n.id === nodeId
            ? {
                ...n,
                status: newStatus,
                duration_ms: (data.duration as number | undefined)
                  ? Math.round((data.duration as number) * 1000)
                  : n.duration_ms,
                error: (data.error as string) || n.error,
              }
            : n
        )
        const completedCount = nodes.filter(n =>
          ['completed', 'failed', 'skipped'].includes(n.status)
        ).length
        const allDone = nodes.every(n =>
          ['completed', 'failed', 'skipped'].includes(n.status)
        )
        return {
          ...prev,
          nodes,
          completed_count: completedCount,
          status: allDone
            ? (nodes.some(n => n.status === 'failed') ? 'failed' : 'completed')
            : prev.status,
        }
      })
    })
    return unsub
  }, [missionId])

  // Elapsed timer
  useEffect(() => {
    if (isDone) return
    startTimeRef.current = Date.now()
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [isDone])

  const overallStatus = dagStatus?.status || 'running'
  const overallCfg = STATUS_CONFIG[overallStatus] || STATUS_CONFIG.running
  const OverallIcon = overallCfg.icon

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/workstation')}
          className="shrink-0 p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-text truncate">
            {dagStatus?.workflow_name || workflowLabel || '工作流执行'}
          </h1>
          <p className="text-xs text-text-muted">
            任务 ID: {missionId}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isDone && elapsed > 0 && (
            <div className="flex items-center gap-1 text-xs text-text-muted">
              <Timer size={13} />
              <span>{elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m${elapsed % 60}s`}</span>
            </div>
          )}
          <div className={`flex items-center gap-1.5 ${overallCfg.color}`}>
            <OverallIcon size={18} className={overallStatus === 'running' ? 'animate-spin' : ''} />
            <span className="text-sm font-medium">{overallCfg.label}</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {dagStatus?.found && dagStatus.total_count != null && dagStatus.total_count > 0 && (
        <div className="mb-6">
          <div className="flex justify-between text-xs text-text-muted mb-1.5">
            <span>进度</span>
            <span>{dagStatus.completed_count} / {dagStatus.total_count} 节点</span>
          </div>
          <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                overallStatus === 'failed' ? 'bg-danger' : 'bg-accent'
              }`}
              initial={{ width: 0 }}
              animate={{
                width: `${Math.round(((dagStatus.completed_count || 0) / dagStatus.total_count) * 100)}%`,
              }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-danger/10 text-danger text-sm">
          {error}
        </div>
      )}

      {/* Not found yet — waiting for engine to start */}
      {dagStatus && !dagStatus.found && (
        <div className="flex flex-col items-center justify-center py-16 text-text-muted">
          <Loader2 size={32} className="animate-spin mb-3" />
          <p className="text-sm">正在启动工作流...</p>
        </div>
      )}

      {/* Node list */}
      {dagStatus?.found && dagStatus.nodes.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-text">执行节点</h2>
          {dagStatus.nodes.map((node, i) => (
            <NodeCard key={node.id} node={node} index={i} onApprove={handleApproval} />
          ))}
        </div>
      )}

      {/* Done summary */}
      {isDone && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 rounded-xl border border-border bg-surface"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-text">执行摘要</h3>
            <span className="text-xs text-text-muted flex items-center gap-1">
              <Timer size={12} />
              {elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m${elapsed % 60}s`}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-success">
                {dagStatus!.nodes.filter(n => n.status === 'completed').length}
              </p>
              <p className="text-[11px] text-text-muted">完成</p>
            </div>
            <div>
              <p className="text-lg font-bold text-danger">
                {dagStatus!.nodes.filter(n => n.status === 'failed').length}
              </p>
              <p className="text-[11px] text-text-muted">失败</p>
            </div>
            <div>
              <p className="text-lg font-bold text-text-muted">
                {dagStatus!.nodes.filter(n => n.status === 'skipped').length}
              </p>
              <p className="text-[11px] text-text-muted">跳过</p>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => navigate('/workstation')}
              className="flex-1 px-4 py-2 text-sm rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
            >
              返回工位
            </button>
            <button
              onClick={() => navigate('/workflows')}
              className="flex-1 px-4 py-2 text-sm rounded-lg border border-border text-text-secondary hover:bg-surface-hover transition-colors"
            >
              查看流程
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
