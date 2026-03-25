import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, LayoutDashboard, ArrowRight } from 'lucide-react'
import MessageBubble from './MessageBubble'
import MissionProgress from './MissionProgress'
import WorkflowProgress from './WorkflowProgress'
import ApprovalCard from './ApprovalCard'
import HumanInputCard from './HumanInputCard'
import PositionWelcome from './PositionWelcome'
import ValueReport from './ValueReport'
import type { ChatMessage } from '../../types/chat'
import type { Mission, ApprovalRequest } from '../../types/mission'
import type { WorkflowV2Data } from '../../types/workflow'
import { useMissionStore } from '../../stores/useMissionStore'
import { useChatStore } from '../../stores/useChatStore'
import { useScenarioStore } from '../../stores/useScenarioStore'

/** V7: 未选择岗位时的引导提示 */
function NoPositionPrompt() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8">
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-accent/10 flex items-center justify-center">
        <LayoutDashboard size={32} className="text-accent" />
      </div>
      <h2 className="text-lg font-bold text-text mb-2">请先选择工位岗位</h2>
      <p className="text-sm text-text-muted max-w-sm text-center mb-6">
        选择岗位后，AI 助手将根据岗位职责提供专业支持
      </p>
      <button
        onClick={() => navigate('/workstation')}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white font-medium rounded-xl hover:bg-accent/90 transition-all"
      >
        <LayoutDashboard size={16} />
        前往工位
        <ArrowRight size={14} />
      </button>
    </div>
  )
}

interface Props {
  messages: ChatMessage[]
  mission: Mission | null
  approvals: ApprovalRequest[]
  onResolveApproval: (id: string, decision: string) => void
  responding?: boolean
  streamingMessageId?: string | null
  onFileDrop?: (files: File[]) => void
  onSend?: (content: string) => void
  positionName?: string
  positionPersonality?: string
  knowledgeScope?: string[]
  onboarding?: { tip: string; prompts: string[] }
}

