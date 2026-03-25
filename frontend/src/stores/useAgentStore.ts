import { create } from 'zustand'
import type { Agent, Squad } from '../types/agent'
import { fetchAgents, fetchSquads } from '../api/agents'
import { useScenarioStore } from './useScenarioStore'

interface AgentState {
  agents: Agent[]
  squads: Squad[]
  loading: boolean
  error: string | null

  load: () => Promise<void>
  updateStatus: (agentId: string, status: Agent['status']) => void
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  squads: [],
  loading: false,
  error: null,

  load: async () => {
    if (get().agents.length > 0) return
    set({ loading: true, error: null })
    try {
      const [agents, squads] = await Promise.all([fetchAgents(), fetchSquads()])

      // Demo data overlay: fill in today_tasks / quality_score from demo_stats
      const scenarioStore = useScenarioStore.getState()
      const demoStats = scenarioStore.data?.demo_stats
      const demoMode = scenarioStore.demoMode
      const isAllZero = agents.every(a => a.today_tasks === 0 && a.today_tokens === 0)

      if (isAllZero && demoMode && demoStats?.agents) {
        const demoAgentMap = new Map(demoStats.agents.map(da => [da.agent_id, da]))
        const overlayedAgents = agents.map(agent => {
          const demo = demoAgentMap.get(agent.id)
          if (demo) {
            return {
              ...agent,
              today_tasks: demo.missions_completed,
              today_tokens: demo.tokens_used,
              quality_score: demo.quality_score,
            }
          }
          return agent
        })
        set({ agents: overlayedAgents, squads, loading: false })
      } else {
        set({ agents, squads, loading: false })
      }
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  updateStatus: (agentId, status) => {
    set(state => ({
      agents: state.agents.map(a => a.id === agentId ? { ...a, status } : a),
    }))
  },
}))
