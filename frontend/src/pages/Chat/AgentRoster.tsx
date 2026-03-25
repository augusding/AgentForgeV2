import { motion } from 'framer-motion'
import AgentAvatar from '../../components/AgentAvatar'
import type { StepState } from '../../types/chat'

interface Props {
  steps: StepState[]
}

/**
 * Agent 参与者概览 — 完成后展示参与 DAG 的各 Agent 汇总
 */
export default function AgentRoster({ steps }: Props) {
  // 按 agent_id 去重统计
  const agentMap = new Map<string, { name: string; count: number; doneCount: number }>()
  for (const step of steps) {
    const existing = agentMap.get(step.agent_id)
    if (existing) {
      existing.count++
      if (step.status === 'done') existing.doneCount++
    } else {
      agentMap.set(step.agent_id, {
        name: step.agent_name,
        count: 1,
        doneCount: step.status === 'done' ? 1 : 0,
      })
    }
  }

  const agents = Array.from(agentMap.entries())
  if (agents.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-wrap gap-2 mb-3 py-2"
    >
      {agents.map(([agentId, info]) => {
        const allDone = info.doneCount === info.count
        return (
          <div
            key={agentId}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition-all duration-300 ${
              allDone
                ? 'border-success/30 bg-success/5 text-success'
                : 'border-border bg-surface-hover/50 text-text-muted'
            }`}
          >
            <AgentAvatar agentId={agentId} name={info.name} size="sm" />
            <span className="font-medium">{info.name}</span>
            {info.count > 1 && (
              <span className="text-[10px] opacity-60">x{info.count}</span>
            )}
          </div>
        )
      })}
    </motion.div>
  )
}
