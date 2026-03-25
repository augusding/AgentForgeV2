import { create } from 'zustand'
import type { ScenarioData, Scenario } from '../types/scenario'
import { fetchScenarios } from '../api/scenarios'

interface ScenarioState {
  data: ScenarioData | null
  loading: boolean
  error: string | null

  // 选中的场景（用于 launcher 面板）
  selectedScenario: Scenario | null
  // 当前正在执行的场景（用于 value report）
  activeExecution: Scenario | null
  // demo 模式（首次体验，Dashboard/Agent 列表展示示例数据）
  demoMode: boolean

  load: () => Promise<void>
  reset: () => void
  selectScenario: (scenario: Scenario | null) => void
  startExecution: (scenario: Scenario) => void
  finishExecution: () => void
  exitDemoMode: () => void
  isDemoMode: () => boolean
}

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  selectedScenario: null,
  activeExecution: null,
  demoMode: localStorage.getItem('agentforge_demo_dismissed') !== 'true',

  load: async () => {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const data = await fetchScenarios()
      set({ data, loading: false })
    } catch (e: any) {
      set({ loading: false, error: e?.message || 'Failed to load scenarios' })
    }
  },

  reset: () => set({ data: null, loading: false, error: null, selectedScenario: null }),

  selectScenario: (scenario) => set({ selectedScenario: scenario }),

  startExecution: (scenario) => set({ activeExecution: scenario, selectedScenario: null }),

  finishExecution: () => set({ activeExecution: null }),

  exitDemoMode: () => {
    localStorage.setItem('agentforge_demo_dismissed', 'true')
    set({ demoMode: false })
  },

  isDemoMode: () => get().demoMode,
}))
