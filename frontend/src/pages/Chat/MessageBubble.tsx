import { useState, useEffect, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GitBranch, AlertCircle, RotateCw, Copy, Check, BookOpen, ChevronDown, ThumbsUp, ThumbsDown, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { sendSignal } from '../../api/analytics'
import { trackAdoption, trackIgnored } from '../../utils/signalTracker'
import AgentAvatar from '../../components/AgentAvatar'
import MarkdownRenderer from '../../components/MarkdownRenderer'
import StepCard from './StepCard'
import AgentRoster from './AgentRoster'
import PlanCollapse from './PlanCollapse'
import ThinkingCollapse from './ThinkingCollapse'
import ReasoningBlock from './ReasoningBlock'
import ToolStepsCollapse from './ToolStepsCollapse'
import FileCard from './FileCard'
import AttachmentBadge from './AttachmentBadge'
import { formatTokenCount, formatDuration } from '../../utils/formatToken'
import { useChatStore } from '../../stores/useChatStore'
import type { ChatMessage } from '../../types/chat'
import dayjs from 'dayjs'

// ── RAG 引用来源组件 ──
function CitationBar({ citations }: { citations: import('../../types/chat').Citation[] }) {
  const [expanded, setExpanded] = useState(false)
  if (!citations || citations.length === 0) return null

  return (
    <div className="mt-2 pt-2 border-t border-border/40">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text transition-colors"
      >
        <BookOpen size={12} />
        <span>引用了 {citations.length} 条知识</span>
        <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1">
          {citations.map(c => (
            <div key={c.order} className="flex items-start gap-2 px-2 py-1.5 rounded bg-bg/50 text-[11px]">
              <span className="shrink-0 w-4 h-4 rounded-full bg-accent/10 text-accent flex items-center justify-center text-[9px] font-bold mt-0.5">
                {c.order}
              </span>
              <div className="min-w-0">
                <p className="font-medium text-text truncate">{c.title}</p>
                <p className="text-text-muted line-clamp-2 mt-0.5">{c.text_preview}</p>
              </div>
              <span className="shrink-0 text-[9px] text-text-muted mt-0.5">
                {Math.round(c.score * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Skill 执行徽章 ──
function SkillBadge({ skill }: { skill: import('../../types/chat').SkillInfo }) {
  const reqLen = skill.tools_required.length
  const compliance = reqLen > 0
    ? skill.tools_called.filter(t => skill.tools_required.includes(t)).length / reqLen
    : 1
  const color = reqLen === 0
    ? 'bg-accent/10 text-accent border-accent/20'
    : compliance >= 1 ? 'bg-green-500/10 text-green-400 border-green-500/20'
    : compliance >= 0.5 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    : 'bg-red-500/10 text-red-400 border-red-500/20'

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${color}`}>
      <Zap size={9} />
      {skill.name}
      {reqLen > 0 && <span className="opacity-70">{Math.round(compliance * 100)}%</span>}
    </span>
  )
}

// ── 动态等待提示 — 根据消息状态显示真实阶段 ──

const TOOL_LABELS: Record<string, string> = {
  search_knowledge: '检索知识库', list_workflows: '查询工作流',
  calculator: '计算中', datetime: '处理时间', text_processor: '处理文本',
  json_parser: '解析JSON', web_search: '搜索网络', web_scraper: '抓取网页',
  http_request: '请求API', data_analysis: '分析数据', code_executor: '执行代码',
  shell_executor: '执行命令', email_sender: '发送邮件', workflow_trigger: '触发工作流',
  memory_write: '写入记忆', word_processor: '生成文档', excel_processor: '处理表格',
  ppt_processor: '生成PPT', pdf_processor: '处理PDF', csv_processor: '处理CSV',
  image_processor: '处理图片', qrcode_tool: '生成二维码', audio_processor: '处理音频',
  archive_tool: '压缩文件', browser_tool: '浏览器操作', file_ops: '操作文件',
}

// 默认等待时的轮播文案
const DEFAULT_PHRASES = ['理解任务中', '分析问题中', '整理思路中', '准备回复中']

function getWaitingPhrase(message?: ChatMessage): string | null {
  if (!message) return null

  // 有推理过程
  if (message.reasoning) return '深度推理中...'
  // 有计划
  if (message.solo_plan) return '制定执行方案...'
  // 有工具正在执行
  const runningTool = message.solo_tools?.find(t => t.status === 'running')
  if (runningTool) return `${TOOL_LABELS[runningTool.tool] ?? `调用 ${runningTool.tool}`}...`
  // 有思考步骤
  if (message.solo_thinking?.length) return '整理思路...'
  // 多Agent
  if (message.is_multi_agent) {
    const running = message.steps?.find(s => s.status === 'running')
    return running ? `${running.agent_name} 执行中...` : '协调任务分配...'
  }
  // 默认：返回 null 让组件自行轮播
  return null
}

function WaitingText({ message }: { message?: ChatMessage }) {
  const [phraseIdx, setPhraseIdx] = useState(0)
  const specific = getWaitingPhrase(message)

  // 当有明确状态时不轮播；无明确状态时每 1.8s 切换一条
  useEffect(() => {
    if (specific) return
    const id = setInterval(() => setPhraseIdx(i => (i + 1) % DEFAULT_PHRASES.length), 1800)
    return () => clearInterval(id)
  }, [specific])

  // 明确状态变化时重置 phraseIdx
  const runningToolKey = message?.solo_tools?.find(t => t.status === 'running')?.tool ?? ''
  useEffect(() => {
    setPhraseIdx(0)
  }, [message?.reasoning, message?.solo_plan, runningToolKey, message?.solo_thinking?.length])

  const text = specific ?? `${DEFAULT_PHRASES[phraseIdx]}...`

  return (
    <div className="flex items-center gap-1">
      <span className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      <span className="text-[11px] text-text-muted ml-1.5 transition-all duration-300">{text}</span>
    </div>
  )
}

// ── Hover 元数据（默认只显示耗时，hover 显示详细） ──
function HoverMeta({ model, tokens, duration }: { model?: string; tokens?: number; duration?: number }) {
  if (!model && tokens == null && duration == null) return null
  return (
    <div className="group flex items-center gap-3 mt-1 pl-1 text-[10px] text-text-muted">
      {duration != null && <span>{formatDuration(duration)}</span>}
      <div className="hidden group-hover:flex items-center gap-3 transition-opacity">
        {model && <span>{model}</span>}
        {tokens != null && <span>{formatTokenCount(tokens)} tokens</span>}
      </div>
    </div>
  )
}

function CopyButton({ text, messageId }: { text: string; messageId?: string }) {
  const [copied, setCopied] = useState(false)
  const sessionId = useChatStore(s => s.sessionId)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('已复制', { duration: 1500 })
      setTimeout(() => setCopied(false), 2000)
      // V21: 发送复制信号
      if (messageId) {
        sendSignal(sessionId, messageId, 'copy').catch(() => {})
      }
    } catch {
      toast.error('复制失败')
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-text transition-all rounded"
      title="复制消息"
    >
      {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
    </button>
  )
}

function FeedbackButtons({ messageId }: { messageId: string }) {
  const feedback = useChatStore(s => s.feedbacks[messageId])
  const setFeedback = useChatStore(s => s.setFeedback)

  return (
    <span className="inline-flex items-center gap-0.5 ml-0.5">
      <button
        onClick={() => { setFeedback(messageId, 'up'); trackAdoption('message', messageId) }}
        className={`p-1 rounded transition-all ${
          feedback === 'up'
            ? 'text-success opacity-100'
            : 'opacity-0 group-hover:opacity-100 text-text-muted hover:text-success'
        }`}
        title="有用"
      >
        <ThumbsUp size={13} fill={feedback === 'up' ? 'currentColor' : 'none'} />
      </button>
      <button
        onClick={() => { setFeedback(messageId, 'down'); trackIgnored('message', messageId) }}
        className={`p-1 rounded transition-all ${
          feedback === 'down'
            ? 'text-danger opacity-100'
            : 'opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger'
        }`}
        title="无用"
      >
        <ThumbsDown size={13} fill={feedback === 'down' ? 'currentColor' : 'none'} />
      </button>
    </span>
  )
}

interface Props {
  message: ChatMessage
  isStreaming?: boolean
}

// ── 长内容折叠 — 超过 max-height 后可展开/收起 ──
function CollapsibleContent({ children, maxHeight = 360 }: { children: React.ReactNode; maxHeight?: number }) {
  const [collapsed, setCollapsed] = useState(true)
  const [needsCollapse, setNeedsCollapse] = useState(false)
  const contentRef = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = contentRef[0]
    if (el && el.scrollHeight > maxHeight + 60) {
      setNeedsCollapse(true)
    }
  }, [children, maxHeight])

  return (
    <div className="relative">
      <div
        ref={(el) => { contentRef[0] = el }}
        className="overflow-hidden transition-[max-height] duration-300"
        style={{ maxHeight: collapsed && needsCollapse ? `${maxHeight}px` : 'none' }}
      >
        {children}
      </div>
      {needsCollapse && (
        <div className={collapsed
          ? 'absolute bottom-0 left-0 right-0 pt-10 pb-1 bg-gradient-to-t from-[var(--color-agent-bubble)] to-transparent flex justify-center'
          : 'flex justify-center pt-1'
        }>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-[10px] text-accent hover:text-accent/80 bg-[var(--color-agent-bubble)] border border-border rounded-full px-3 py-0.5 transition-colors"
          >
            {collapsed ? '展开全部 ▾' : '收起 ▴'}
          </button>
        </div>
      )}
    </div>
  )
}

function MessageBubble({ message, isStreaming }: Props) {
  const { role, content, agent_id, agent_name, model_used, tokens_used, duration_ms, created_at } = message
  const toggleStepCollapse = useChatStore(s => s.toggleStepCollapse)

  // System message
  if (role === 'system') {
    return (
      <div className="flex items-center gap-3 py-3 px-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-text-muted whitespace-nowrap">{content}</span>
        <div className="flex-1 h-px bg-border" />
      </div>
    )
  }

  // ── Error message — red card with retry button ──
  if (role === 'agent' && content.startsWith('Error:')) {
    const errorText = content.replace(/^Error:\s*/, '')
    const retrySend = useChatStore.getState().retrySend
    const syncFromServer = useChatStore.getState().syncFromServer
    const isNetworkError = errorText.includes('网络') || errorText.includes('连接') || errorText.includes('超时') || errorText.includes('Failed to fetch')

    return (
      <div className="flex gap-2.5 mb-4">
        <div className="shrink-0 mt-0.5">
          <div className="w-8 h-8 rounded-full bg-danger/10 flex items-center justify-center">
            <AlertCircle size={16} className="text-danger" />
          </div>
        </div>
        <div className="min-w-[320px] max-w-[92%] md:max-w-[82%] min-w-0">
          <div className="bg-danger/5 border border-danger/20 rounded-2xl rounded-tl-md px-4 py-3">
            <p className="text-xs text-danger font-medium mb-1">请求失败</p>
            <p className="text-[13px] text-text-secondary leading-relaxed">{errorText}</p>
            {isNetworkError && (
              <p className="text-[11px] text-text-muted mt-1">如果任务已在后台完成，点击"恢复结果"可尝试获取</p>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={retrySend}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-accent hover:bg-accent/10 rounded-md transition-colors"
            >
              <RotateCw size={12} />
              <span>重试</span>
            </button>
            {isNetworkError && (
              <button
                onClick={async () => {
                  await syncFromServer()
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-text-secondary hover:bg-surface-hover rounded-md transition-colors"
              >
                <RotateCw size={12} />
                <span>恢复结果</span>
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // User message
  if (role === 'user') {
    const hasAttachments = message.attachments && message.attachments.length > 0
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[70%]">
          <div
            className="rounded-2xl rounded-br-md px-4 py-2.5"
            style={{ backgroundColor: 'var(--color-user-bubble)' }}
          >
            {content && (
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-user-bubble-text)' }}>
                {content}
              </p>
            )}
            {hasAttachments && (
              <div className={`flex flex-wrap gap-1.5 ${content ? 'mt-2' : ''}`}>
                {message.attachments!.map(att => (
                  <AttachmentBadge key={att.file_id} attachment={att} />
                ))}
              </div>
            )}
          </div>
          <div className="text-right mt-1 pr-1">
            <span className="text-[10px] text-text-muted">{dayjs(created_at).format('HH:mm')}</span>
          </div>
        </div>
      </div>
    )
  }


  // ── 多Agent模式：步骤卡片布局（渐进式揭示） ──
  if (message.is_multi_agent && message.steps && message.steps.length > 0) {
    const doneCount = message.steps.filter(s => s.status === 'done').length
    const totalSteps = message.steps.length
    const progress = (doneCount / totalSteps) * 100

    // 渐进式：只展示已激活的步骤（running / done / error），隐藏 pending
    const visibleSteps = message.steps.filter(s => s.status !== 'pending')
    const runningSteps = message.steps.filter(s => s.status === 'running')
    const pendingSteps = message.steps.filter(s => s.status === 'pending')
    const isParallel = runningSteps.length > 1
    const firstRunningId = runningSteps[0]?.step_id

    return (
      <div className="flex gap-3 mb-3 animate-fade-in">
        {/* 规划器头像 */}
        <div className="shrink-0 mt-1">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">AF</span>
          </div>
        </div>

        <div className="flex-1 min-w-0 max-w-[85%]">
          {/* Plan Header */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-text">执行计划</span>
            <span className="text-[11px] text-text-muted px-1.5 py-0.5 bg-surface-hover rounded">
              {message.plan_source || 'auto'} · {totalSteps} 步
            </span>
            {isStreaming && doneCount === 0 && runningSteps.length === 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-accent">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                </span>
                即将开始执行...
              </span>
            )}
            {isStreaming && (doneCount > 0 || runningSteps.length > 0) && (
              <span className="inline-flex items-center gap-1 text-[11px] text-accent">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                </span>
                {doneCount}/{totalSteps} 步已完成
                {runningSteps.length === 1 && ` · ${runningSteps[0].agent_name} 工作中`}
                {isParallel && ` · ${runningSteps.length}个角色并行中`}
              </span>
            )}
            {!isStreaming && doneCount === totalSteps && (
              <span className="text-[11px] text-success font-medium">已完成</span>
            )}
          </div>

          {/* 计划概览文本（planner delta 输出） */}
          {content && (
            <div className="mb-3 text-sm">
              <MarkdownRenderer content={content} />
            </div>
          )}

          {/* Agent 参与者概览 — 仅完成后展示全貌，执行中隐藏避免剧透 */}
          {!isStreaming && doneCount === totalSteps && (
            <AgentRoster steps={message.steps} />
          )}

          {/* 进度条 */}
          <div className="h-1 bg-border/50 rounded-full mb-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                isStreaming && progress < 100 ? 'bg-accent animate-pulse' : 'bg-accent'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* 步骤卡片 — 渐进式揭示，每个角色完成后才出现下一个 */}
          <AnimatePresence initial={false}>
            {visibleSteps.map(step => {
              const isRunning = step.status === 'running'
              const isFirstRunning = step.step_id === firstRunningId
              const isInParallel = isParallel && isRunning

              return (
                <motion.div
                  key={step.step_id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  {/* 并行执行标识 — 仅在第一个并行步骤前显示 */}
                  {isFirstRunning && isParallel && (
                    <div className="flex items-center gap-1.5 mt-1 mb-1.5 ml-1">
                      <GitBranch size={12} className="text-accent" />
                      <span className="text-[11px] text-accent font-medium">
                        {runningSteps.length} 个角色并行执行
                      </span>
                    </div>
                  )}
                  <div className={isInParallel ? 'border-l-2 border-accent/30 pl-2.5 ml-1.5' : ''}>
                    <StepCard
                      step={step}
                      stepNumber={step.step_index + 1}
                      totalSteps={totalSteps}
                      onToggleCollapse={() => toggleStepCollapse(message.id, step.step_id)}
                    />
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>

          {/* 待执行提示 — 告知用户还有后续步骤，但不暴露具体内容 */}
          {pendingSteps.length > 0 && isStreaming && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 mt-1 py-2 ml-1"
            >
              <div className="flex gap-1">
                {Array.from({ length: Math.min(pendingSteps.length, 3) }).map((_, i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-border" />
                ))}
              </div>
              <span className="text-[11px] text-text-muted">
                接下来还有 {pendingSteps.length} 步待执行
              </span>
            </motion.div>
          )}

          {/* 完成后元数据 — hover 显示详细 */}
          {!isStreaming && tokens_used != null && (
            <HoverMeta model={model_used} tokens={tokens_used} duration={duration_ms ?? undefined} />
          )}
        </div>
      </div>
    )
  }

  // ── V7 统一渲染路径 ──
  const hasProcess = !!(message.reasoning || message.solo_plan || message.solo_thinking?.length || message.solo_tools?.length)
  const showMeta = !isStreaming && (model_used || tokens_used)

  return (
    <div className="group flex gap-2.5 mb-4">
      <div className="shrink-0 mt-0.5">
        <AgentAvatar
          agentId={agent_id || 'unknown'}
          name={agent_name || 'Agent'}
          size="sm"
          status={isStreaming ? 'executing' : 'idle'}
        />
      </div>
      <div className="min-w-[320px] max-w-[92%] md:max-w-[82%] min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-text">{agent_name || 'AI 助手'}</span>
          {!isStreaming && message.skill && <SkillBadge skill={message.skill} />}
          {!isStreaming && (
            <span className="text-[10px] text-text-muted">{dayjs(created_at).format('HH:mm')}</span>
          )}
          {!isStreaming && content && (
            <>
              <CopyButton text={content} messageId={message.id} />
              <FeedbackButtons messageId={message.id} />
            </>
          )}
          {isStreaming && (
            <span className="inline-flex items-center gap-1 text-[10px] text-accent">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
              </span>
              {hasProcess ? '执行中' : '输出中'}
            </span>
          )}
        </div>

        {/* 统一气泡：过程块 + 回答内容 + 文件 */}
        <div
          className="chat-bubble rounded-2xl rounded-tl-md px-4 py-3 border overflow-hidden"
          style={{
            backgroundColor: 'var(--color-agent-bubble)',
            borderColor: 'var(--color-agent-bubble-border)',
          }}
        >
          {/* 过程区 */}
          {hasProcess && (
            <div className={content ? 'mb-2' : ''}>
              {message.reasoning && (
                <ReasoningBlock content={message.reasoning} phase={message.reasoning_phase} isStreaming={!!isStreaming} />
              )}
              {message.solo_plan && <PlanCollapse plan={message.solo_plan} />}
              {message.solo_thinking && message.solo_thinking.length > 0 && (
                <ThinkingCollapse thoughts={message.solo_thinking} isStreaming={!!isStreaming} />
              )}
              {message.solo_tools && message.solo_tools.length > 0 && (
                <ToolStepsCollapse tools={message.solo_tools} isStreaming={!!isStreaming} />
              )}
            </div>
          )}

          {/* 回答内容 */}
          {content ? (
            isStreaming ? (
              <>
                <MarkdownRenderer content={content} />
                <span className="inline-block w-0.5 h-4 bg-accent ml-0.5 align-text-bottom animate-pulse" />
              </>
            ) : (
              <CollapsibleContent>
                <MarkdownRenderer content={content} />
              </CollapsibleContent>
            )
          ) : isStreaming ? (
            <WaitingText message={message} />
          ) : null}
          {!isStreaming && message.citations && <CitationBar citations={message.citations} />}

          {/* 文件卡片 */}
          {message.solo_files && message.solo_files.length > 0 && (
            <div className="mt-3 space-y-2">
              {message.solo_files.map((f, i) => (
                <motion.div
                  key={`${f.filename}-${i}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.3, ease: 'easeOut' }}
                >
                  <FileCard file={f} />
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {showMeta && (
          <HoverMeta model={model_used} tokens={tokens_used} duration={duration_ms ?? undefined} />
        )}
      </div>
    </div>
  )
}

// P2 Task 7: React.memo — 非流式消息不随父组件重渲染
export default memo(MessageBubble, (prev, next) => {
  if (next.isStreaming) return false          // 流式中始终更新
  return prev.message === next.message       // 引用不变则跳过
})
