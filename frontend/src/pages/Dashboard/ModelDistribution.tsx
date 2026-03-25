import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import type { ModelDistribution as ModelDist } from '../../types/stats'
import { formatTokenCount, formatCost } from '../../utils/formatToken'

interface Props {
  data: ModelDist[]
}

const COLORS = ['#1E3A5F', '#3498DB', '#4ECDC4', '#8B5CF6', '#F39C12']

export default function ModelDistribution({ data }: Props) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <h3 className="text-sm font-semibold text-text mb-4">模型分布</h3>
      <div className="flex items-center gap-4">
        {/* Donut chart */}
        <div className="w-44 h-44 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="tokens_used"
                nameKey="model"
                cx="50%" cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
                formatter={(v: number, _name: string, props: any) => [
                  `${formatTokenCount(v)} (${formatCost(props.payload.cost)})`,
                  props.payload.model,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2.5">
          {data.map((item, i) => (
            <div key={item.model} className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text truncate">{item.model}</div>
                <div className="text-xs text-text-muted">
                  {formatTokenCount(item.tokens_used)} · {item.percentage}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
