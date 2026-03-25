import { create } from 'zustand'
import type { AppConfig, Profile, Workflow, Heartbeat } from '../types/config'
import { fetchConfig, switchProfile, fetchWorkflows, updateConfig } from '../api/config'
import { fetchHeartbeats } from '../api/heartbeats'

interface ConfigState {
  config: AppConfig | null
  workflows: Workflow[]
  heartbeats: Heartbeat[]
  loading: boolean

  load: () => Promise<void>
  patchConfig: (patch: Partial<AppConfig>) => Promise<void>
  switchProfile: (profileId: string) => Promise<void>
  loadWorkflows: () => Promise<void>
  loadHeartbeats: () => Promise<void>
  currentProfile: () => Profile | undefined
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: null,
  workflows: [],
  heartbeats: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    try {
      const config = await fetchConfig()
      set({ config, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  patchConfig: async (patch) => {
    await updateConfig(patch)
    // Reload config from server to get updated values
    const config = await fetchConfig()
    set({ config })
  },

  switchProfile: async (profileId) => {
    await switchProfile(profileId)
    set(state => ({
      config: state.config ? { ...state.config, current_profile_id: profileId } : null,
    }))
  },

  loadWorkflows: async () => {
    const workflows = await fetchWorkflows()
    set({ workflows })
  },

  loadHeartbeats: async () => {
    const heartbeats = await fetchHeartbeats()
    set({ heartbeats })
  },

  currentProfile: () => {
    const { config } = get()
    if (!config) return undefined
    return config.profiles.find(p => p.id === config.current_profile_id)
  },
}))
