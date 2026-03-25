import { useNavigate } from 'react-router-dom'
import { Check, Minus } from 'lucide-react'
import ScrollReveal from './ScrollReveal'

interface PlanFeature {
  label: string
  starter: string | boolean
  pro: string | boolean
  enterprise: string | boolean
}

const FEATURES: PlanFeature[] = [
  { label: 'Agent 数量', starter: '3 个', pro: '10 个', enterprise: '不限' },
  { label: '工作流', starter: '1 个', pro: '不限', enterprise: '不限 + 自定义' },
  { label: 'AI 模型', starter: '3 个基础模型', pro: '全部 9 大模型', enterprise: '全部 + 私有模型' },
  { label: '工具集成', starter: '基础工具包', pro: '全部 + MCP 市场', enterprise: '全部 + 私有工具' },
  { label: '数据存储', starter: '100MB', pro: '5GB', enterprise: '不限' },
  { label: '分析看板', starter: '基础统计', pro: '完整分析看板', enterprise: '高级分析 + API' },
  { label: '审批流程', starter: false, pro: '人机协同审批', enterprise: '自定义审批流' },
  { label: '技术支持', starter: '社区', pro: '优先响应', enterprise: '专属顾问' },
  { label: '部署方式', starter: '共享云', pro: '独享云', enterprise: '私有化部署' },
]

export default function PricingTable() {
  const navigate = useNavigate()

  const scrollToContact = () => {
    const el = document.querySelector('#contact')
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section id="pricing" className="bg-[#0F1419] py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-4">
        <ScrollReveal>
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center">
            选择适合的方案
          </h2>
          <p className="text-[#718096] text-center mt-4 text-lg">
            所有方案均提供 7 天免费试用，满意后联系我们开通正式版
          </p>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-6 mt-14">
          {/* Starter */}
          <ScrollReveal delay={0}>
            <div className="relative p-8 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col h-full">
              <h3 className="text-lg font-semibold text-white">入门版</h3>
              <p className="text-[#718096] text-sm mt-1">个人/小团队尝鲜</p>
              <div className="mt-6 mb-8">
                <span className="text-3xl font-bold text-white">免费体验</span>
              </div>
              <div className="flex-1 space-y-3 mb-8">
                {FEATURES.map((f) => (
                  <div key={f.label} className="flex items-start gap-2 text-sm">
                    {f.starter === false ? (
                      <Minus size={16} className="text-[#4A5568] mt-0.5 shrink-0" />
                    ) : (
                      <Check size={16} className="text-[#4ECDC4] mt-0.5 shrink-0" />
                    )}
                    <span className={f.starter === false ? 'text-[#4A5568]' : 'text-[#A0AEC0]'}>
                      {typeof f.starter === 'string' ? `${f.label}: ${f.starter}` : f.label}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate('/register')}
                className="w-full py-3 text-sm font-medium rounded-xl border border-white/10 text-[#A0AEC0] hover:border-white/30 hover:text-white transition-all"
              >
                免费开始
              </button>
            </div>
          </ScrollReveal>

          {/* Pro — recommended */}
          <ScrollReveal delay={0.1}>
            <div className="relative p-8 rounded-2xl bg-white/[0.03] border-2 border-[#4ECDC4]/40 flex flex-col h-full shadow-[0_0_60px_rgba(78,205,196,0.08)]">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#4ECDC4] text-[#0A0F14] text-xs font-bold">
                推荐
              </div>
              <h3 className="text-lg font-semibold text-white">专业版</h3>
              <p className="text-[#718096] text-sm mt-1">成长型团队首选</p>
              <div className="mt-6 mb-8">
                <span className="text-3xl font-bold text-white">&yen;299</span>
                <span className="text-[#718096] text-sm">/月 起</span>
              </div>
              <div className="flex-1 space-y-3 mb-8">
                {FEATURES.map((f) => (
                  <div key={f.label} className="flex items-start gap-2 text-sm">
                    <Check size={16} className="text-[#4ECDC4] mt-0.5 shrink-0" />
                    <span className="text-[#A0AEC0]">
                      {typeof f.pro === 'string' ? `${f.label}: ${f.pro}` : f.label}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={scrollToContact}
                className="w-full py-3 text-sm font-semibold rounded-xl bg-[#4ECDC4] text-[#0A0F14] hover:bg-[#45b8b0] transition-colors"
              >
                联系销售
              </button>
            </div>
          </ScrollReveal>

          {/* Enterprise */}
          <ScrollReveal delay={0.2}>
            <div className="relative p-8 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col h-full">
              <h3 className="text-lg font-semibold text-white">企业版</h3>
              <p className="text-[#718096] text-sm mt-1">大规模商用</p>
              <div className="mt-6 mb-8">
                <span className="text-3xl font-bold text-white">定制报价</span>
              </div>
              <div className="flex-1 space-y-3 mb-8">
                {FEATURES.map((f) => (
                  <div key={f.label} className="flex items-start gap-2 text-sm">
                    <Check size={16} className="text-[#4ECDC4] mt-0.5 shrink-0" />
                    <span className="text-[#A0AEC0]">
                      {typeof f.enterprise === 'string' ? `${f.label}: ${f.enterprise}` : f.label}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={scrollToContact}
                className="w-full py-3 text-sm font-medium rounded-xl border border-white/10 text-[#A0AEC0] hover:border-white/30 hover:text-white transition-all"
              >
                联系销售
              </button>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
