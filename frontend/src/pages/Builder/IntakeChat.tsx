/**
 * IntakeChat — 业务信息采集界面（选择 + 对话混合模式）
 *
 * Round 1: 行业选择（IndustrySelector）
 * Round 2: 角色确认（RoleSelector）
 * Round 3: 工作流确认（WorkflowSelector）
 * Round 4-5: 对话式 + chips 引导
 */
import { useState, useRef, useEffect } from 'react'
import { useBuilderStore } from '../../stores/useBuilderStore'
import { Send, Sparkles, Bot, User } from 'lucide-react'
import type { RoleOption, WorkflowOption, IntakeUIType } from '../../types/builder'
import RoleSelector from './RoleSelector'
import WorkflowSelector from './WorkflowSelector'

export default function IntakeChat() {
  const {
    messages, responding, intakeCompleted, intakeStatus,
    currentUIType, currentUIData,
    sendIntake, sendIntakeSelection, refreshIntakeStatus,
    triggerGenerate, generating, generationStatus, session, error,
  } = useBuilderStore()

  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, responding])

  // Refresh status periodically
  useEffect(() => {
    refreshIntakeStatus()
    const interval = setInterval(refreshIntakeStatus, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleSend = () => {
    const text = input.trim()
    if (!text || responding) return
    setInput('')
    sendIntake(text)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChipClick = (chip: string) => {
    if (responding) return
    if (chip === '暂时跳过' || chip === '完成采集') {
      sendIntake(chip)
    } else {
      setInput(prev => {
        // 如果已包含该chip，不重复添加
        if (prev.includes(chip)) return prev
        // 拼接到已有内容后面，用分号分隔
        if (prev.trim()) return prev.trimEnd() + '；' + chip
        return chip
      })
      inputRef.current?.focus()
    }
  }

  // 判断 chip 是否已在输入框中（用于高亮已选中的）
  const isChipSelected = (chip: string) => input.includes(chip)

  // ── 选择回调 ──────────────────────────────────────

  const handleRolesConfirm = (selected: RoleOption[], newRoles: { name: string; description: string }[]) => {
    sendIntakeSelection('role_select', {
      selected_roles: selected.map(r => ({ id: r.id, name: r.name, checked: r.checked })),
      new_roles: newRoles,
    })
  }

  const handleWorkflowsConfirm = (selected: WorkflowOption[], newWorkflows: { name: string; description: string }[]) => {
    sendIntakeSelection('workflow_select', {
      selected_workflows: selected.map(w => ({ id: w.id, name: w.name, checked: w.checked })),
      new_workflows: newWorkflows,
    })
  }

  // ── 判断是否显示选择器 ──────────────────────────────
  // 只在最新的 assistant 消息中显示互动 UI

  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant')
  const activeUIType: IntakeUIType = lastAssistantMsg?.ui_type || currentUIType || 'text'
  const activeUIData = lastAssistantMsg?.ui_data || currentUIData || {}

  const showRoleSelector = activeUIType === 'role_select' && !responding
  const showWorkflowSelector = activeUIType === 'workflow_select' && !responding
  const showChips = activeUIType === 'chips' && activeUIData.chips && !responding
  const showTextInput = !showRoleSelector && !showWorkflowSelector

  const completionPct = intakeStatus?.overall ?? session?.intake_completion ?? 0

  return (
    <div className="flex flex-col h-[calc(100vh-240px)] min-h-[500px]">
      {/* Progress bar */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden border border-border">
          <div
            className="h-full bg-accent transition-all duration-500 rounded-full"
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <span className="text-xs text-text-muted whitespace-nowrap">
          采集进度 {completionPct}%
        </span>
      </div>

      {/* Dimension badges */}
      {intakeStatus && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {Object.entries(intakeStatus.dimensions).map(([dim, ok]) => (
            <span
              key={dim}
              className={`text-xs px-2 py-0.5 rounded-full border ${
                ok
                  ? 'bg-success/10 text-success border-success/20'
                  : 'bg-surface text-text-muted border-border'
              }`}
            >
              {dim}
            </span>
          ))}
        </div>
      )}

      {/* Messages + Selectors area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((msg, i) => {
          const isLastAssistant = msg === lastAssistantMsg
          const msgUIType = msg.ui_type
          const msgUIData = msg.ui_data

          return (
            <div key={i}>
              {/* Message bubble */}
              <div className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === 'user' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'
                  }`}
                >
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div
                  className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-primary text-white rounded-br-md'
                      : 'bg-surface border border-border text-text rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>
              </div>

              {/* 最新 assistant 消息后渲染选择器 */}
              {isLastAssistant && !responding && (
                <div className="ml-11 mt-3">
                  {msgUIType === 'role_select' && msgUIData?.roles && (
                    <RoleSelector
                      roles={msgUIData.roles}
                      onConfirm={handleRolesConfirm}
                      disabled={responding}
                    />
                  )}
                  {msgUIType === 'workflow_select' && msgUIData?.workflows && (
                    <WorkflowSelector
                      workflows={msgUIData.workflows}
                      onConfirm={handleWorkflowsConfirm}
                      disabled={responding}
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Typing indicator */}
        {responding && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <Bot size={16} />
            </div>
            <div className="bg-surface border border-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      {intakeCompleted ? (
        <div className="border-t border-border pt-4">
          {generating ? (
            /* ── 生成进度面板 ── */
            <div className="p-4 bg-surface rounded-lg border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-text">
                  {generationStatus?.step || '准备中...'}
                </span>
                <span className="text-xs text-text-secondary">
                  {generationStatus?.progress || 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-accent h-2 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${generationStatus?.progress || 2}%` }}
                />
              </div>
              {(generationStatus?.steps_detail?.length ?? 0) > 0 && (
                <div className="mt-3 space-y-1">
                  {generationStatus!.steps_detail.map((d, i) => (
                    <div key={i} className="text-xs text-text-secondary flex items-center gap-1.5">
                      <span className="text-green-500">✓</span> {d}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-text-muted mt-2">
                正在为您生成 AI 团队配置，请稍候...
              </p>
            </div>
          ) : (
            /* ── 生成按钮 ── */
            <div className="text-center">
              <p className="text-sm text-text-secondary mb-3">
                信息采集完成！点击下方按钮生成 AI 团队配置。
              </p>
              {error && (
                <p className="text-sm text-danger mb-3">{error}</p>
              )}
              <button
                onClick={triggerGenerate}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
              >
                <Sparkles size={16} />
                {error ? '重新生成 AI 团队配置' : '生成 AI 团队配置'}
              </button>
            </div>
          )}
        </div>
      ) : showTextInput ? (
        <div className="border-t border-border pt-3">
          {/* Chips 引导（点击可拼接到输入框） */}
          {showChips && activeUIData.chips && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {activeUIData.chips.map(chip => {
                const selected = isChipSelected(chip)
                return (
                  <button
                    key={chip}
                    onClick={() => handleChipClick(chip)}
                    disabled={responding}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors disabled:opacity-40 ${
                      selected
                        ? 'border-accent bg-accent text-white'
                        : 'border-accent/30 text-accent bg-accent/5 hover:bg-accent/10'
                    }`}
                  >
                    {selected && <span className="mr-1">&#10003;</span>}
                    {chip}
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入您的回答..."
              rows={2}
              className="flex-1 resize-none bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
              disabled={responding}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || responding}
              className="self-end px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
