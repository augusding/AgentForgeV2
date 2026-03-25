import { Briefcase, MessageSquare, TrendingUp } from 'lucide-react'
import ScrollReveal from './ScrollReveal'

const STEPS = [
  {
    num: '01',
    icon: Briefcase,
    title: '选择岗位，AI 即刻就位',
    desc: '选择你的岗位角色，AI 自动加载专属知识、工具和工作流。5 分钟完成配置，上传业务文档让 AI 更懂你。',
  },
  {
    num: '02',
    icon: MessageSquare,
    title: '对话即工作，AI 替你执行',
    desc: '用自然语言下达任务：生成报告、分析数据、执行工作流。AI 自动调用工具完成，你只需确认结果。',
  },
  {
    num: '03',
    icon: TrendingUp,
    title: '越用越聪明，洞察持续涌现',
    desc: 'AI 从你的工作模式中学习：自动发现风险、识别高优事项、推荐效率优化 — 从工具变为搭档。',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-[#0A0F14] py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-4">
        <ScrollReveal>
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center">
            3 步开启你的 AI 搭档
          </h2>
          <p className="text-[#718096] text-center mt-4 text-lg">
            从选岗到上手，最快 5 分钟
          </p>
        </ScrollReveal>

        <div className="relative mt-16">
          <div className="hidden md:block absolute top-[60px] left-[16.67%] right-[16.67%] h-px border-t-2 border-dashed border-white/10" />

          <div className="grid md:grid-cols-3 gap-10 md:gap-6">
            {STEPS.map((step, i) => (
              <ScrollReveal key={step.num} delay={i * 0.2}>
                <div className="relative text-center">
                  <div className="relative mx-auto w-[120px] h-[120px] rounded-full border-2 border-[#4ECDC4]/20 flex items-center justify-center bg-[#0A0F14]">
                    <div className="w-16 h-16 rounded-full bg-[#4ECDC4]/10 flex items-center justify-center">
                      <step.icon size={28} className="text-[#4ECDC4]" />
                    </div>
                    <span className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[#4ECDC4] text-[#0A0F14] text-xs font-bold flex items-center justify-center">
                      {step.num}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mt-6 mb-3">{step.title}</h3>
                  <p className="text-sm text-[#A0AEC0] leading-relaxed max-w-[280px] mx-auto">{step.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
