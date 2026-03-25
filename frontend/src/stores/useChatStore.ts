import { create } from 'zustand'
import { getSessions, getSessionMessages, deleteSession } from '../api/chat'
import client from '../api/client'

interface ToolCall {
  type: 'tool_start' | 'tool_result'
  name: string
  input?: any
  result?: string
}

interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string
  tool_calls?: ToolCall[]
}

interface Session {
  id: string
  title: string
  position_id: string
  updated_at: number
}

interface ChatState {
  sessions: Session[]
  currentSessionId: string
  loadingSessions: boolean
  messages: Message[]
  streaming: boolean
  loadSessions: () => Promise<void>
  selectSession: (sessionId: string) => Promise<void>
  newSession: () => void
  removeSession: (sessionId: string) => Promise<void>
  addUserMessage: (content: string) => void
  startAssistant: () => void
  appendDelta: (text: string) => void
  addToolCall: (tc: ToolCall) => void
  setStreaming: (v: boolean) => void
  setSessionId: (id: string) => void
  generateTitle: () => Promise<void>
}

export type { ToolCall, Message }

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSessionId: '',
  loadingSessions: false,
  messages: [],
  streaming: false,

  loadSessions: async () => {
    set({ loadingSessions: true })
    try {
      const data = await getSessions()
      const list = Array.isArray(data) ? data : []
      set({
        sessions: list.map((s: any) => ({
          id: s.id || s.session_id, title: s.title || '新对话',
          position_id: s.position_id || s.agent_id || '', updated_at: s.updated_at || 0,
        })),
        loadingSessions: false,
      })
    } catch { set({ loadingSessions: false }) }
  },

  selectSession: async (sessionId) => {
    set({ currentSessionId: sessionId, messages: [] })
    try {
      const data = await getSessionMessages(sessionId)
      const msgs = Array.isArray(data) ? data : []
      set({ messages: msgs.map((m: any) => ({ id: m.id, role: m.role, content: m.content })) })
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

  addUserMessage: (content) => set((s) => ({
    messages: [...s.messages, { role: 'user', content }],
  })),

  startAssistant: () => set((s) => ({
    messages: [...s.messages, { role: 'assistant', content: '', tool_calls: [] }],
  })),

  appendDelta: (text) => set((s) => {
    const msgs = [...s.messages]
    const last = msgs[msgs.length - 1]
    if (last?.role === 'assistant') msgs[msgs.length - 1] = { ...last, content: last.content + text }
    return { messages: msgs }
  }),

  addToolCall: (tc) => set((s) => {
    const msgs = [...s.messages]
    const last = msgs[msgs.length - 1]
    if (last?.role === 'assistant') {
      msgs[msgs.length - 1] = { ...last, tool_calls: [...(last.tool_calls || []), tc] }
    }
    return { messages: msgs }
  }),

  setStreaming: (v) => set({ streaming: v }),

  setSessionId: (id) => set((s) => {
    const exists = s.sessions.some(sess => sess.id === id)
    if (!exists && id) {
      return {
        currentSessionId: id,
        sessions: [{ id, title: '新对话', position_id: '', updated_at: Date.now() / 1000 }, ...s.sessions],
      }
    }
    return { currentSessionId: id }
  }),

  generateTitle: async () => {
    const { currentSessionId } = get()
    if (!currentSessionId) return
    try {
      const data: any = await client.post(`/chat/sessions/${currentSessionId}/title`)
      const title = data.title || '新对话'
      set((s) => ({
        sessions: s.sessions.map(sess => sess.id === currentSessionId ? { ...sess, title } : sess),
      }))
    } catch {}
  },
}))
