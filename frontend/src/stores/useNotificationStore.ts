import { create } from 'zustand'
import client from '../api/client'

export interface Notification {
  id: number
  user_id: string
  type: string
  title: string
  message: string
  read: number
  related_id: string
  created_at: string
}

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  panelOpen: boolean
  error: string | null

  load: () => Promise<void>
  markRead: (id: number) => Promise<void>
  markAllRead: () => Promise<void>
  togglePanel: () => void
  closePanel: () => void
  addFromWebSocket: (data: { title: string; message?: string; type?: string; unread_count?: number }) => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  panelOpen: false,
  error: null,

  load: async () => {
    try {
      const res = await client.get('/notifications') as any
      set({
        notifications: res.items || [],
        unreadCount: res.unread_count || 0,
        error: null,
      })
    } catch (e: any) {
      set({ error: e?.message || '加载通知失败' })
    }
  },

  markRead: async (id) => {
    try {
      await client.patch(`/notifications/${id}/read`)
      set(state => ({
        notifications: state.notifications.map(n =>
          n.id === id ? { ...n, read: 1 } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }))
    } catch {
      // ignore
    }
  },

  markAllRead: async () => {
    try {
      await client.post('/notifications/read-all')
      set(state => ({
        notifications: state.notifications.map(n => ({ ...n, read: 1 })),
        unreadCount: 0,
      }))
    } catch {
      // ignore
    }
  },

  togglePanel: () => {
    const { panelOpen } = get()
    if (!panelOpen) get().load()
    set({ panelOpen: !panelOpen })
  },

  closePanel: () => set({ panelOpen: false }),

  addFromWebSocket: (data) => {
    set(state => ({
      unreadCount: data.unread_count ?? state.unreadCount + 1,
    }))
    // If panel is open, reload
    if (get().panelOpen) get().load()
  },
}))
