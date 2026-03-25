import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { TokenTrendData } from '../../types/stats'
import { formatTokenCount } from '../../utils/formatToken'

interface Props {
  data: TokenTrendData[]
}

export default function TokenTrend({ data }: Props) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <h3 className="text-sm font-semibold text-text mb-4">Token 消耗趋势</h3>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4ECDC4" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#4ECDC4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            tickFormatter={(v: string) => v.slice(5)}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            tickFormatter={(v: number) => formatTokenCount(v)}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
            formatter={(v: number) => [formatTokenCount(v), 'Tokens']}
            labelFormatter={(l: string) => l}
          />
          <Area
            type="monotone"
            dataKey="tokens"
            stroke="#4ECDC4"
            strokeWidth={2}
            fill="url(#tokenGradient)"
            dot={{ r: 3, fill: '#4ECDC4', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#4ECDC4', strokeWidth: 2, stroke: '#fff' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
