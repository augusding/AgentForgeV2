/**
 * Cross-Agent Collaboration Heatmap and insights panel.
 * Renders an SVG matrix showing collaboration frequency between agents.
 */
import { useEffect, useState } from 'react'
import { Users, AlertTriangle, Lightbulb, Clock } from 'lucide-react'
import {
  fetchCollaborationMatrix,
  fetchBottleneckAgents,
  fetchCollaborationSuggestions,
} from '../../api/collaboration'
import type {
  CollaborationMatrix,
  BottleneckAgent,
  CollaborationSuggestion,
} from '../../types/collaboration'

const CELL_SIZE = 40
const LABEL_WIDTH = 80

function HeatmapCell({ value, maxValue, x, y }: { value: number; maxValue: number; x: number; y: number }) {
  const intensity = maxValue > 0 ? value / maxValue : 0
  // Green gradient: transparent → emerald
  const color = value === 0
    ? 'rgba(107, 114, 128, 0.1)'
    : `rgba(34, 197, 94, ${0.15 + intensity * 0.7})`

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={CELL_SIZE}
        height={CELL_SIZE}
        fill={color}
        rx={4}
        className="transition-all duration-200"
      />
      {value > 0 && (
        <text
          x={x + CELL_SIZE / 2}
          y={y + CELL_SIZE / 2 + 4}
          textAnchor="middle"
          className="fill-text text-[11px] font-medium"
        >
          {value}
        </text>
      )}
      <title>{`${value} shared missions`}</title>
    </g>
  )
}

function Heatmap({ data }: { data: CollaborationMatrix }) {
  const { agents, matrix } = data
  const n = agents.length
  if (n === 0) return <p className="text-xs text-text-muted py-4 text-center">No collaboration data yet.</p>

  const maxValue = Math.max(...matrix.flat(), 1)
  const svgWidth = LABEL_WIDTH + n * CELL_SIZE + 10
  const svgHeight = LABEL_WIDTH + n * CELL_SIZE + 10

  return (
    <svg width={svgWidth} height={svgHeight} className="mx-auto">
      {/* Column labels (top) */}
      {agents.map((a, i) => (
        <text
          key={`col-${a}`}
          x={LABEL_WIDTH + i * CELL_SIZE + CELL_SIZE / 2}
          y={LABEL_WIDTH - 8}
          textAnchor="end"
          transform={`rotate(-45, ${LABEL_WIDTH + i * CELL_SIZE + CELL_SIZE / 2}, ${LABEL_WIDTH - 8})`}
          className="fill-text-muted text-[10px]"
        >
          {a.length > 10 ? a.slice(0, 10) + '..' : a}
        </text>
      ))}

      {/* Row labels + cells */}
      {agents.map((rowAgent, ri) => (
        <g key={`row-${rowAgent}`}>
          <text
            x={LABEL_WIDTH - 6}
            y={LABEL_WIDTH + ri * CELL_SIZE + CELL_SIZE / 2 + 4}
            textAnchor="end"
            className="fill-text-muted text-[10px]"
          >
            {rowAgent.length > 10 ? rowAgent.slice(0, 10) + '..' : rowAgent}
          </text>
          {agents.map((_colAgent, ci) => (
            <HeatmapCell
              key={`${ri}-${ci}`}
              value={matrix[ri][ci]}
              maxValue={maxValue}
              x={LABEL_WIDTH + ci * CELL_SIZE}
              y={LABEL_WIDTH + ri * CELL_SIZE}
            />
          ))}
        </g>
      ))}
    </svg>
  )
}

export default function CollaborationMap() {
  const [matrix, setMatrix] = useState<CollaborationMatrix | null>(null)
  const [bottlenecks, setBottlenecks] = useState<BottleneckAgent[]>([])
  const [suggestions, setSuggestions] = useState<CollaborationSuggestion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetchCollaborationMatrix().catch(() => ({ agents: [], matrix: [] })),
      fetchBottleneckAgents().catch(() => []),
      fetchCollaborationSuggestions().catch(() => []),
    ]).then(([m, b, s]) => {
      setMatrix(m)
      setBottlenecks(b)
      setSuggestions(s)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-text mb-3 flex items-center gap-2">
          <Users size={16} className="text-accent" />
          Collaboration Analysis
        </h3>
        <div className="py-8 text-center text-xs text-text-muted">Loading...</div>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <h3 className="text-sm font-medium text-text mb-4 flex items-center gap-2">
        <Users size={16} className="text-accent" />
        Collaboration Analysis
      </h3>

      {/* Heatmap */}
      {matrix && matrix.agents.length > 0 ? (
        <div className="overflow-x-auto mb-4">
          <Heatmap data={matrix} />
        </div>
      ) : (
        <p className="text-xs text-text-muted py-4 text-center mb-4">
          No collaboration data yet. Run multi-agent missions to see patterns.
        </p>
      )}

      {/* Bottleneck agents */}
      {bottlenecks.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-medium text-text-muted mb-2 flex items-center gap-1.5">
            <Clock size={12} /> Execution Speed Ranking
          </h4>
          <div className="space-y-1.5">
            {bottlenecks.slice(0, 5).map((b) => (
              <div key={b.agent_id} className="flex items-center justify-between text-xs">
                <span className="text-text">{b.agent_id}</span>
                <div className="flex items-center gap-3 text-text-muted">
                  <span>{b.avg_duration.toFixed(1)}s avg</span>
                  <span>{b.total_tasks} tasks</span>
                  {b.avg_quality != null && (
                    <span className={b.avg_quality >= 7 ? 'text-success' : b.avg_quality >= 5 ? 'text-warning' : 'text-danger'}>
                      Q: {b.avg_quality.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-text-muted mb-2 flex items-center gap-1.5">
            <Lightbulb size={12} /> Insights
          </h4>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs p-2 rounded border border-border bg-bg"
              >
                {s.metric === 'quality_low' ? (
                  <AlertTriangle size={12} className="text-warning shrink-0 mt-0.5" />
                ) : (
                  <Lightbulb size={12} className="text-info shrink-0 mt-0.5" />
                )}
                <span className="text-text-secondary">{s.suggestion}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
