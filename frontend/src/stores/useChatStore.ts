import { create } from 'zustand'
import { flushSync } from 'react-dom'
import type { ChatMessage, StepState, FileAttachment } from '../types/chat'
import { streamMessage, submitFeedback, deleteFeedback, fetchSessionFeedbacks } from '../api/chat'
import type { MessageFeedback } from '../api/chat'
import { useApprovalStore } from './useApprovalStore'
import client from '../api/client'

const STORAGE_KEY = 'agentforge_chat_messages'
const SESSION_KEY = 'agentforge_chat_session_id'
const MAX_PERSISTED = 200

export interface ChatSession {
  session_id: string
  title: string
  message_count: number
  last_message_at: string
}

/** Load or create session ID */
function getOrCreateSessionId(): string {
  const existing = localStorage.getItem(SESSION_KEY)
  if (existing) return existing
  const newId = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  localStorage.setItem(SESSION_KEY, newId)
  return newId
}

/** Load messages from localStorage */
function loadPersistedMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Save messages to localStorage (skip streaming placeholders with empty content) */
function persistMessages(messages: ChatMessage[]) {
  try {
    const toSave = messages
      .filter(m => m.content.trim() !== '' || (m.steps && m.steps.length > 0) || (m.solo_tools && m.solo_tools.length > 0) || m.solo_plan)
      .slice(-MAX_PERSISTED)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch { /* quota exceeded — ignore */ }
}

interface ChatState {
  messages: ChatMessage[]
  responding: boolean
  /** ID of the streaming agent message being built */
  streamingMessageId: string | null
  /** Persistent session ID for conversation context */
  sessionId: string
  /** Session list from server */
  sessions: ChatSession[]
  /** Whether sessions are being loaded */
  sessionsLoading: boolean
  /** P2 Task 8: Session load error */
  sessionsError: string | null
  /** Message feedback map: messageId → rating */
  feedbacks: Record<string, 'up' | 'down'>

  send: (content: string, targetAgent?: string, attachments?: FileAttachment[], webSearch?: boolean) => void
  /** Retry sending after an error (re-sends the last user message) */
  retrySend: () => void
  addMessage: (msg: ChatMessage) => void
  updateMessage: (msgId: string, patch: Partial<ChatMessage>) => void
  clearMessages: () => void
  newSession: () => void
  toggleStepCollapse: (msgId: string, stepId: string) => void
  /** Load session list from server */
  loadSessions: () => Promise<void>
  /** Switch to a different session (loads its messages) */
  switchSession: (sessionId: string) => Promise<void>
  /** Delete a session */
  deleteSession: (sessionId: string) => Promise<void>
  /** Create a new empty session */
  createNewSession: () => void
  /** Auto-generate title via LLM */
  autoGenerateTitle: (sessionId: string) => Promise<void>
  /** Manually rename a session */
  renameSession: (sessionId: string, title: string) => Promise<void>
  /** Sync messages from server (recover after refresh) */
  syncFromServer: () => Promise<void>
  /** Submit or toggle message feedback */
  setFeedback: (messageId: string, rating: 'up' | 'down') => Promise<void>
  /** Load feedbacks for current session */
  loadFeedbacks: () => Promise<void>
}

/** Helper: immutably update a step inside a message's steps array */
function updateStep(
  messages: ChatMessage[],
  msgId: string,
  stepId: string,
  updater: (step: StepState) => StepState,
): ChatMessage[] {
  return messages.map(m => {
    if (m.id !== msgId || !m.steps) return m
    return {
      ...m,
      steps: m.steps.map(s => s.step_id === stepId ? updater(s) : s),
    }
  })
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: loadPersistedMessages(),
  responding: false,
  streamingMessageId: null,
  sessionId: getOrCreateSessionId(),
  sessions: [],
  sessionsLoading: false,
  sessionsError: null,
  feedbacks: {},

  send: (content, targetAgent, attachments, webSearch) => {
    const now = new Date().toISOString()

    // 1. Add user message optimistically
    const userMsgId = `user-${Date.now()}`
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content,
      created_at: now,
      attachments: attachments || undefined,
    }
    set(state => {
      const messages = [...state.messages, userMsg]
      persistMessages(messages)
      return { messages }
    })

    // 2. Prepare placeholder for agent response
    const agentMsgId = `stream-${Date.now()}`
    const agentMsg: ChatMessage = {
      id: agentMsgId,
      role: 'agent',
      content: '',
      created_at: now,
    }
    set(state => ({
      messages: [...state.messages, agentMsg],
      responding: true,
      streamingMessageId: agentMsgId,
    }))

    // 3. Start streaming (with session_id for conversation context)
    const { sessionId } = get()
    streamMessage(content, {
      onThinking: (data) => {
        get().updateMessage(agentMsgId, {
          agent_id: data.agent_id,
          agent_name: data.agent_name,
          model_used: data.model,
          chat_mode: data.chat_mode,
        })
      },
      onDelta: (chunk) => {
        flushSync(() => {
          set(state => ({
            messages: state.messages.map(m =>
              m.id === agentMsgId
                ? { ...m, content: m.content + chunk }
                : m
            ),
          }))
        })
      },
      onToolStart: (data) => {
        // Solo模式：存入结构化工具数组
        set(state => ({
          messages: state.messages.map(m => {
            if (m.id !== agentMsgId) return m
            return { ...m, solo_tools: [...(m.solo_tools || []),
              { tool: data.tool, input: data.input, status: 'running' as const }] }
          }),
        }))
      },
      onToolResult: (data) => {
        set(state => ({
          messages: state.messages.map(m => {
            if (m.id !== agentMsgId) return m
            return { ...m, solo_tools: (m.solo_tools || []).map(t =>
              t.tool === data.tool && t.status === 'running'
                ? { ...t, result: data.result, status: 'done' as const } : t
            )}
          }),
        }))
      },
      onHeartbeatCreated: (hb) => {
        const sysMsgId = `sys-hb-${Date.now()}`
        const sysMsg: ChatMessage = {
          id: sysMsgId,
          role: 'system',
          content: `已创建定时任务「${hb.name}」— ${hb.description} (cron: ${hb.cron})`,
          created_at: new Date().toISOString(),
        }
        set(state => {
          const messages = [...state.messages, sysMsg]
          persistMessages(messages)
          return { messages }
        })
      },

      // ── V7.3: 工位工具操作 → 刷新工位数据 ──
      onWorkstationAction: () => {
        // 延迟 500ms 刷新，确保后端事件已写入
        setTimeout(() => {
          try {
            const { useDailyContextStore } = require('./useDailyContextStore')
            useDailyContextStore.getState().load()
          } catch { /* store may not exist */ }
        }, 500)
      },

      // ── 深度推理事件 ──
      onReasoning: (data) => {
        set(state => ({
          messages: state.messages.map(m => {
            if (m.id !== agentMsgId) return m
            return {
              ...m,
              reasoning: (m.reasoning || '') + data.content,
              reasoning_phase: data.phase || '',
            }
          }),
        }))
      },

      // ── Solo 模式结构化事件处理 ──

      onSoloPlan: (data) => {
        get().updateMessage(agentMsgId, { solo_plan: data.content })
      },
      onSoloThinking: (data) => {
        set(state => ({
          messages: state.messages.map(m => {
            if (m.id !== agentMsgId) return m
            return { ...m, solo_thinking: [...(m.solo_thinking || []), data.content] }
          }),
        }))
      },
      onFileCard: (data) => {
        set(state => ({
          messages: state.messages.map(m => {
            if (m.id !== agentMsgId) return m
            return { ...m, solo_files: [...(m.solo_files || []),
              { filename: data.filename, url: data.url, preview_url: data.preview_url, size: data.size, type: data.type }] }
          }),
        }))
      },

      // ── 多Agent步骤事件处理 ──

      onPlanReady: (data) => {
        const steps: StepState[] = data.steps.map(s => ({
          step_id: s.step_id,
          step_index: s.step_index,
          agent_id: s.agent_id,
          agent_name: s.agent_name,
          instruction: s.instruction,
          status: 'pending' as const,
          content: '',
          tools: [],
          collapsed: true,  // 默认折叠，执行时展开
        }))
        get().updateMessage(agentMsgId, {
          steps,
          plan_source: data.plan_source,
          is_multi_agent: true,
          mission_id: data.mission_id,
        })
      },

      onStepStart: (data) => {
        // 渐进渲染: 按 step_index 延迟展开，避免批量事件瞬间刷新
        const delay = (data.step_index || 0) * 300
        const applyStart = () => {
          set(state => ({
            messages: state.messages.map(m => {
              if (m.id !== agentMsgId || !m.steps) return m
              return {
                ...m,
                steps: m.steps.map(s => {
                  if (s.step_id === data.step_id) {
                    return { ...s, status: 'running' as const, model: data.model, collapsed: false }
                  }
                  // 自动折叠已完成的步骤
                  if (s.status === 'done') {
                    return { ...s, collapsed: true }
                  }
                  return s
                }),
              }
            }),
          }))
        }
        if (delay > 0) {
          setTimeout(applyStart, delay)
        } else {
          applyStart()
        }
      },

      onStepDelta: (data) => {
        set(state => ({
          messages: updateStep(state.messages, agentMsgId, data.step_id, s => ({
            ...s,
            content: s.content + data.content,
          })),
        }))
      },

      onStepToolStart: (data) => {
        set(state => ({
          messages: updateStep(state.messages, agentMsgId, data.step_id, s => ({
            ...s,
            tools: [...s.tools, {
              tool: data.tool,
              input: data.input,
              status: 'running' as const,
            }],
          })),
        }))
      },

      onStepToolResult: (data) => {
        set(state => ({
          messages: updateStep(state.messages, agentMsgId, data.step_id, s => ({
            ...s,
            tools: s.tools.map(t =>
              t.tool === data.tool && t.status === 'running'
                ? { ...t, result: data.result, status: 'done' as const }
                : t
            ),
          })),
        }))
      },

      onStepDone: (data) => {
        // 渐进渲染: 略晚于 step_start 的延迟
        const delay = (data.step_index || 0) * 300 + 200
        const applyDone = () => {
          const hasError = !!data.error
          set(state => ({
            messages: updateStep(state.messages, agentMsgId, data.step_id, s => ({
              ...s,
              status: hasError ? 'error' as const : 'done' as const,
              content: data.content || s.content,
              tokens_used: data.tokens_used,
              duration_ms: data.duration_ms,
              quality_score: data.quality_score,
              collapsed: !hasError, // 出错时不折叠，方便查看
            })),
          }))
        }
        if (delay > 0) {
          setTimeout(applyDone, delay)
        } else {
          applyDone()
        }
      },

      onStepReflect: (_data) => {
        // 反思事件当前仅用于日志，暂不更新UI
      },

      onDagApproval: (data) => {
        // DAG 审批事件 — 直接注入审批数据到 store，同时刷新持久化列表
        const approvalStore = useApprovalStore.getState()
        for (const req of (data.approval_requests || [])) {
          approvalStore.addApproval({
            id: req.id,
            mission_id: '',
            step_id: req.node_id,
            agent_id: '',
            agent_name: req.agent_name || '',
            summary: req.summary || '',
            full_analysis: '',
            deliverables: req.deliverables as any,
            options: [
              { id: 'approve', label: '批准', icon: 'check', value: 'approve' },
              { id: 'reject', label: '拒绝', icon: 'x', value: 'reject' },
              { id: 'modify', label: '修改后批准', icon: 'edit', value: 'modify' },
            ],
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 86400000).toISOString(),
            status: 'pending',
          })
        }
        // 同步从后端刷新完整数据
        approvalStore.load()
      },

      onHumanInput: (data) => {
        // 将人工输入请求存入消息
        set(state => ({
          messages: state.messages.map(m => {
            if (m.id !== agentMsgId) return m
            return {
              ...m,
              human_inputs: [...(m.human_inputs || []), {
                node_id: data.node_id,
                mission_id: data.mission_id,
                input_schema: data.input_schema,
                input_prompt: data.input_prompt,
                status: 'pending' as const,
              }],
            }
          }),
        }))
      },

      onDone: (data) => {
        get().updateMessage(agentMsgId, {
          mission_id: data.mission_id,
          agent_id: data.agent_id,
          agent_name: data.agent_name,
          model_used: data.model,
          tokens_used: data.tokens_used,
          duration_ms: data.duration_ms,
          ...(data.citations?.length ? { citations: data.citations } : {}),
          ...(data.skill ? { skill: data.skill } : {}),
        })
        set(state => {
          persistMessages(state.messages)
          return { responding: false, streamingMessageId: null }
        })
        // Auto-generate title after first exchange, then refresh sessions
        const { sessionId, sessions } = get()
        const existing = sessions.find(s => s.session_id === sessionId)
        if (!existing || !existing.title || existing.title === '新对话' || existing.title === sessionId) {
          get().autoGenerateTitle(sessionId).finally(() => get().loadSessions())
        } else {
          setTimeout(() => get().loadSessions(), 500)
        }
      },
      onError: (message) => {
        get().updateMessage(agentMsgId, {
          content: `Error: ${message}`,
        })
        set(state => {
          persistMessages(state.messages)
          return { responding: false, streamingMessageId: null }
        })
      },
    }, targetAgent, attachments?.map(a => a.file_id), sessionId, webSearch)
  },

  retrySend: () => {
    const { messages, responding } = get()
    if (responding) return

    // Find last error message and the user message before it
    const lastError = [...messages].reverse().find(m => m.role === 'agent' && m.content.startsWith('Error:'))
    if (!lastError) return

    const errorIdx = messages.indexOf(lastError)
    // Find the user message right before the error
    let userMsg: ChatMessage | undefined
    for (let i = errorIdx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMsg = messages[i]
        break
      }
    }
    if (!userMsg) return

    // Remove the error message
    set(state => ({
      messages: state.messages.filter(m => m.id !== lastError.id),
    }))

    // Re-send the user message
    get().send(userMsg.content, userMsg.agent_id, userMsg.attachments)
  },

  addMessage: (msg) => {
    set(state => {
      const messages = [...state.messages, msg]
      persistMessages(messages)
      return { messages }
    })
  },

  updateMessage: (msgId, patch) => {
    set(state => ({
      messages: state.messages.map(m => m.id === msgId ? { ...m, ...patch } : m),
    }))
  },

  clearMessages: () => {
    localStorage.removeItem(STORAGE_KEY)
    // 清空消息时同时创建新会话
    const newId = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    localStorage.setItem(SESSION_KEY, newId)
    set({ messages: [], responding: false, streamingMessageId: null, sessionId: newId })
  },

  newSession: () => {
    const newId = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    localStorage.setItem(SESSION_KEY, newId)
    localStorage.removeItem(STORAGE_KEY)
    set({ messages: [], responding: false, streamingMessageId: null, sessionId: newId })
  },

  toggleStepCollapse: (msgId, stepId) => {
    set(state => ({
      messages: updateStep(state.messages, msgId, stepId, s => ({
        ...s,
        collapsed: !s.collapsed,
      })),
    }))
  },

  loadSessions: async () => {
    set({ sessionsLoading: true, sessionsError: null })
    try {
      const sessions = await client.get('/chat/sessions') as any as ChatSession[]
      set({ sessions, sessionsLoading: false })
    } catch (e: any) {
      set({ sessionsLoading: false, sessionsError: e?.message || '加载对话列表失败' })
    }
  },

  switchSession: async (targetSessionId) => {
    const { sessionId } = get()
    if (targetSessionId === sessionId) return

    // Save current messages before switching
    persistMessages(get().messages)

    // Update session ID
    localStorage.setItem(SESSION_KEY, targetSessionId)
    set({ sessionId: targetSessionId, messages: [], responding: false, streamingMessageId: null, feedbacks: {} })

    // Load messages from server
    try {
      const serverMessages = await client.get(`/chat/sessions/${targetSessionId}/messages`) as any as Array<{
        id: string; role: string; content: string; agent_id?: string; agent_name?: string; created_at: string
      }>
      const messages: ChatMessage[] = serverMessages.map(m => ({
        id: m.id,
        role: m.role as ChatMessage['role'],
        content: m.content,
        agent_id: m.agent_id || undefined,
        agent_name: m.agent_name || undefined,
        created_at: m.created_at,
      }))
      set({ messages })
      persistMessages(messages)
      // Load feedbacks for new session
      get().loadFeedbacks()
    } catch {
      // If server load fails, try localStorage
      localStorage.setItem(SESSION_KEY, targetSessionId)
      set({ messages: [] })
    }
  },

  deleteSession: async (targetSessionId) => {
    try {
      await client.delete(`/chat/sessions/${targetSessionId}`)
    } catch {
      // continue anyway
    }
    // If deleting current session, create new one
    const { sessionId } = get()
    if (targetSessionId === sessionId) {
      get().createNewSession()
    }
    // Refresh sessions list
    get().loadSessions()
  },

  createNewSession: () => {
    const newId = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    localStorage.setItem(SESSION_KEY, newId)
    localStorage.removeItem(STORAGE_KEY)
    set({ messages: [], responding: false, streamingMessageId: null, sessionId: newId, feedbacks: {} })
    // Refresh sessions list after a short delay (to let any pending writes finish)
    setTimeout(() => get().loadSessions(), 300)
  },

  autoGenerateTitle: async (targetSessionId) => {
    try {
      const res = await client.post(`/chat/sessions/${targetSessionId}/title`) as any
      if (res?.title) {
        set(state => ({
          sessions: state.sessions.map(s =>
            s.session_id === targetSessionId ? { ...s, title: res.title } : s
          ),
        }))
      }
    } catch {
      // ignore
    }
  },

  renameSession: async (targetSessionId, title) => {
    try {
      await client.patch(`/chat/sessions/${targetSessionId}/title`, { title })
      set(state => ({
        sessions: state.sessions.map(s =>
          s.session_id === targetSessionId ? { ...s, title } : s
        ),
      }))
    } catch {
      // ignore
    }
  },

  syncFromServer: async () => {
    const { sessionId, messages, responding } = get()
    // Don't sync while actively streaming
    if (responding) return

    try {
      const serverMessages = await client.get(`/chat/sessions/${sessionId}/messages`) as any as Array<{
        id: string; role: string; content: string; agent_id?: string; agent_name?: string; created_at: string
      }>
      if (!serverMessages || serverMessages.length === 0) return

      // Count completed user+agent pairs in localStorage vs server
      const localUserMsgs = messages.filter(m => m.role === 'user' && m.content.trim())
      const serverUserMsgs = serverMessages.filter(m => m.role === 'user')

      // If server has more messages, we missed some (e.g., refresh during task)
      if (serverMessages.length > messages.filter(m => m.content.trim()).length ||
          serverUserMsgs.length > localUserMsgs.length) {

        // Check if last local message is an error — replace with server data
        const lastLocal = messages[messages.length - 1]
        const hasError = lastLocal && lastLocal.role === 'agent' && lastLocal.content.startsWith('Error:')

        if (hasError || serverMessages.length > messages.filter(m => m.content.trim()).length) {
          // Merge: keep local structured data (steps, tools) but add missing server messages
          const merged: ChatMessage[] = serverMessages.map(m => ({
            id: m.id,
            role: m.role as ChatMessage['role'],
            content: m.content,
            agent_id: m.agent_id || undefined,
            agent_name: m.agent_name || undefined,
            created_at: m.created_at,
          }))
          set({ messages: merged })
          persistMessages(merged)
        }
      }
    } catch {
      // Server not reachable — keep local messages
    }
  },

  setFeedback: async (messageId, rating) => {
    const { sessionId, feedbacks } = get()
    const current = feedbacks[messageId]
    if (current === rating) {
      // Toggle off: same rating clicked again
      set({ feedbacks: { ...feedbacks, [messageId]: undefined as any } })
      // Clean up undefined
      const next = { ...feedbacks }
      delete next[messageId]
      set({ feedbacks: next })
      try { await deleteFeedback(messageId, sessionId) } catch { /* ignore */ }
    } else {
      // Set or switch rating
      set({ feedbacks: { ...feedbacks, [messageId]: rating } })
      try { await submitFeedback(messageId, sessionId, rating) } catch { /* ignore */ }
    }
  },

  loadFeedbacks: async () => {
    const { sessionId } = get()
    try {
      const list = await fetchSessionFeedbacks(sessionId)
      const map: Record<string, 'up' | 'down'> = {}
      for (const f of list) map[f.message_id] = f.rating
      set({ feedbacks: map })
    } catch { /* ignore */ }
  },
}))
