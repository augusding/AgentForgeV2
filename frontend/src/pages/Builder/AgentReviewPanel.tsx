/**
 * Agent Review Panel
 *
 * Builder Review 阶段的 Agent 卡片审核面板。
 * 展示所有生成的 Agent 卡片，支持逐个审核。
 *
 * 功能:
 * - 网格布局展示所有 Agent 卡片
 * - 全部通过 / 逐个审核
 * - 修改请求会弹出对话式输入
 * - 审核进度条
 * - 完成后进入下一阶段
 */
import { useState, useMemo } from 'react'
import { Check, CheckCheck, ArrowRight, MessageSquare, X, Loader2 } from 'lucide-react'
import AgentReviewCard, { parseAgentYaml, type ParsedAgent } from './AgentReviewCard'
import { useBuilderStore } from '../../stores/useBuilderStore'
import { regenerateAgent } from '../../api/builder'
import toast from 'react-hot-toast'

type AgentStatus = 'pending' | 'approved' | 'modified' | 'regenerating'

interface EditRequest {
  agentId: string
  instruction: string
}

export default function AgentReviewPanel() {
  const { preview, session, loadPreview } = useBuilderStore()

  // Agent review statuses
  const [statuses, setStatuses] = useState<Record<string, AgentStatus>>({})
  // Edit dialog state
  const [editingAgent, setEditingAgent] = useState<string | null>(null)
  const [editInput, setEditInput] = useState('')
  const [submittingEdit, setSubmittingEdit] = useState(false)
  // Edit history
  const [editRequests, setEditRequests] = useState<EditRequest[]>([])

  // Parse all agents from YAML strings
  const parsedAgents = useMemo(() => {
    if (!preview?.agents) return []
    return Object.entries(preview.agents)
      .map(([aid, yamlStr]) => {
        const parsed = parseAgentYaml(yamlStr)
        if (parsed) {
          // Ensure agent_id is set
          if (!parsed.agent_id) parsed.agent_id = aid
          return parsed
        }
        return null
      })
      .filter(Boolean) as ParsedAgent[]
  }, [preview?.agents])

  const totalAgents = parsedAgents.length
  const approvedCount = parsedAgents.filter(a => {
    const s = statuses[a.agent_id]
    return s === 'approved' || s === 'modified'
  }).length
  const allApproved = totalAgents > 0 && approvedCount === totalAgents

  // ── Handlers ──

  const handleApprove = (agentId: string) => {
    setStatuses(prev => ({ ...prev, [agentId]: 'approved' }))
  }

  const handleApproveAll = () => {
    const newStatuses: Record<string, AgentStatus> = {}
    parsedAgents.forEach(a => {
      newStatuses[a.agent_id] = statuses[a.agent_id] || 'approved'
    })
    setStatuses(newStatuses)
  }

  const handleRequestEdit = (agentId: string) => {
    setEditingAgent(agentId)
    setEditInput('')
  }

  const handleSubmitEdit = async () => {
    if (!editingAgent || !editInput.trim() || !session) return
    const agentId = editingAgent
    const instruction = editInput.trim()
    setSubmittingEdit(true)
    setEditRequests(prev => [...prev, { agentId, instruction }])

    try {
      setStatuses(prev => ({ ...prev, [agentId]: 'regenerating' }))
      setEditingAgent(null)
      setEditInput('')

      await regenerateAgent(session.session_id, agentId, instruction)
      // Reload preview to get updated YAML
      await loadPreview()
      setStatuses(prev => ({ ...prev, [agentId]: 'modified' }))
      toast.success(`${agentId} 已按指令修改`)
    } catch {
      setStatuses(prev => ({ ...prev, [agentId]: 'pending' }))
      toast.error('修改失败，请重试')
    } finally {
      setSubmittingEdit(false)
    }
  }

  const handleRegenerate = async (agentId: string) => {
    if (!session) return
    setStatuses(prev => ({ ...prev, [agentId]: 'regenerating' }))
    try {
      await regenerateAgent(session.session_id, agentId)
      await loadPreview()
      setStatuses(prev => ({ ...prev, [agentId]: 'pending' }))
      toast.success(`${agentId} 已重新生成`)
    } catch {
      setStatuses(prev => ({ ...prev, [agentId]: 'pending' }))
      toast.error('重新生成失败')
    }
  }

  const handleProceed = () => {
    // Move to calibration phase
    useBuilderStore.setState(s => ({
      session: s.session ? { ...s.session, phase: 'calibration' } : null,
    }))
  }

  if (!preview || parsedAgents.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-sm text-text-secondary">暂无 Agent 配置可审核</span>
      </div>
    )
  }

  return (
    <div>
      {/* ── Progress Header ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-text">
            Agent 审核 ({approvedCount}/{totalAgents})
          </h2>
          <div className="flex items-center gap-2">
            {!allApproved && (
              <button
                onClick={handleApproveAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-success bg-success/10 border border-success/20 rounded-md hover:bg-success/20 transition-colors"
              >
                <CheckCheck size={14} /> 全部通过
              </button>
            )}
            {allApproved && (
              <button
                onClick={handleProceed}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent/90 transition-colors"
              >
                进入校准 <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-border/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-success rounded-full transition-all duration-500 ease-out"
            style={{ width: `${totalAgents > 0 ? (approvedCount / totalAgents) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* ── Edit Requests History ── */}
      {editRequests.length > 0 && (
        <div className="mb-4 p-3 bg-accent/5 border border-accent/20 rounded-lg">
          <h3 className="text-xs font-semibold text-accent mb-2">修改请求</h3>
          <div className="space-y-1">
            {editRequests.map((req, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <MessageSquare size={12} className="text-accent mt-0.5 shrink-0" />
                <span className="text-text-secondary">
                  <span className="font-medium text-text">{req.agentId}</span>: {req.instruction}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Agent Cards Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {parsedAgents.map(agent => (
          <AgentReviewCard
            key={agent.agent_id}
            agent={agent}
            status={statuses[agent.agent_id] || 'pending'}
            onApprove={handleApprove}
            onRequestEdit={handleRequestEdit}
            onRegenerate={handleRegenerate}
          />
        ))}
      </div>

      {/* ── Bottom Actions (when all approved) ── */}
      {allApproved && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-success flex items-center gap-2">
            <Check size={16} /> 所有 Agent 已审核通过
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                // Skip calibration, go to finalize
                useBuilderStore.getState().triggerFinalize()
              }}
              className="text-sm text-text-secondary hover:text-text transition-colors"
            >
              跳过校准，直接定稿
            </button>
            <button
              onClick={handleProceed}
              className="flex items-center gap-2 px-5 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
            >
              进入校准 <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Edit Dialog ── */}
      {editingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text">
                修改 Agent: {editingAgent}
              </h3>
              <button
                onClick={() => setEditingAgent(null)}
                className="p-1 text-text-muted hover:text-text transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5">
              <p className="text-xs text-text-secondary mb-3">
                用自然语言描述你想要的修改。例如："把性格改温和一点"、"增加一个SEO优化的技能"
              </p>
              <textarea
                value={editInput}
                onChange={e => setEditInput(e.target.value)}
                placeholder="描述你想要的修改..."
                rows={3}
                className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-accent text-text placeholder:text-text-muted"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleSubmitEdit()
                  }
                }}
              />
              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={() => setEditingAgent(null)}
                  className="px-3 py-1.5 text-xs text-text-secondary hover:text-text transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmitEdit}
                  disabled={!editInput.trim() || submittingEdit}
                  className="flex items-center gap-1 px-4 py-1.5 text-xs font-medium text-white bg-accent rounded-md hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {submittingEdit && <Loader2 size={12} className="animate-spin" />}
                  提交修改
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
