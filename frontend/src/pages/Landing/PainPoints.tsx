import { Clock, AlertTriangle, TrendingDown, Eye } from 'lucide-react'
import ScrollReveal from './ScrollReveal'

const PAINS = [
  {
    icon: Clock,
    title: '重复工作吞噬时间',
    desc: '写日报、整数据、催审批 — 60% 的时间花在低价值事务上，真正该思考的战略决策反而没空做',
    solve: 'AI 自动生成报告、处理审批、执行工作流，把时间还给高价值工作',
  },
  {
    icon: Eye,
    title: '风险总是后知后觉',
    desc: '项目延期、指标异常、关键人员变动 — 等你发现的时候，已经错过最佳干预窗口',
    solve: 'AI 持续扫描 9 个风险维度，在问题恶化前主动预警，让你从救火变为防火',
  },
  {
    icon: AlertTriangle,
    title: '信息分散难以决策',
    desc: '数据在表格里、知识在文档中、进度在聊天记录里 — 做一个决策要翻五个系统',
    solve: 'AI 洞察面板将审批、风险、指标、趋势汇聚一处，每条都附带行动建议',
  },
  {
    icon: TrendingDown,
    title: '经验无法沉淀复用',
    desc: '好的工作方法停留在个人脑中，换个人就从零开始，团队能力无法累积',
    solve: 'AI 自动学习你的偏好和工作模式，形成可复用的岗位知识体系',
  },
]

export default function PainPoints() {
  return (
    <section className="bg-[#0A0F14] py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-4">
        <ScrollReveal>
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center">
            这些场景，是不是似曾相识？
          </h2>
          <p className="text-[#718096] text-center mt-4 text-lg">
            不是你不够努力，是工作方式该升级了
          </p>
        </ScrollReveal>

        <div className="grid md:grid-cols-2 gap-6 mt-14">
          {PAINS.map((pain, i) => (
            <ScrollReveal key={pain.title} delay={i * 0.12}>
              <div className="relative p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-[#4ECDC4]/20 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mb-5">
                  <pain.icon size={24} className="text-red-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{pain.title}</h3>
                <p className="text-[#A0AEC0] text-sm leading-relaxed">{pain.desc}</p>
                <div className="mt-5 pt-4 border-t border-white/[0.06]">
                  <p className="text-sm text-[#4ECDC4] leading-relaxed">{pain.solve}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
