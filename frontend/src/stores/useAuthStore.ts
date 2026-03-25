import { create } from 'zustand'
import { login as apiLogin, getMe, logout as apiLogout, register as apiRegister } from '../api/auth'

interface User { id: string; username: string; role: string; display_name?: string; org_id?: string; active_position?: string }

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  setActivePosition: (positionId: string) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  loading: true,

  login: async (username, password) => {
    const data = await apiLogin(username, password)
    if (data.token) localStorage.setItem('agentforge_token', data.token)
    set({ user: data.user, isAuthenticated: true })
  },

  register: async (username, password) => {
    await apiRegister(username, password)
  },

  logout: async () => {
    try { await apiLogout() } catch {}
    localStorage.removeItem('agentforge_token')
    set({ user: null, isAuthenticated: false })
  },

  setActivePosition: (positionId) => set((s) => ({
    user: s.user ? { ...s.user, active_position: positionId } : null,
  })),

  checkAuth: async () => {
    try {
      const token = localStorage.getItem('agentforge_token')
      if (!token) { set({ loading: false }); return }
      const data = await getMe()
      if (data.authenticated !== false && data.id) {
        set({ user: data, isAuthenticated: true, loading: false })
      } else {
        set({ loading: false })
      }
    } catch {
      set({ loading: false })
    }
  },
}))
