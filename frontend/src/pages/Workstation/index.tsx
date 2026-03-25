/**
 * 我的工位 V6 — 多时间维度驾驶舱
 *
 * 布局：左侧65%（聚焦+AI洞察） | 右侧35%（工作动态）
 * AI洞察为核心亮点：实时扫描雷达，不受时间筛选影响
 * 全局时间切换器（今日/本周/本月）仅影响聚焦面板和工作动态
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Briefcase, Zap, ChevronRight, Calendar, CalendarDays, CalendarRange } from 'lucide-react'
import { useWorkstationStore } from '../../stores/useWorkstationStore'
import { useDailyContextStore } from '../../stores/useDailyContextStore'
import LoadingSpinner from '../../components/LoadingSpinner'
import PositionPicker from './PositionPicker'
import TodayFocus from './TodayFocus'
import LiveFeed from './LiveFeed'
import WorkstationAssistant from './WorkstationAssistant'
import type { TimeRange } from '../../types/workstation'

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, delay },
})

const TIME_TABS: { key: TimeRange; label: string; icon: typeof Calendar }[] = [
  { key: 'today', label: '今日', icon: Calendar },
  { key: 'week',  label: '本周', icon: CalendarDays },
  { key: 'month', label: '本月', icon: CalendarRange },
]

export default function Workstation() {
  const { home, loading, error, loadHome } = useWorkstationStore()
  const { load: loadContext } = useDailyContextStore()
  const navigate = useNavigate()
  const [timeRange, setTimeRange] = useState<TimeRange>('today')

  useEffect(() => { loadHome() }, [])

  useEffect(() => {
    if (home?.assigned) loadContext()
  }, [home?.assigned])

  if (loading && !home) return <LoadingSpinner fullPage label="加载工位中..." />
  if (!loading && (!home || !home.assigned)) return <PositionPicker />
  if (error && (!home || !home.assigned)) return <PositionPicker />
  if (!home) return null

  const { position, assistant = {} as any } = home

  // 防御性检查：position 为 null 时回退到岗位选择
  if (!position) return <PositionPicker />

  return (
    <div className="h-full flex flex-col p-4 max-w-[1440px] mx-auto">

      {/* Header — compact */}
      <motion.div {...fade()} className="flex items-center gap-3 mb-4 shrink-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${position?.color ?? '#3B82F6'}15` }}>
          <Briefcase size={16} style={{ color: position?.color ?? '#3B82F6' }} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-text leading-tight">{position?.display_name}</h1>
          {position?.description && (
            <p className="text-[11px] text-text-muted truncate">{position.description}</p>
          )}
        </div>

        {/* Time Range Switcher */}
        <div className="flex items-center bg-bg rounded-lg border border-border p-0.5 shrink-0">
          {TIME_TABS.map(tab => {
            const active = timeRange === tab.key
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setTimeRange(tab.key)}
                className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                  active
                    ? 'bg-surface text-accent shadow-sm border border-accent/20'
                    : 'text-text-muted hover:text-text border border-transparent'
                }`}
              >
                <Icon size={12} />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-text-muted">
            {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}
          </span>
          <button
            onClick={() => navigate('/workflows')}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-accent border border-accent/30 rounded-md hover:bg-accent/5 transition-colors"
          >
            <Zap size={11} /> 工作流 <ChevronRight size={10} />
          </button>
        </div>
      </motion.div>

      {/* Main content — 2-column layout */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">

        {/* Left column: 核心视角 — 聚焦 + AI 洞察 (65%) */}
        <div className="flex-[65] flex flex-col gap-4 min-w-0 overflow-y-auto">
          <motion.div {...fade(0.05)}>
            <TodayFocus timeRange={timeRange} />
          </motion.div>

          <motion.div {...fade(0.1)} className="flex-1">
            <WorkstationAssistant
              positionName={position?.display_name ?? ''}
              positionId={position?.position_id ?? ''}
              personality={assistant.personality || ''}
            />
          </motion.div>
        </div>

        {/* Right column: 信息流 — 工作动态 (35%) */}
        <motion.div {...fade(0.08)} className="flex-[35] min-w-[280px] max-w-[380px]">
          <LiveFeed timeRange={timeRange} />
        </motion.div>
      </div>
    </div>
  )
}
