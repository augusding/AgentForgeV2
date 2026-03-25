import { Quote } from 'lucide-react'
import ScrollReveal from './ScrollReveal'

const TESTIMONIALS = [
  {
    initial: '张',
    name: '张总',
    role: '某广告公司运营总监',
    quote: '以前项目风险都是出了事才知道，现在 AI 洞察提前两天就预警了交付延期风险，救了我们好几次',
    color: 'bg-blue-500',
  },
  {
    initial: '李',
    name: '李经理',
    role: '某科技公司项目经理',
    quote: '最惊喜的是越用越懂我 — 现在 AI 生成的周报格式、数据维度都完全符合我的习惯，几乎不用改',
    color: 'bg-purple-500',
  },
  {
    initial: '王',
    name: '王总监',
    role: '某集团数字化总监',
    quote: '14 个岗位各有专属 AI 搭档，知识库隔离、权限分级、审计追踪，完全满足企业合规要求',
    color: 'bg-emerald-500',
  },
]

export default function Testimonials() {
  return (
    <section className="bg-[#0A0F14] py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-4">
        <ScrollReveal>
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center">
            客户这样说
          </h2>
          <p className="text-[#718096] text-center mt-4 text-lg">
            来自不同行业客户的真实反馈
          </p>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-6 mt-14">
          {TESTIMONIALS.map((t, i) => (
            <ScrollReveal key={t.name} delay={i * 0.15}>
              <div className="p-8 rounded-2xl bg-white/[0.03] border border-white/[0.06] h-full flex flex-col">
                <Quote size={24} className="text-[#4ECDC4]/30 mb-4" />
                <p className="text-[#A0AEC0] text-sm leading-relaxed flex-1 italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3 mt-6 pt-6 border-t border-white/[0.06]">
                  <div className={`w-10 h-10 rounded-full ${t.color} flex items-center justify-center text-white text-sm font-bold`}>
                    {t.initial}
                  </div>
                  <div>
                    <div className="text-white text-sm font-medium">{t.name}</div>
                    <div className="text-[#718096] text-xs">{t.role}</div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
