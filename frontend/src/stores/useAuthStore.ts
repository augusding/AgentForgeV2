import { create } from 'zustand'
import client from '../api/client'

interface User {
  id: string
  username: string
  display_name?: string
  role: string
  must_change_password?: boolean
  plan?: 'trial' | 'starter' | 'pro' | 'enterprise' | 'free'
  trial_expires_at?: string
  trial_remaining_days?: number
  onboarded?: boolean
  org_id?: string
  org_role?: 'owner' | 'admin' | 'member'
  org_name?: string
  has_profile?: boolean
}

interface RegisterOrgData {
  org_name: string
  contact_name: string
  contact_phone: string
  contact_email?: string
  industry?: string
  sub_industry?: string
  username: string
  password: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  loading: boolean

  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  clearMustChangePassword: () => void
  register: (data: { username: string; phone: string; code: string; password: string }) => Promise<void>
  registerOrg: (data: RegisterOrgData) => Promise<void>
  sendCode: (phone: string, purpose?: string) => Promise<{ success: boolean; expires_in: number }>
  markOnboarded: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  loading: true,

  login: async (username: string, password: string) => {
    const res = await client.post('/auth/login', { username, password })
    const data = res as any
    // 后端同时设置了 httpOnly cookie，前端也存 token 作为 Bearer 备用
    if (data.token) {
      localStorage.setItem('agentforge_token', data.token)
    }
    const user = data.user || {}
    set({
      user: {
        ...user,
        org_id: data.org_id || user.org_id,
        org_role: data.org_role || user.org_role,
        org_name: data.org_name || user.org_name,
        has_profile: data.has_profile ?? user.has_profile,
      },
      isAuthenticated: true,
    })
  },

  logout: async () => {
    try {
      await client.post('/auth/logout')
    } catch {
      // 忽略
    }
    localStorage.removeItem('agentforge_token')
    // 清除聊天数据，防止切换账号时消息串号
    localStorage.removeItem('agentforge_chat_messages')
    localStorage.removeItem('agentforge_chat_session_id')
    set({ user: null, isAuthenticated: false })
  },

  checkAuth: async () => {
    try {
      const res = await client.get('/auth/me', { _silent: true } as any) as any
      set({
        user: {
          id: res.id,
          username: res.username,
          role: res.role,
          must_change_password: res.must_change_password,
          plan: res.plan,
          trial_expires_at: res.trial_expires_at,
          trial_remaining_days: res.trial_remaining_days,
          onboarded: res.onboarded,
          org_id: res.org_id,
          org_role: res.org_role,
          org_name: res.org_name,
          has_profile: res.has_profile,
        },
        isAuthenticated: true,
        loading: false,
      })
    } catch {
      set({ user: null, isAuthenticated: false, loading: false })
    }
  },

  clearMustChangePassword: () => {
    set(state => ({
      user: state.user ? { ...state.user, must_change_password: false } : null,
    }))
  },

  register: async (data) => {
    const res = await client.post('/auth/register', data) as any
    if (res.token) {
      localStorage.setItem('agentforge_token', res.token)
    }
    const user = res.user || {}
    set({
      user: {
        ...user,
        org_id: res.org_id || user.org_id,
        org_role: res.org_role || user.org_role,
        org_name: res.org_name || user.org_name,
        has_profile: res.has_profile ?? user.has_profile,
      },
      isAuthenticated: true,
    })
  },

  registerOrg: async (data: RegisterOrgData) => {
    const res = await client.post('/auth/register-org', data) as any
    if (res.token) {
      localStorage.setItem('agentforge_token', res.token)
    }
    const user = res.user || {}
    set({
      user: {
        ...user,
        org_id: res.org_id || user.org_id,
        org_role: res.org_role || user.org_role,
        org_name: res.org_name || user.org_name,
        has_profile: res.has_profile ?? user.has_profile,
      },
      isAuthenticated: true,
    })
  },

  sendCode: async (phone, purpose = 'register') => {
    const res = await client.post('/auth/send-code', { phone, purpose }) as any
    return { success: res.success, expires_in: res.expires_in }
  },

  markOnboarded: async () => {
    await client.post('/auth/onboarding-complete')
    set(state => ({
      user: state.user ? { ...state.user, onboarded: true } : null,
    }))
  },
}))
