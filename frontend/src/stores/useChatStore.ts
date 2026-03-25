import { create } from 'zustand'
import { getSessions, getSessionMessages, deleteSession, generateTitle } from '../api/chat'

interface ToolCall { type: 'tool_start' | 'tool_result'; name: string; input?: any; result?: string }
interface Attachment { file_id: string; filename: string; extracted_text?: string }

interface Message {
  id?: string; role: 'user' | 'assistant'; content: string
  tool_calls?: ToolCall[]; attachments?: Attachment[]
  model?: string; tokens_used?: number; duration_ms?: number
}

interface Session { id: string; title: string; position_id: string; updated_at: number }

interface ChatState {
  sessions: Session[]; currentSessionId: string; loadingSessions: boolean
  messages: Message[]; streaming: boolean; abortController: AbortController | null
  loadSessions: () => Promise<void>; selectSession: (id: string) => Promise<void>
  newSession: () => void; removeSession: (id: string) => Promise<void>
  setSessionId: (id: string) => void; generateTitle: () => Promise<void>
  addUserMessage: (content: string, attachments?: Attachment[]) => void
  startAssistant: () => void; appendDelta: (text: string) => void
  addToolCall: (tc: ToolCall) => void
  finishAssistant: (meta?: { model?: string; tokens_used?: number; duration_ms?: number }) => void
  setStreaming: (v: boolean) => void; setAbortController: (c: AbortController | null) => void
  regenerate: () => string | null
}

export type { ToolCall, Attachment, Message }

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [], currentSessionId: '', loadingSessions: false,
  messages: [], streaming: false, abortController: null,

  loadSessions: async () => {
    set({ loadingSessions: true })
    try {
      const data = await getSessions()
      set({ sessions: (Array.isArray(data) ? data : []).map((s: any) => ({
        id: s.id || s.session_id, title: s.title || '新对话',
        position_id: s.position_id || s.agent_id || '', updated_at: s.updated_at || 0,
      })), loadingSessions: false })
    } catch { set({ loadingSessions: false }) }
  },

  selectSession: async (sessionId) => {
    set({ currentSessionId: sessionId, messages: [] })
    try {
      const data = await getSessionMessages(sessionId)
      set({ messages: (Array.isArray(data) ? data : []).map((m: any) => ({
        id: m.id, role: m.role, content: m.content, model: m.model, tokens_used: m.tokens_used,
      })) })
    } catch {}
  },

  newSession: () => set({ currentSessionId: '', messages: [] }),

  removeSession: async (sessionId) => {
    try {
      await deleteSession(sessionId)
      const { sessions, currentSessionId } = get()
      set({ sessions: sessions.filter(s => s.id !== sessionId) })
      if (currentSessionId === sessionId) set({ currentSessionId: '', messages: [] })
    } catch {}
  },

  setSessionId: (id) => set((s) => {
    if (!id) return { currentSessionId: id }
    const exists = s.sessions.some(sess => sess.id === id)
    if (!exists) return { currentSessionId: id, sessions: [{ id, title: '新对话', position_id: '', updated_at: Date.now() / 1000 }, ...s.sessions] }
    return { currentSessionId: id }
  }),

  generateTitle: async () => {
    const { currentSessionId } = get()
    if (!currentSessionId) return
    try {
      const data = await generateTitle(currentSessionId)
      set((s) => ({ sessions: s.sessions.map(sess => sess.id === currentSessionId ? { ...sess, title: data.title || '新对话' } : sess) }))
    } catch {}
  },

  addUserMessage: (content, attachments) => set((s) => ({
    messages: [...s.messages, { role: 'user', content, attachments }],
  })),
  startAssistant: () => set((s) => ({ messages: [...s.messages, { role: 'assistant', content: '', tool_calls: [] }] })),
  appendDelta: (text) => set((s) => {
    const msgs = [...s.messages]; const last = msgs[msgs.length - 1]
    if (last?.role === 'assistant') msgs[msgs.length - 1] = { ...last, content: last.content + text }
    return { messages: msgs }
  }),
  addToolCall: (tc) => set((s) => {
    const msgs = [...s.messages]; const last = msgs[msgs.length - 1]
    if (last?.role === 'assistant') msgs[msgs.length - 1] = { ...last, tool_calls: [...(last.tool_calls || []), tc] }
    return { messages: msgs }
  }),
  finishAssistant: (meta) => set((s) => {
    if (!meta) return {}
    const msgs = [...s.messages]; const last = msgs[msgs.length - 1]
    if (last?.role === 'assistant') msgs[msgs.length - 1] = { ...last, ...meta }
    return { messages: msgs }
  }),
  setStreaming: (v) => set({ streaming: v }),
  setAbortController: (c) => set({ abortController: c }),

  regenerate: () => {
    const { messages } = get()
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        set({ messages: messages.slice(0, i) })
        return messages[i].content
      }
    }
    return null
  },
}))
