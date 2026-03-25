import { useEffect, useRef, useState } from 'react'
import wsClient from '../api/ws'
import { useChatStore } from '../stores/useChatStore'
import { useAgentStore } from '../stores/useAgentStore'
import { useMissionStore } from '../stores/useMissionStore'
import { useApprovalStore } from '../stores/useApprovalStore'
import { useStatsStore } from '../stores/useStatsStore'
import { useNotificationStore } from '../stores/useNotificationStore'
import toast from 'react-hot-toast'

export function useWebSocket() {
  const [connected, setConnected] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    wsClient.connect()

    const unsubs = [
      wsClient.on('_connected', () => {
        if (mounted.current) setConnected(true)
      }),
      wsClient.on('_disconnected', () => {
        if (mounted.current) setConnected(false)
      }),

      // Agent messages → chat store
      wsClient.on('agent_message', (data) => {
        useChatStore.getState().addMessage({
          id: `ws-${Date.now()}`,
          role: 'agent',
          agent_id: data.agent_id as string,
          agent_name: data.agent_name as string || data.agent_id as string,
          content: data.content as string,
          model_used: data.model as string,
          tokens_used: data.tokens as number,
          duration_ms: data.duration_ms as number,
          mission_id: data.mission_id as string,
          created_at: new Date().toISOString(),
        })
      }),

      // Agent status → agent store
      wsClient.on('agent_status', (data) => {
        useAgentStore.getState().updateStatus(
          data.agent_id as string,
          data.status as 'idle' | 'executing' | 'waiting',
        )
      }),

      // Mission progress → mission store
      wsClient.on('mission_progress', (data) => {
        useMissionStore.getState().updateProgress(
          data.mission_id as string,
          data.step as number,
          data.total as number,
          data.current_agent as string,
        )
      }),

      // Mission complete
      wsClient.on('mission_complete', (data) => {
        useMissionStore.getState().completeMission(data.mission_id as string)
        toast.success('Mission completed')
      }),

      // Approval required → approval store
      wsClient.on('approval_required', (data) => {
        useApprovalStore.getState().addApproval({
          id: data.id as string,
          mission_id: data.mission_id as string,
          step_id: data.step_id as string || '',
          agent_id: data.agent_id as string,
          agent_name: data.agent_name as string || data.agent_id as string,
          summary: data.summary as string,
          full_analysis: data.full_analysis as string || '',
          options: (data.options as any[]) || [],
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 3600_000).toISOString(),
          status: 'pending',
        })
        toast('New approval required', { icon: '⚠️' })
      }),

      // DAG node updates → mission store
      wsClient.on('dag_node_update', (data) => {
        useMissionStore.getState().updateDagState(
          data.mission_id as string,
          {
            mission_id: data.mission_id as string,
            event: data.event as string,
            node_id: data.node_id as string,
            status: data.status as string,
            duration: data.duration as number | undefined,
            quality_score: data.quality_score as number | undefined,
            error: data.error as string | undefined,
          },
        )
      }),

      // Token updates → stats store
      wsClient.on('token_update', (data) => {
        useStatsStore.getState().updateTokens(
          data.daily_total as number,
          data.mission_total as number,
        )
      }),

      // Notifications
      wsClient.on('notification', (data) => {
        useNotificationStore.getState().addFromWebSocket(data as any)
      }),

      // Errors
      wsClient.on('error', (data) => {
        toast.error(data.message as string || 'WebSocket error')
      }),
    ]

    return () => {
      mounted.current = false
      unsubs.forEach(fn => fn())
    }
  }, [])

  return { connected }
}
