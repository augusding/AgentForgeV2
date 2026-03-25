import { create } from 'zustand'

interface Message { role: 'user' | 'assistant'; content: string }

interface ChatState {
  messages: Message[]
  streaming: boolean
  addUserMessage: (content: string) => void
  startAssistant: () => void
  appendDelta: (text: string) => void
  setStreaming: (v: boolean) => void
  clear: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  streaming: false,

  addUserMessage: (content) => set((s) => ({
    messages: [...s.messages, { role: 'user', content }],
  })),

  startAssistant: () => set((s) => ({
    messages: [...s.messages, { role: 'assistant', content: '' }],
  })),

  appendDelta: (text) => set((s) => {
    const msgs = [...s.messages]
    const last = msgs[msgs.length - 1]
    if (last?.role === 'assistant') {
      msgs[msgs.length - 1] = { ...last, content: last.content + text }
    }
    return { messages: msgs }
  }),

  setStreaming: (v) => set({ streaming: v }),
  clear: () => set({ messages: [], streaming: false }),
}))
