import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { AgentRanking as AgentRank } from '../../types/stats'
import { formatTokenCount } from '../../utils/formatToken'
import { getAgentColor } from '../../utils/agentColors'

interface Props {
  data: AgentRank[]
}

export default function AgentRanking({ data }: Props) {
  const sorted = [...data].sort((a, b) => b.tokens_used - a.tokens_used)

  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <h3 className="text-sm font-semibold text-text mb-4">Agent Token 排行</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            tickFormatter={(v: number) => formatTokenCount(v)}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="agent_name"
            tick={{ fontSize: 12, fill: '#1A202C' }}
            width={80}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
            formatter={(v: number) => [formatTokenCount(v), 'Tokens']}
          />
          <Bar dataKey="tokens_used" radius={[0, 4, 4, 0]} barSize={22}>
            {sorted.map((entry) => (
              <Cell key={entry.agent_id} fill={getAgentColor(entry.agent_id)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
