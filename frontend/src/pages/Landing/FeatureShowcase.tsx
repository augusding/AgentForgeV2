import { Lightbulb, Brain, ShieldAlert, Workflow, FileText, Sparkles } from 'lucide-react'
import ScrollReveal from './ScrollReveal'

const FEATURES = [
  {
    icon: Lightbulb,
    title: 'AI 洞察 — 你的决策参谋',
    desc: '风险雷达实时扫描交付延期、依赖阻塞、指标异常等 9 大维度，业务脉搏追踪关键指标趋势。不是被动查数据，而是 AI 主动告诉你该关注什么。',
    highlight: '从「救火」变「防火」',
  },
  {
    icon: Brain,
    title: '越用越懂你 — 智能涌现',
    desc: 'AI 持续学习你的工作习惯和决策偏好：你常用的模板参数、偏好的汇报格式、关注的指标维度 — 从通用助手进化为「懂你的搭档」。',
    highlight: '用得越多越精准',
  },
  {
    icon: Workflow,
    title: '工作流自动化 — 流程驱动',
    desc: '可视化编排工作流，支持 37 种节点类型：AI 生成、数据处理、审批卡点、定时触发。人定义流程，AI 执行节点，结果确定可预期。',
    highlight: '确定性流程 + AI 智能',
  },
  {
    icon: FileText,
    title: '企业知识库 — 精准检索',
    desc: '上传文档自动向量化，支持 PDF/Word/Markdown。中文语义检索 + BM25 关键词混合搜索，AI 回答基于你的真实业务知识，不是凭空编造。',
    highlight: '检索准确率 85%+',
  },
  {
    icon: ShieldAlert,
    title: '安全护栏 — 企业级管控',
    desc: '5 级操作风险评估、PII 自动脱敏、预算守卫、敏感词过滤。关键操作触发人工审批，完整审计追踪，合规无忧。',
    highlight: '安全合规有保障',
  },
  {
    icon: Sparkles,
    title: '岗位级 AI — 专业定制',
    desc: '不是一个通用 AI，而是按岗位配置专属角色、目标、工具和知识范围。项目经理有项目经理的 AI，算法工程师有算法工程师的 AI。',
    highlight: '14 种岗位模板即开即用',
  },
]

const TAGS = ['DAG 工作流', '9 大模型', '混合 RAG 检索', '7 种数据源连接器', '实时风险推理']

export default function FeatureShowcase() {
  return (
    <section id="features" className="bg-[#0F1419] py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-4">
        <ScrollReveal>
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center">
            为什么选择 AgentForge？
          </h2>
          <p className="text-[#718096] text-center mt-4 text-lg max-w-2xl mx-auto">
            不是多一个 AI 工具，而是重新定义你的工作方式
          </p>
        </ScrollReveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-14">
          {FEATURES.map((f, i) => (
            <ScrollReveal key={f.title} delay={i * 0.1}>
              <div className="p-7 rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] hover:border-[#4ECDC4]/20 transition-all group hover:shadow-[0_0_40px_rgba(78,205,196,0.05)] h-full flex flex-col">
                <div className="w-12 h-12 rounded-xl bg-[#4ECDC4]/10 flex items-center justify-center mb-5 group-hover:bg-[#4ECDC4]/15 transition-colors">
                  <f.icon size={24} className="text-[#4ECDC4]" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-3">{f.title}</h3>
                <p className="text-[#A0AEC0] text-sm leading-relaxed flex-1">{f.desc}</p>
                <div className="mt-5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#4ECDC4]/10 text-[#4ECDC4] text-xs font-medium self-start">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4ECDC4]" />
                  {f.highlight}
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={0.5}>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-12">
            {TAGS.map((tag) => (
              <span
                key={tag}
                className="px-4 py-1.5 text-sm text-[#718096] rounded-full border border-white/[0.06] bg-white/[0.02]"
              >
                {tag}
              </span>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
