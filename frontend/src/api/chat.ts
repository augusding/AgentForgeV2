import client from './client'
import type { QuickCommand, FileAttachment } from '../types/chat'

export async function fetchQuickCommands(): Promise<QuickCommand[]> {
  return client.get('/chat/quick-commands')
}

// ── 文件上传 ──────────────────────────────────────────────

export async function uploadFile(file: File): Promise<FileAttachment> {
  const formData = new FormData()
  formData.append('file', file)

  const token = localStorage.getItem('agentforge_token') || ''
  const response = await fetch('/api/v1/chat/upload', {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: `上传失败 (${response.status})` }))
    throw new Error(err.message || `上传失败: ${response.status}`)
  }

  return response.json()
}

// ── 消息反馈（投票） ──────────────────────────────────────

export async function submitFeedback(
  messageId: string,
  sessionId: string,
  rating: 'up' | 'down',
  reason?: string,
): Promise<void> {
  await client.post(`/chat/messages/${messageId}/feedback`, {
    session_id: sessionId,
    rating,
    reason: reason || '',
  })
}

export async function deleteFeedback(
  messageId: string,
  sessionId: string,
): Promise<void> {
  await client.delete(`/chat/messages/${messageId}/feedback?session_id=${sessionId}`)
}

export interface MessageFeedback {
  message_id: string
  rating: 'up' | 'down'
  reason: string
  created_at: string
}

export async function fetchSessionFeedbacks(sessionId: string): Promise<MessageFeedback[]> {
  return client.get(`/chat/sessions/${sessionId}/feedbacks`)
}

// ── SSE 流式聊天 ──────────────────────────────────────────

export interface HeartbeatCreatedData {
  id: string
  name: string
  cron: string
  description: string
  agent_id: string
  instruction: string
}

export interface ToolStartData {
  tool: string
  input: Record<string, unknown>
}

export interface ToolResultData {
  tool: string
  result: string
}

// ── 多Agent步骤事件数据 ──

export interface PlanReadyData {
  mission_id: string
  plan_source: string
  steps: Array<{
    step_id: string
    step_index: number
    agent_id: string
    agent_name: string
    instruction: string
  }>
}

export interface StepStartData {
  step_id: string
  step_index: number
  total_steps: number
  agent_id: string
  agent_name: string
  model?: string
  instruction: string
}

export interface StepDeltaData {
  step_id: string
  content: string
}

export interface StepToolStartData {
  step_id: string
  tool: string
  input: Record<string, unknown>
}

export interface StepToolResultData {
  step_id: string
  tool: string
  result: string
}

export interface StepDoneData {
  step_id: string
  step_index: number
  agent_id: string
  agent_name: string
  content: string
  tokens_used: number
  model: string
  duration_ms: number
  quality_score?: number
  error?: boolean
}

export interface StepReflectData {
  step_id: string
  decision: string
  feedback: string
  quality_score?: number
}

export interface DagApprovalData {
  waiting_nodes: string[]
  approval_requests: Array<{
    id: string
    node_id: string
    summary: string
    agent_name: string
    deliverables: string[]
  }>
}

export interface HumanInputData {
  node_id: string
  mission_id: string
  input_schema: Array<{
    name: string
    type: 'text' | 'number' | 'select' | 'textarea'
    label: string
    required: boolean
    options?: string[]
    default?: string
  }>
  input_prompt: string
}

// ── Solo 模式结构化事件数据 ──

export interface ReasoningData {
  content: string
  phase?: string
}

export interface SoloPlanData {
  content: string
}

export interface SoloThinkingData {
  content: string
}

export interface FileCardData {
  filename: string
  url: string
  size: number
  type: string
}

// ── 流式回调 ──

export interface StreamCallbacks {
  onThinking: (data: { agent_id: string; agent_name: string; model: string; chat_mode?: boolean }) => void
  onDelta: (content: string) => void
  onDone: (data: { mission_id: string; agent_id: string; agent_name: string; model: string; tokens_used: number; duration_ms: number }) => void
  onError: (message: string) => void
  onHeartbeatCreated?: (data: HeartbeatCreatedData) => void
  onToolStart?: (data: ToolStartData) => void
  onToolResult?: (data: ToolResultData) => void
  /** 深度推理事件 */
  onReasoning?: (data: ReasoningData) => void
  /** Solo 模式结构化事件 */
  onSoloPlan?: (data: SoloPlanData) => void
  onSoloThinking?: (data: SoloThinkingData) => void
  onFileCard?: (data: FileCardData) => void
  /** 多Agent步骤事件 */
  onPlanReady?: (data: PlanReadyData) => void
  onStepStart?: (data: StepStartData) => void
  onStepDelta?: (data: StepDeltaData) => void
  onStepToolStart?: (data: StepToolStartData) => void
  onStepToolResult?: (data: StepToolResultData) => void
  onStepDone?: (data: StepDoneData) => void
  onStepReflect?: (data: StepReflectData) => void
  /** DAG 审批事件 */
  onDagApproval?: (data: DagApprovalData) => void
  /** DAG 人工输入事件 */
  onHumanInput?: (data: HumanInputData) => void
  /** V7.3: 工位工具操作完成事件 */
  onWorkstationAction?: (data: { tool: string; result: string }) => void
}