export default function ChatMain({ messages, mission, approvals, onResolveApproval, responding, streamingMessageId, onFileDrop, onSend, positionName, positionPersonality, knowledgeScope, onboarding }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragCounterRef = useRef(0)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setIsDragging(false)

    if (e.dataTransfer.files.length > 0 && onFileDrop) {
      onFileDrop(Array.from(e.dataTransfer.files))
    }
  }, [onFileDrop])

  // Scenario execution tracking
  const activeExecution = useScenarioStore(s => s.activeExecution)
  const finishExecution = useScenarioStore(s => s.finishExecution)
  const exitDemoMode = useScenarioStore(s => s.exitDemoMode)
  const selectScenario = useScenarioStore(s => s.selectScenario)

  // Show ValueReport when: scenario was launched, stream is done, has agent messages
  const lastAgentMsg = [...messages].reverse().find(m => m.role === 'agent')
  const showValueReport = !!(
    activeExecution &&
    !responding &&
    messages.length > 1 &&
    lastAgentMsg?.content
  )

  // Auto-scroll: on new messages AND during streaming (content updates)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    // Only auto-scroll if user is near bottom (within 150px)
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Also scroll on streaming content changes (check last message content length)
  const lastMsg = messages[messages.length - 1]
  const contentLen = lastMsg?.content?.length || 0
  const soloToolsLen = lastMsg?.solo_tools?.length || 0
  const soloFilesLen = lastMsg?.solo_files?.length || 0
  useEffect(() => {
    if (streamingMessageId) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [contentLen, soloToolsLen, soloFilesLen, streamingMessageId])

  const showProgress = mission && mission.status === 'in_progress' && mission.total_steps && mission.total_steps > 1
  const dagState = useMissionStore((s) => s.dagState)
  const isWorkflowMission = mission?.mode === 'workflow' && dagState

  return (
    <div
      className="flex-1 flex flex-col min-w-0 min-h-0 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag-drop overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-20 bg-primary/5 border-2 border-dashed border-primary/40 rounded-lg flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload size={40} className="opacity-60" />
            <span className="text-base font-medium">松开上传文件</span>
          </div>
        </div>
      )}

      {/* Workflow DAG progress (for workflow missions with dag state) */}
      {isWorkflowMission && mission.status === 'in_progress' && (
        <WorkflowProgress
          workflow={mission.blackboard?.['_workflow'] as unknown as WorkflowV2Data || { name: mission.title, description: '', version: '1.0', trigger: { keywords: [], semantic: '', priority: 0 }, parameters: [], nodes: [], metadata: {} }}
          dagState={dagState}
          missionTitle={mission.title}
        />
      )}

      {/* Linear mission progress bar (for non-workflow missions) */}
      {showProgress && !isWorkflowMission && (
        <MissionProgress
          title={mission.title}
          currentStep={mission.current_step || 0}
          totalSteps={mission.total_steps || 0}
          description={
            mission.steps.find(s => s.status === 'in_progress')?.description
          }
          currentAgent={
            mission.steps.find(s => s.status === 'in_progress')?.agent_name
          }
          tokens={mission.total_tokens}
        />
      )}

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-6 py-5">
        {messages.length === 0 ? (
          positionName && onSend ? (
            <PositionWelcome
              positionName={positionName}
              personality={positionPersonality || ''}
              knowledgeScope={knowledgeScope || []}
              onboarding={onboarding}
              onSend={onSend}
            />
          ) : null
        ) : (
          <>
            {messages.map(msg => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isStreaming={msg.id === streamingMessageId}
              />
            ))}

            {/* Inline approvals */}
            {approvals.filter(a => a.status === 'pending').map(approval => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                onResolve={onResolveApproval}
              />
            ))}

            {/* Human input requests */}
            {messages
              .flatMap(m => (m.human_inputs || []).map(hi => ({ ...hi, msgId: m.id })))
              .filter(hi => hi.status === 'pending')
              .map(hi => (
                <HumanInputCard
                  key={`${hi.msgId}-${hi.node_id}`}
                  request={hi}
                  onSubmitted={() => {
                    useChatStore.getState().updateMessage(hi.msgId, {
                      human_inputs: messages.find(m => m.id === hi.msgId)?.human_inputs?.map(
                        h => h.node_id === hi.node_id ? { ...h, status: 'submitted' as const } : h
                      ),
                    })
                  }}
                  onCancelled={() => {
                    const msg = messages.find(m => m.id === hi.msgId)
                    const store = useChatStore.getState()

                    // 1. 标记人工输入为已取消 + 停止所有未完成的步骤
                    store.updateMessage(hi.msgId, {
                      human_inputs: msg?.human_inputs?.map(
                        h => h.node_id === hi.node_id ? { ...h, status: 'cancelled' as const } : h
                      ),
                      steps: msg?.steps?.map(s =>
                        s.status === 'running'
                          ? { ...s, status: 'error' as const, collapsed: true }
                          : s
                      ),
                    })

                    // 2. 停止流式状态
                    useChatStore.setState({ responding: false, streamingMessageId: null })

                    // 3. 8秒后自动隐藏已取消的卡片
                    setTimeout(() => {
                      const freshMsg = useChatStore.getState().messages.find(m => m.id === hi.msgId)
                      useChatStore.getState().updateMessage(hi.msgId, {
                        human_inputs: freshMsg?.human_inputs?.map(
                          h => h.node_id === hi.node_id ? { ...h, status: 'submitted' as const } : h
                        ),
                      })
                    }, 8000)
                  }}
                />
              ))
            }

            {/* Value Report — shown after scenario execution completes */}
            {showValueReport && activeExecution && (
              <ValueReport
                scenario={activeExecution}
                agentCount={activeExecution.agents_involved.length}
                durationMs={lastAgentMsg?.duration_ms}
                tokensUsed={lastAgentMsg?.tokens_used}
                onTryAnother={() => {
                  finishExecution()
                  // Re-open the scenario welcome by selecting nothing (user sees cards again on next clear)
                }}
                onFreeExplore={() => {
                  finishExecution()
                  exitDemoMode()
                }}
              />
            )}

            {/* Thinking indicator — only for non-streaming responding (fallback path).
                During streaming, the MessageBubble itself shows thinking dots. */}
            {responding && !streamingMessageId && (
              <div className="flex gap-2.5 mb-4">
                <div className="shrink-0 mt-0.5 w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-accent">AI</span>
                </div>
                <div
                  className="rounded-2xl rounded-tl-md px-4 py-3 border"
                  style={{ backgroundColor: 'var(--color-agent-bubble)', borderColor: 'var(--color-agent-bubble-border)' }}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-[11px] text-text-muted ml-1">正在思考...</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
