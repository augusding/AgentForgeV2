import { useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Briefcase,
  Code,
  Megaphone,
  HeadphonesIcon,
  PenTool,
  TrendingUp,
  Shield,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useWorkstationStore } from '../../stores/useWorkstationStore'
import LoadingSpinner from '../../components/LoadingSpinner'

const ICON_MAP: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  code: Code,
  megaphone: Megaphone,
  headphones: HeadphonesIcon,
  pen: PenTool,
  'pen-tool': PenTool,
  trending: TrendingUp,
  'trending-up': TrendingUp,
  shield: Shield,
  users: Users,
}

function resolveIcon(name: string): LucideIcon {
  const key = name.toLowerCase().replace(/[-_\s]+/g, '-')
  return ICON_MAP[key] || Briefcase
}

export default function PositionPicker() {
  const { positions, loading, loadPositions, selectPosition } = useWorkstationStore()

  useEffect(() => {
    if (!positions.length) loadPositions()
  }, [])

  if (loading) {
    return <LoadingSpinner fullPage label="Loading positions..." />
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="max-w-3xl w-full px-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-10"
        >
          <h1 className="text-2xl font-bold text-text">选择您的工位</h1>
          <p className="text-sm text-text-muted mt-2">
            选择一个岗位以获取定制化的工作台、指标看板和快捷工作流
          </p>
        </motion.div>

        {positions.length === 0 && !loading && (
          <div className="text-center py-12 text-text-muted">
            <Briefcase size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">暂无可用岗位</p>
            <p className="text-xs mt-1">请联系管理员配置岗位模板</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {positions.map((pos, i) => {
            const Icon = resolveIcon(pos.icon)
            return (
              <motion.button
                key={pos.position_id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
                onClick={() => selectPosition(pos.position_id)}
                className="group text-left bg-surface border border-border rounded-xl p-6
                           hover:border-accent/50 hover:shadow-lg transition-all"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${pos.color}18` }}
                >
                  <Icon size={24} style={{ color: pos.color }} />
                </div>

                <h3 className="text-base font-semibold text-text group-hover:text-accent transition-colors">
                  {pos.display_name}
                </h3>

                <span className="inline-block mt-1.5 text-[11px] px-2 py-0.5 rounded-full bg-surface-hover text-text-muted">
                  {pos.department}
                </span>

                <p className="text-xs text-text-muted mt-3 line-clamp-3 leading-relaxed">
                  {pos.description}
                </p>
              </motion.button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