export function streamMessage(
  content: string,
  callbacks: StreamCallbacks,
  targetAgent?: string,
  attachments?: string[],
  sessionId?: string,
  webSearch?: boolean,
): AbortController {
  const controller = new AbortController()
  const token = localStorage.getItem('agentforge_token') || ''

  fetch('/api/v1/chat/stream', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      content,
      agent_id: targetAgent,
      ...(attachments?.length ? { attachments } : {}),
      ...(sessionId ? { session_id: sessionId } : {}),
      ...(webSearch ? { web_search: true } : {}),
    }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const statusText = response.status === 401 ? '未授权，请重新登录'
          : response.status === 503 ? '服务暂时不可用，请稍后重试'
          : response.status >= 500 ? `服务器错误 (${response.status})`
          : `请求失败 (${response.status})`
        callbacks.onError(statusText)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        callbacks.onError('No response body')
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''
      const STREAM_TIMEOUT_MS = 60_000 // 60s no data → timeout
      let lastDataTime = Date.now()
      const timeoutChecker = setInterval(() => {
        if (Date.now() - lastDataTime > STREAM_TIMEOUT_MS) {
          clearInterval(timeoutChecker)
          controller.abort()
          callbacks.onError('响应超时，服务器长时间无数据返回')
        }
      }, 5000)

      try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        lastDataTime = Date.now()
        buffer += decoder.decode(value, { stream: true })

        // Parse SSE events from buffer
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        let currentEventType = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEventType = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            const dataStr = line.slice(6)
            try {
              const data = JSON.parse(dataStr)
              switch (currentEventType || data.event) {
                case 'thinking':
                  callbacks.onThinking(data)
                  break
                case 'delta':
                  callbacks.onDelta(data.content || '')
                  break
                case 'tool_start':
                  callbacks.onToolStart?.(data)
                  break
                case 'tool_result':
                  callbacks.onToolResult?.(data)
                  // V7.3: 工位工具执行完成 → 通知前端刷新工位数据
                  if (data.tool && [
                    'manage_schedule', 'manage_priority', 'manage_followup',
                    'manage_work_item', 'create_scheduled_task',
                  ].includes(data.tool)) {
                    callbacks.onWorkstationAction?.({ tool: data.tool, result: data.result })
                  }
                  break
                case 'heartbeat_created':
                  callbacks.onHeartbeatCreated?.(data.heartbeat || data)
                  break
                case 'done':
                  callbacks.onDone(data)
                  break
                case 'error':
                  callbacks.onError(data.content || 'Unknown error')
                  break
                // ── 深度推理事件 ──
                case 'reasoning':
                  callbacks.onReasoning?.(data)
                  break
                // ── Solo 模式结构化事件 ──
                case 'solo_plan':
                  callbacks.onSoloPlan?.(data)
                  break
                case 'solo_thinking':
                  callbacks.onSoloThinking?.(data)
                  break
                case 'file_card':
                  callbacks.onFileCard?.(data)
                  break
                // ── 多Agent步骤事件 ──
                case 'plan_ready':
                  callbacks.onPlanReady?.(data)
                  break
                case 'step_start':
                  callbacks.onStepStart?.(data)
                  break
                case 'step_delta':
                  callbacks.onStepDelta?.(data)
                  break
                case 'step_tool_start':
                  callbacks.onStepToolStart?.(data)
                  break
                case 'step_tool_result':
                  callbacks.onStepToolResult?.(data)
                  break
                case 'step_done':
                  callbacks.onStepDone?.(data)
                  break
                case 'step_reflect':
                  callbacks.onStepReflect?.(data)
                  break
                // ── DAG 审批事件 ──
                case 'dag_approval':
                  callbacks.onDagApproval?.(data)
                  break
                // ── DAG 人工输入事件 ──
                case 'dag_human_input':
                  callbacks.onHumanInput?.(data)
                  break
              }
            } catch {
              // Skip malformed JSON
            }
            currentEventType = ''
          }
        }
      }
      } finally {
        clearInterval(timeoutChecker)
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        const msg = !navigator.onLine ? '网络连接已断开，请检查网络后重试'
          : err.message?.includes('Failed to fetch') ? '无法连接服务器，请确认后端服务是否启动'
          : err.message || '连接失败'
        callbacks.onError(msg)
      }
    })

  return controller
}
