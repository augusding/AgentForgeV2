/**
 * AboutSystem -- comprehensive system introduction page.
 *
 * Organized as multi-section showcase:
 * 1. Philosophy & Vision
 * 2. Core Architecture
 * 3. Intelligent Capabilities (emergent intelligence)
 * 4. Self-learning & Evolution
 * 5. Key Scenarios
 * 6. Technical Highlights
 */
import { useState } from 'react'
import {
  Brain, Workflow, Shield, Zap, TrendingUp, Database,
  GitBranch, MessageSquare, Clock, Target, Layers, Eye,
  Sparkles, BarChart3, BookOpen, Users, ChevronRight,
  Server, Bot, RefreshCw, Lightbulb,
} from 'lucide-react'

type SectionId = 'capabilities' | 'architecture' | 'intelligence' | 'evolution' | 'scenarios' | 'tech'

const SECTIONS: { id: SectionId; label: string; icon: typeof Brain }[] = [
  { id: 'capabilities', label: '平台能力', icon: Zap },
  { id: 'architecture', label: '核心架构', icon: Layers },
  { id: 'intelligence', label: '智能涌现', icon: Brain },
  { id: 'evolution', label: '自主进化', icon: TrendingUp },
  { id: 'scenarios', label: '场景实例', icon: Target },
  { id: 'tech', label: '技术亮点', icon: Server },
]

export default function AboutSystem() {
  const [active, setActive] = useState<SectionId>('capabilities')

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-accent/10 via-surface to-surface border border-accent/20 p-6">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
              <Zap size={20} className="text-accent" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text">AgentForge V7</h1>
              <p className="text-xs text-text-muted">Smart Workstation Platform</p>
            </div>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed max-w-2xl">
            流程驱动、AI辅助的智能工位平台。不追求"AI代替人"，而是让每个岗位都有专属AI助手，
            在确定性工作流中嵌入概率性AI能力，实现<strong className="text-text">可控、可预期、越用越聪明</strong>的企业智能化。
          </p>
        </div>
        <div className="absolute top-0 right-0 w-48 h-48 bg-accent/5 rounded-full blur-3xl" />
      </div>

      {/* Section Nav */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {SECTIONS.map(s => {
          const Icon = s.icon
          return (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                active === s.id
                  ? 'bg-accent/10 text-accent border border-accent/30'
                  : 'text-text-muted hover:text-text hover:bg-bg border border-transparent'
              }`}
            >
              <Icon size={13} /> {s.label}
            </button>
          )
        })}
      </div>

      {/* Section Content */}
      <div className="min-h-[400px]">
        {active === 'capabilities' && <CapabilitiesSection />}
        {active === 'architecture' && <ArchitectureSection />}
        {active === 'intelligence' && <IntelligenceSection />}
        {active === 'evolution' && <EvolutionSection />}
        {active === 'scenarios' && <ScenariosSection />}
        {active === 'tech' && <TechSection />}
      </div>
    </div>
  )
}

/* ================================================================
   Section Components
   ================================================================ */

function Card({ icon: Icon, title, children, accent = false }: {
  icon: typeof Brain; title: string; children: React.ReactNode; accent?: boolean
}) {
  return (
    <div className={`rounded-lg border p-4 ${accent ? 'border-accent/30 bg-accent/5' : 'border-border bg-surface'}`}>
      <div className="flex items-center gap-2 mb-2.5">
        <div className={`p-1.5 rounded ${accent ? 'bg-accent/15 text-accent' : 'bg-bg text-text-secondary'}`}>
          <Icon size={15} />
        </div>
        <h4 className="text-sm font-semibold text-text">{title}</h4>
      </div>
      <div className="text-xs text-text-secondary leading-relaxed space-y-1.5">{children}</div>
    </div>
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-accent/10 text-accent rounded-full">
      {children}
    </span>
  )
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-bold text-text">{title}</h2>
      <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
    </div>
  )
}

/* ── 0. Platform Capabilities (merged: Core Features + Design Philosophy) ── */
function CapabilitiesSection() {
  return (
    <div className="space-y-5">
      <SectionTitle title="平台能力" subtitle="流程驱动、AI辅助的智能工位平台 -- 六大能力 + 三个设计原则" />

      {/* Design Principles Banner */}
      <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
        <h4 className="text-sm font-semibold text-text mb-2.5">设计原则</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex items-start gap-2">
            <div className="p-1.5 rounded bg-accent/15 text-accent shrink-0"><GitBranch size={14} /></div>
            <div>
              <div className="text-xs font-medium text-text">流程驱动，AI辅助</div>
              <div className="text-[10px] text-text-secondary mt-0.5">确定性工作流做决策，AI在流程节点中执行。像流水线一样可控。</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="p-1.5 rounded bg-blue-500/15 text-blue-400 shrink-0"><Users size={14} /></div>
            <div>
              <div className="text-xs font-medium text-text">岗位取代Agent</div>
              <div className="text-[10px] text-text-secondary mt-0.5">不让AI扮演人，给每个岗位配专属AI助手。岗位 = 角色 + 工具 + 知识 + 权限。</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="p-1.5 rounded bg-green-500/15 text-green-400 shrink-0"><Shield size={14} /></div>
            <div>
              <div className="text-xs font-medium text-text">可预期胜过万能</div>
              <div className="text-[10px] text-text-secondary mt-0.5">每次按流程执行，结果可预期、可审计、可回溯。企业级AI的底线。</div>
            </div>
          </div>
        </div>
      </div>

      {/* Six Core Capabilities */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card icon={Users} title="智能岗位" accent>
          <p>每个岗位配备<strong>专属AI助手</strong>，拥有独立的角色定义、工具集、知识库和权限边界。</p>
          <p className="mt-1">15个预置岗位模板，覆盖产品、运营、技术、管理全链路。</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <Pill>角色定义</Pill><Pill>专属工具</Pill><Pill>知识作用域</Pill><Pill>权限边界</Pill>
          </div>
        </Card>

        <Card icon={Workflow} title="可视化工作流">
          <p>拖拽式DAG工作流编辑器，支持<strong>17种内置节点</strong>：AI处理、HTTP请求、条件分支、审批、循环等。</p>
          <p className="mt-1">确定性流程 + 概率性AI节点，结果可控可预期。支持自然语言创建工作流。</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <Pill>DAG调度</Pill><Pill>并行执行</Pill><Pill>审批节点</Pill><Pill>定时触发</Pill>
          </div>
        </Card>

        <Card icon={BookOpen} title="知识库RAG">
          <p>结构化分块 + 中文向量嵌入 + BM25混合检索 + 重排序，构建<strong>岗位专属知识库</strong>。</p>
          <p className="mt-1">支持 PDF/DOCX/TXT/MD 批量导入，BM25 快筛避免无效检索。</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <Pill>混合检索</Pill><Pill>中文优化</Pill><Pill>智能跳过</Pill><Pill>热度提权</Pill>
          </div>
        </Card>

        <Card icon={MessageSquare} title="智能对话">
          <p>基于岗位上下文的AI对话，自动注入<strong>知识库、历史记忆、用户偏好</strong>，支持34个内置工具自主调用。</p>
          <p className="mt-1">Hook拦截器硬守护，确保AI行为安全可控。</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <Pill>上下文感知</Pill><Pill>记忆检索</Pill><Pill>工具调用</Pill><Pill>Hook守护</Pill>
          </div>
        </Card>

        <Card icon={Brain} title="记忆与进化">
          <p>三层记忆体系：<strong>行为信号 → 模式凝练 → Playbook蒸馏</strong>。系统从交互中自动学习，越用越聪明。</p>
          <p className="mt-1">支持负反馈衰减和记忆管理，AI的偏好会跟随用户习惯变化而自动调整。</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <Pill>行为信号</Pill><Pill>Playbook蒸馏</Pill><Pill>记忆管理</Pill><Pill>负反馈衰减</Pill>
          </div>
        </Card>

        <Card icon={Shield} title="企业级安全">
          <p>沙箱执行、审批流程、操作审计、权限隔离，满足<strong>企业合规要求</strong>。</p>
          <p className="mt-1">JWT认证、RBAC三级权限、Webhook签名、敏感信息脱敏。</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <Pill>沙箱隔离</Pill><Pill>审计日志</Pill><Pill>权限控制</Pill><Pill>PII脱敏</Pill>
          </div>
        </Card>
      </div>

      {/* Value Triangle */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <h4 className="text-sm font-semibold text-text mb-3">企业价值三角</h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <div className="w-10 h-10 mx-auto rounded-full bg-blue-500/10 flex items-center justify-center">
              <Workflow size={18} className="text-blue-400" />
            </div>
            <div className="text-xs font-medium text-text">行业模板</div>
            <div className="text-[10px] text-text-muted">profiles/ 目录即一个行业方案<br/>复制即部署，零开发上线</div>
          </div>
          <div className="space-y-1">
            <div className="w-10 h-10 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
              <Database size={18} className="text-green-400" />
            </div>
            <div className="text-xs font-medium text-text">系统集成</div>
            <div className="text-[10px] text-text-muted">HTTP/Webhook/SQL<br/>对接企业已有系统</div>
          </div>
          <div className="space-y-1">
            <div className="w-10 h-10 mx-auto rounded-full bg-purple-500/10 flex items-center justify-center">
              <Shield size={18} className="text-purple-400" />
            </div>
            <div className="text-xs font-medium text-text">合规可控</div>
            <div className="text-[10px] text-text-muted">审批流、权限、审计日志<br/>满足企业管控需求</div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── 2. Core Architecture ── */
function ArchitectureSection() {
  return (
    <div className="space-y-5">
      <SectionTitle title="核心架构" subtitle="消息处理全链路 -- 从用户输入到AI输出的每一步" />

      {/* ── Product Architecture Diagram ── */}
      <div className="rounded-xl border border-accent/20 bg-surface p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-text">系统产品架构全景</h4>
          <span className="text-[9px] text-text-muted px-2 py-0.5 rounded bg-bg border border-border">AgentForge V7 Smart Workstation</span>
        </div>

        {/* Layer 1: User & Channels */}
        <div>
          <div className="text-[9px] text-text-muted font-medium mb-1.5 tracking-wider">接入层 ACCESS LAYER</div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { name: 'Web 聊天', detail: 'React SPA', color: 'border-blue-500/30 bg-blue-500/5' },
              { name: 'WebSocket', detail: '实时双向', color: 'border-blue-500/30 bg-blue-500/5' },
              { name: 'REST API', detail: 'aiohttp', color: 'border-blue-500/30 bg-blue-500/5' },
              { name: 'Webhook', detail: '外部回调', color: 'border-blue-500/30 bg-blue-500/5' },
            ].map(c => (
              <div key={c.name} className={`rounded-md border px-2.5 py-1.5 text-center ${c.color}`}>
                <div className="text-[10px] font-medium text-text">{c.name}</div>
                <div className="text-[8px] text-text-muted">{c.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Arrow down */}
        <div className="flex justify-center"><div className="w-px h-3 bg-border" /><span className="text-[10px] text-text-muted mx-2">UnifiedMessage</span><div className="w-px h-3 bg-border" /></div>

        {/* Layer 2: Core Pipeline */}
        <div>
          <div className="text-[9px] text-text-muted font-medium mb-1.5 tracking-wider">核心处理层 CORE PIPELINE</div>
          <div className="rounded-lg border border-accent/20 bg-accent/5 p-3">
            <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px]">
              {[
                { label: '能力门控', color: 'bg-gray-500/20 text-text-secondary border-border' },
                { label: '意图路由', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
                { label: 'RAG检索', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
                { label: 'Prompt组装', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
                { label: 'LLM推理', color: 'bg-accent/15 text-accent border-accent/30' },
                { label: '信号采集', color: 'bg-pink-500/15 text-pink-400 border-pink-500/30' },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className={`px-2 py-1 rounded border font-medium ${s.color}`}>{s.label}</span>
                  {i < 5 && <ChevronRight size={10} className="text-text-muted shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Layer 3: Three Pillars side by side */}
        <div className="grid grid-cols-3 gap-3">
          {/* Pillar: Knowledge */}
          <div className="rounded-lg border border-green-500/20 p-3 space-y-1.5">
            <div className="text-[9px] text-green-400 font-medium tracking-wider">知识引擎</div>
            <div className="space-y-1">
              {['文档结构化切分', '中文 Embedding', 'ChromaDB 向量库', '混合检索(向量+BM25)', '重排序 + 热度提权'].map(s => (
                <div key={s} className="flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-green-400 shrink-0" />
                  <span className="text-[9px] text-text-secondary">{s}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pillar: Workflow */}
          <div className="rounded-lg border border-amber-500/20 p-3 space-y-1.5">
            <div className="text-[9px] text-amber-400 font-medium tracking-wider">工作流引擎</div>
            <div className="space-y-1">
              {['可视化 DAG 编排', '17种节点(AI/审批/条件...)', '拓扑排序 + 并行调度', '统一触发器(定时/Webhook)', '表达式引擎 {{ }}'].map(s => (
                <div key={s} className="flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-[9px] text-text-secondary">{s}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pillar: Tools */}
          <div className="rounded-lg border border-cyan-500/20 p-3 space-y-1.5">
            <div className="text-[9px] text-cyan-400 font-medium tracking-wider">工具体系</div>
            <div className="space-y-1">
              {['17个通用工具', '岗位专属工具集', '自定义工具(API/模板)', 'LLM 自主选择调用', '工具结果二次理解'].map(s => (
                <div key={s} className="flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-cyan-400 shrink-0" />
                  <span className="text-[9px] text-text-secondary">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Evolution Loop - the key differentiator */}
        <div className="relative rounded-lg border border-pink-500/20 bg-pink-500/5 p-3">
          <div className="text-[9px] text-pink-400 font-medium tracking-wider mb-2">进化层 EVOLUTION LOOP (自循环)</div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 grid grid-cols-5 gap-1.5 text-center">
              {[
                { label: '行为信号', detail: '6种类型\n静默采集', color: 'border-blue-500/20' },
                { label: '模式凝练', detail: 'PatternEngine\n每小时运行', color: 'border-amber-500/20' },
                { label: '洞察推断', detail: '6类洞察\n9类风险', color: 'border-purple-500/20' },
                { label: 'Prompt进化', detail: '8层动态组装\n偏好+风险注入', color: 'border-accent/20' },
                { label: '体验提升', detail: '意图更准\n输出更合适', color: 'border-green-500/20' },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className={`flex-1 rounded border px-1.5 py-1.5 ${s.color} bg-surface`}>
                    <div className="text-[9px] font-medium text-text">{s.label}</div>
                    <div className="text-[8px] text-text-muted whitespace-pre-line mt-0.5">{s.detail}</div>
                  </div>
                  {i < 4 && <ChevronRight size={8} className="text-pink-400 shrink-0" />}
                </div>
              ))}
            </div>
          </div>
          {/* Loop-back arrow indication */}
          <div className="mt-2 flex items-center justify-center gap-1.5">
            <div className="h-px flex-1 bg-pink-500/20" />
            <span className="text-[8px] text-pink-400 font-medium px-2 py-0.5 rounded-full border border-pink-500/20 bg-surface">
              &#x21BA; 正反馈飞轮 -- 体验提升 → 更多使用 → 更多信号 → 更准模式
            </span>
            <div className="h-px flex-1 bg-pink-500/20" />
          </div>
        </div>

        {/* Layer 4: Data & Storage */}
        <div>
          <div className="text-[9px] text-text-muted font-medium mb-1.5 tracking-wider">数据持久层 DATA LAYER</div>
          <div className="grid grid-cols-5 gap-2">
            {[
              { name: 'SQLite', detail: '会话/用户/信号', icon: '💾' },
              { name: 'ChromaDB', detail: '向量索引', icon: '🔍' },
              { name: 'workflows.db', detail: '工作流+触发器', icon: '⚡' },
              { name: 'knowledge_meta', detail: '文档元数据', icon: '📄' },
              { name: 'YAML Profiles', detail: '行业/岗位模板', icon: '📋' },
            ].map(d => (
              <div key={d.name} className="rounded-md border border-border bg-bg px-2 py-1.5 text-center">
                <div className="text-[10px]">{d.icon}</div>
                <div className="text-[9px] font-medium text-text mt-0.5">{d.name}</div>
                <div className="text-[8px] text-text-muted">{d.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Layer 5: Position System - cross-cutting */}
        <div className="rounded-lg border border-border bg-bg/50 p-3">
          <div className="text-[9px] text-text-muted font-medium tracking-wider mb-2">岗位体系 POSITION SYSTEM (横切所有层)</div>
          <div className="flex items-center gap-3 overflow-x-auto text-[9px]">
            <div className="shrink-0 text-center">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto">
                <Users size={14} className="text-blue-400" />
              </div>
              <div className="text-text-muted mt-0.5">岗位模板</div>
            </div>
            <div className="shrink-0 text-text-muted">=</div>
            {[
              { label: '角色定义', desc: 'role/goal/context', color: 'text-blue-400' },
              { label: '工具集', desc: 'tools: [...]', color: 'text-cyan-400' },
              { label: '知识作用域', desc: 'knowledge_scope', color: 'text-green-400' },
              { label: '仪表盘', desc: 'dashboard_metrics', color: 'text-amber-400' },
              { label: '权限边界', desc: 'permissions', color: 'text-red-400' },
            ].map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="shrink-0 px-2 py-1 rounded border border-border bg-surface text-center min-w-[60px]">
                  <div className={`font-medium ${p.color}`}>{p.label}</div>
                  <div className="text-[8px] text-text-muted">{p.desc}</div>
                </div>
                {i < 4 && <span className="text-text-muted">+</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Architecture Legend */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border text-[9px] text-text-muted">
          <span className="font-medium">设计理念：</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent/30" /> 确定性优先(流程/规则/模式)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400/30" /> 概率性补充(LLM判断)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-400/30" /> 持续进化(数据驱动闭环)</span>
        </div>
      </div>

      {/* Message Pipeline */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <h4 className="text-sm font-semibold text-text mb-4">消息处理管线 V7.7 (Message Pipeline)</h4>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {[
            { label: '用户消息', sub: 'UnifiedMessage', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
            { label: '意图路由', sub: 'IntentRouter', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
            { label: '并行预处理', sub: 'Skill+RAG+Prefs', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
            { label: 'Prompt 组装', sub: 'PromptAssembler', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
            { label: 'Hook 拦截', sub: 'pre_llm Gate', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
            { label: 'LLM + 工具', sub: 'AgentRuntime', color: 'bg-accent/15 text-accent border-accent/30' },
            { label: 'Hook 守护', sub: 'post_tool/llm', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
            { label: '信号采集', sub: 'Learning Loop', color: 'bg-pink-500/15 text-pink-400 border-pink-500/30' },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`px-2.5 py-1.5 rounded-lg border ${step.color}`}>
                <div className="font-medium">{step.label}</div>
                <div className="text-[9px] opacity-70 mt-0.5">{step.sub}</div>
              </div>
              {i < 7 && <ChevronRight size={12} className="text-text-muted shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* ── Pipeline Stage Details ── */}
      <div className="space-y-4">

        {/* Stage 1: UnifiedMessage */}
        <div className="rounded-lg border border-blue-500/20 bg-surface p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-6 h-6 rounded-full bg-blue-500/15 flex items-center justify-center text-[10px] font-bold text-blue-400">1</div>
            <h4 className="text-sm font-semibold text-text">用户消息 · UnifiedMessage</h4>
            <span className="text-[10px] text-text-muted ml-auto">core/models.py</span>
          </div>
          <div className="text-xs text-text-secondary space-y-1.5">
            <p><strong>设计原理：</strong>无论消息来自 Web聊天、API调用还是 WebSocket，都统一为同一个数据结构。这是整条管线的入口契约。</p>
            <p><strong>亮点：</strong>一条消息携带完整上下文 -- 用户ID、岗位ID、会话ID、附件列表、组织ID。后续每个阶段都从这个统一结构中按需取值，不再重复查询。</p>
            <div className="mt-2 p-2 rounded bg-bg font-mono text-[10px] text-text-muted space-y-0.5">
              <div>UnifiedMessage {'{'}</div>
              <div>&nbsp;&nbsp;content: "帮我看看今天有什么风险"</div>
              <div>&nbsp;&nbsp;user_id: "u_abc"&nbsp;&nbsp;&nbsp;// 用于权限、偏好、学习</div>
              <div>&nbsp;&nbsp;session_id: "s_01"&nbsp;// 用于上下文连续性</div>
              <div>&nbsp;&nbsp;attachments: [...]&nbsp;// 触发文件处理能力门控</div>
              <div>{'}'}</div>
            </div>
            <p><strong>优势：</strong>多通道统一入口，新增接入渠道（如飞书、钉钉）只需写一个适配器将消息转为 UnifiedMessage，管线零改动。</p>
          </div>
        </div>

        {/* Stage 2: CapabilityGate */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-6 h-6 rounded-full bg-gray-500/15 flex items-center justify-center text-[10px] font-bold text-text-muted">2</div>
            <h4 className="text-sm font-semibold text-text">能力门控 · CapabilityGate</h4>
            <span className="text-[10px] text-text-muted ml-auto">core/capability_gate.py</span>
          </div>
          <div className="text-xs text-text-secondary space-y-1.5">
            <p><strong>设计原理：</strong>V23起，<strong className="text-text">所有34个内置工具对所有用户开放</strong>，不再按岗位过滤。能力门控仅负责注册动态工具。</p>
            <p><strong>动态注册（按需）：</strong></p>
            <div className="mt-1 grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="p-2 rounded bg-bg">
                <div className="font-medium text-text mb-0.5">26个内置工具</div>
                <div className="text-[10px]">全部开放: 办公文档(5) + 数据(4) + Web(4) + 开发(4) + 系统(3) + 媒体(3) + 通用(3)</div>
              </div>
              <div className="p-2 rounded bg-bg">
                <div className="font-medium text-text mb-0.5">8个工位工具</div>
                <div className="text-[10px]">日程/优先级/跟进/工作项/定时任务/概览/风险检查/业务信号</div>
              </div>
              <div className="p-2 rounded bg-bg">
                <div className="font-medium text-text mb-0.5">动态能力工具</div>
                <div className="text-[10px]">search_knowledge + list_workflows + save_as_skill 按需注册</div>
              </div>
            </div>
            <p className="mt-1"><strong>优势：</strong>用户不再受岗位限制，任何工具随时可用。<strong className="text-accent">工具选择完全由 LLM 自主判断 + Hook 拦截器守护。</strong></p>
          </div>
        </div>

        {/* Stage 3: IntentRouter */}
        <div className="rounded-lg border border-amber-500/20 bg-surface p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-6 h-6 rounded-full bg-amber-500/15 flex items-center justify-center text-[10px] font-bold text-amber-400">3</div>
            <h4 className="text-sm font-semibold text-text">意图路由 · IntentRouter</h4>
            <span className="text-[10px] text-text-muted ml-auto">core/intent_router.py</span>
          </div>
          <div className="text-xs text-text-secondary space-y-1.5">
            <p><strong>设计原理：</strong>确定性路径优先，LLM判断兜底。能不用LLM判断的就不用 -- <strong className="text-text">省token、低延迟、可预期</strong>。</p>
            <p><strong>三级路由策略：</strong></p>
            <div className="mt-1 space-y-2">
              <div className="flex items-start gap-2 p-2 rounded bg-green-500/5 border border-green-500/10">
                <span className="shrink-0 w-5 h-5 rounded-full bg-green-500/15 text-green-400 flex items-center justify-center text-[9px] font-bold mt-0.5">1</span>
                <div>
                  <div className="font-medium text-text">学习模式匹配（LearnedPatterns）</div>
                  <div className="mt-0.5">用户历史表达→工作流的映射记忆。第3次说"跑日报"时，系统已经学会直接匹配"广告日报"工作流。<br/><strong>越用越准，这是进化能力的核心入口。</strong></div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 rounded bg-amber-500/5 border border-amber-500/10">
                <span className="shrink-0 w-5 h-5 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center text-[9px] font-bold mt-0.5">2</span>
                <div>
                  <div className="font-medium text-text">关键词规则匹配（WorkflowIndex）</div>
                  <div className="mt-0.5">工作流名称和描述的倒排索引，中文分词后匹配。确定性高、零LLM开销。</div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 rounded bg-blue-500/5 border border-blue-500/10">
                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-500/15 text-blue-400 flex items-center justify-center text-[9px] font-bold mt-0.5">3</span>
                <div>
                  <div className="font-medium text-text">LLM 自由判断（Freeform）</div>
                  <div className="mt-0.5">前两级都无匹配时，交给LLM自主决策工具调用。这是"智能"的部分 -- 但被框在了最后一层，保证了系统整体的可控性。</div>
                </div>
              </div>
            </div>
            <p className="mt-1"><strong>优势：</strong>90%的高频操作在前两级就命中 → 毫秒级响应。只有首次/罕见请求才需要LLM判断。</p>
          </div>
        </div>

        {/* Stage 4: RAG */}
        <div className="rounded-lg border border-green-500/20 bg-surface p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-6 h-6 rounded-full bg-green-500/15 flex items-center justify-center text-[10px] font-bold text-green-400">4</div>
            <h4 className="text-sm font-semibold text-text">RAG 检索 · KnowledgeBase</h4>
            <span className="text-[10px] text-text-muted ml-auto">knowledge/rag.py</span>
          </div>
          <div className="text-xs text-text-secondary space-y-1.5">
            <p><strong>设计原理：</strong>V23 两级检索优化 -- <strong className="text-text">BM25 快筛(30ms)</strong>决定是否需要向量搜索，避免无意义的重型检索。</p>
            <p><strong>检索管线：</strong></p>
            <div className="mt-1 grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                { step: '1. 文档导入', detail: '支持 PDF/DOCX/TXT/MD，启动时预加载 Embedding 模型' },
                { step: '2. 结构化切分', detail: 'Markdown标题感知、表格→自然语言、段落边界识别' },
                { step: '3. 中文Embedding', detail: 'bge-base-zh-v1.5，768维，启动时预加载(省22s冷启动)' },
                { step: '4. BM25 快筛', detail: '30ms 关键词预匹配，无命中直接跳过向量搜索' },
                { step: '5. 向量语义搜索', detail: '仅 BM25 命中时执行，ChromaDB 余弦相似度' },
                { step: '6. 混合重排', detail: '向量(0.7)+BM25(0.3)融合，阈值过滤+去重' },
              ].map(s => (
                <div key={s.step} className="p-2 rounded bg-bg">
                  <div className="font-medium text-text text-[10px]">{s.step}</div>
                  <div className="text-[10px] mt-0.5">{s.detail}</div>
                </div>
              ))}
            </div>
            <p className="mt-1"><strong>性能优化：</strong>"上午好"等无关消息 → BM25 0命中 → 跳过向量搜索(省500ms)。"填充率"等业务问题 → BM25 命中 → 完整检索。<strong className="text-accent">智能跳过，不浪费算力。</strong></p>
          </div>
        </div>

        {/* Stage 5: PromptAssembler */}
        <div className="rounded-lg border border-purple-500/20 bg-surface p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-6 h-6 rounded-full bg-purple-500/15 flex items-center justify-center text-[10px] font-bold text-purple-400">5</div>
            <h4 className="text-sm font-semibold text-text">Prompt 组装 · PromptAssembler</h4>
            <span className="text-[10px] text-text-muted ml-auto">core/prompt_assembler.py</span>
          </div>
          <div className="text-xs text-text-secondary space-y-1.5">
            <p><strong>设计原理：</strong>V23 精简为<strong className="text-text">6层按需组装</strong>，约350-800 token。今日概况和风险改为工具按需获取，不再注入 prompt。</p>
            <div className="mt-1 space-y-1">
              {[
                { layer: '1. 身份层', desc: 'role/goal/context 三要素 → 定义AI"是谁"', color: 'text-blue-400', detail: '从岗位YAML的role+goal+context组装，始终注入(~300 token)' },
                { layer: '2. 操作指南', desc: '工具调用判断原则', color: 'text-green-400', detail: '"调用工具前先问自己：用户消息是否需要数据才能回答？"(~50 token)' },
                { layer: '3. 知识层', desc: 'RAG检索结果注入', color: 'text-emerald-400', detail: '仅BM25命中时注入，格式化为[参考知识]区块(按需)' },
                { layer: '4. 偏好层', desc: '用户学习到的习惯偏好', color: 'text-amber-400', detail: '会话级缓存，如"偏好xlsx格式" → AI自动遵从(按需)' },
                { layer: '5. 引导层', desc: '新手期友好提示', color: 'text-orange-400', detail: '仅 onboarding_stage="guided" 时注入(按需)' },
                { layer: '6. Skill策略层', desc: '匹配到的Skill执行策略', color: 'text-pink-400', detail: '教LLM当前任务的最佳实践步骤(按需)' },
              ].map(l => (
                <div key={l.layer} className="flex items-start gap-2 p-2 rounded bg-bg">
                  <span className={`shrink-0 font-mono text-[10px] font-bold ${l.color} mt-0.5`}>{l.layer}</span>
                  <div>
                    <span className="font-medium text-text">{l.desc}</span>
                    <div className="text-[10px] text-text-muted mt-0.5">{l.detail}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-1"><strong>V23 优化：</strong>今日概况和风险<strong className="text-accent">不再每次注入 prompt</strong>，改为 get_workstation_summary / check_risks 工具按需获取。prompt 精简 50%，LLM 推理更快。</p>
          </div>
        </div>

        {/* Stage 6: AgentRuntime */}
        <div className="rounded-lg border border-accent/20 bg-surface p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center text-[10px] font-bold text-accent">6</div>
            <h4 className="text-sm font-semibold text-text">LLM + 工具 · AgentRuntime</h4>
            <span className="text-[10px] text-text-muted ml-auto">core/agent.py</span>
          </div>
          <div className="text-xs text-text-secondary space-y-1.5">
            <p><strong>设计原理：</strong>LLM 自主决策 + <strong className="text-text">Hook 拦截器硬守护</strong>。AI 决定"做什么"，Hook 决定"能不能做"。</p>
            <p><strong>执行模式 + Hook 体系：</strong></p>
            <div className="mt-1 grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="p-2 rounded bg-bg">
                <div className="font-medium text-text mb-0.5">pre_llm Hook (LLM 调用前)</div>
                <div className="text-[10px]"><strong className="text-red-400">ToolGateHook:</strong> 首条短消息(score=0)不传工具 → 问候秒回。追问超短(≤4字)注入确认指令 → 防止误执行。<br/><strong className="text-red-400">AttachmentRouterHook:</strong> 标记附件对应的处理工具。</div>
              </div>
              <div className="p-2 rounded bg-bg">
                <div className="font-medium text-text mb-0.5">工具循环 (最多6次)</div>
                <div className="text-[10px]">ReAct: 思考→工具调用→观察→继续。34个内置工具全部可用，LLM自主选择。连续2次失败注入rethink深度推理。</div>
              </div>
              <div className="p-2 rounded bg-bg">
                <div className="font-medium text-text mb-0.5">post_tool Hook (每次工具执行后)</div>
                <div className="text-[10px]"><strong className="text-red-400">ToolLoopGuardHook:</strong> 超6次/60s/单工具30s → 强制中断。<br/><strong className="text-red-400">ToolResultSizeHook:</strong> 结果超5000字自动截断。</div>
              </div>
              <div className="p-2 rounded bg-bg">
                <div className="font-medium text-text mb-0.5">post_llm Hook (输出到用户前)</div>
                <div className="text-[10px]"><strong className="text-red-400">OutputSafetyHook:</strong> PII脱敏+敏感词检测。<br/><strong className="text-red-400">CostGuardHook:</strong> 单次超15k token告警。</div>
              </div>
            </div>
            <div className="mt-2 p-2.5 rounded bg-red-500/5 border border-red-500/10">
              <p className="text-red-400 font-medium text-[11px]">Hook 是硬编码拦截器，不依赖 LLM 判断，不占用上下文窗口。确保 prompt 管不住的事，代码来管。</p>
            </div>
            <p className="mt-1"><strong>模型策略：</strong>三级 Tier -- Tier1(MiniMax-M2.5) → Tier2(DeepSeek) → Tier3(Claude)。自动 fallback，预算超限自动降级。</p>
          </div>
        </div>

        {/* Stage 7: SignalTracker */}
        <div className="rounded-lg border border-pink-500/20 bg-surface p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-6 h-6 rounded-full bg-pink-500/15 flex items-center justify-center text-[10px] font-bold text-pink-400">7</div>
            <h4 className="text-sm font-semibold text-text">信号采集 · SignalTracker</h4>
            <span className="text-[10px] text-text-muted ml-auto">core/signal_tracker.py</span>
          </div>
          <div className="text-xs text-text-secondary space-y-1.5">
            <p><strong>设计原理：</strong>管线的最后一环，但也是进化能力的<strong className="text-text">起点</strong>。每次交互结束后，静默记录用户行为信号 -- 不打扰用户，不需要用户评价。</p>
            <p><strong>六种信号类型：</strong></p>
            <div className="mt-1 grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                { type: 'positive', desc: '采纳了AI回复', example: '用户直接使用AI生成的内容', color: 'text-green-400' },
                { type: 'negative', desc: '拒绝了AI回复', example: '用户重新提问或忽略回复', color: 'text-red-400' },
                { type: 'edit', desc: '编辑了AI输出', example: '用户修改了格式/措辞', color: 'text-amber-400' },
                { type: 'override', desc: '覆盖了默认参数', example: '用户改了工作流的输入参数', color: 'text-purple-400' },
                { type: 'priority', desc: '关注了某类内容', example: '用户反复查看风险相关信息', color: 'text-blue-400' },
                { type: 'copy', desc: '复制了AI回复', example: '用户复制内容到其他地方使用', color: 'text-cyan-400' },
              ].map(s => (
                <div key={s.type} className="p-2 rounded bg-bg">
                  <div className={`font-medium text-[10px] ${s.color}`}>{s.type}</div>
                  <div className="text-[10px] font-medium text-text">{s.desc}</div>
                  <div className="text-[10px] text-text-muted mt-0.5">{s.example}</div>
                </div>
              ))}
            </div>
            <p className="mt-1"><strong>闭环原理：</strong>信号 → user_signals 表 → PatternEngine 每小时凝练 → user_patterns 表 → 下次请求时 PromptAssembler 读取偏好 → AI行为自动调整。</p>
            <div className="mt-2 p-2.5 rounded bg-accent/5 border border-accent/10">
              <p className="text-accent font-medium text-[11px]">这是整个系统"越用越聪明"的底层机制 -- 不是某个模块的功能，而是管线首尾相连形成的进化飞轮。</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

/* ── 3. Emergent Intelligence ── */
function IntelligenceSection() {
  return (
    <div className="space-y-5">
      <SectionTitle title="智能涌现" subtitle="不是预设的规则，而是从真实使用中自然生长出的业务能力" />

      {/* What is Emergence */}
      <div className="rounded-xl border border-accent/20 bg-accent/5 p-5">
        <h4 className="text-sm font-semibold text-text mb-2">什么是"智能涌现"？为什么它比"功能开发"更有价值？</h4>
        <p className="text-xs text-text-secondary leading-relaxed">
          传统软件的能力是<strong>开发出来的</strong> -- 产品经理定义需求、工程师写代码、QA测试、上线。每个能力都有明确的开发成本。
        </p>
        <p className="text-xs text-text-secondary leading-relaxed mt-1.5">
          AgentForge 的部分能力是<strong className="text-accent">涌现出来的</strong> -- 没人写过"周一提醒做周报"这条规则，
          但当用户连续3周在周一让AI帮忙做周报，系统自动识别出这个模式并在第4周主动提醒。
          <strong className="text-text">这个能力的开发成本是零</strong>，它是信号采集+模式凝练+Prompt注入三个模块组合后自然产生的。
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="p-2.5 rounded bg-bg">
            <div className="text-[10px] text-text-muted">传统方式</div>
            <div className="text-xs text-text mt-0.5">每个能力 = 一个需求 + 设计 + 开发 + 测试</div>
            <div className="text-[10px] text-text-muted mt-1">线性增长，成本递增</div>
          </div>
          <div className="p-2.5 rounded bg-accent/10 border border-accent/20">
            <div className="text-[10px] text-accent">涌现方式</div>
            <div className="text-xs text-text mt-0.5">基础机制 x 数据积累 = 能力自动生长</div>
            <div className="text-[10px] text-accent mt-1">指数增长，边际成本趋零</div>
          </div>
        </div>
      </div>

      {/* ── Emergence Architecture Diagram ── */}
      <div className="rounded-xl border border-accent/20 bg-surface p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-text">智能涌现架构全景</h4>
          <span className="text-[9px] text-text-muted px-2 py-0.5 rounded bg-bg border border-border">5大涌现能力的底层机制</span>
        </div>

        {/* Row 1: Input Sources */}
        <div>
          <div className="text-[9px] text-text-muted font-medium mb-1.5 tracking-wider">数据源层 DATA SOURCES</div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { name: 'AI 对话', detail: '采纳/拒绝/编辑/复制', color: 'border-blue-500/30 bg-blue-500/5', dot: 'bg-blue-400' },
              { name: '工作流执行', detail: '完成/失败/审批/耗时', color: 'border-amber-500/30 bg-amber-500/5', dot: 'bg-amber-400' },
              { name: '业务信号', detail: 'eCPM/填充率/收入', color: 'border-red-500/30 bg-red-500/5', dot: 'bg-red-400' },
              { name: '知识检索', detail: '引用次数/命中文档', color: 'border-green-500/30 bg-green-500/5', dot: 'bg-green-400' },
            ].map(s => (
              <div key={s.name} className={`rounded-md border px-2 py-1.5 ${s.color}`}>
                <div className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                  <span className="text-[10px] font-medium text-text">{s.name}</span>
                </div>
                <div className="text-[8px] text-text-muted mt-0.5">{s.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center text-[9px] text-text-muted">
          <span>&#9660; 静默采集（用户无感）</span>
        </div>

        {/* Row 2: 5 Data Tables */}
        <div>
          <div className="text-[9px] text-text-muted font-medium mb-1.5 tracking-wider">存储层 5 TABLES</div>
          <div className="grid grid-cols-5 gap-1.5">
            {[
              { name: 'user_signals', desc: '行为信号', color: 'border-blue-500/20', dot: 'bg-blue-400' },
              { name: 'user_patterns', desc: '偏好模式', color: 'border-amber-500/20', dot: 'bg-amber-400' },
              { name: 'learned_patterns', desc: '意图映射', color: 'border-purple-500/20', dot: 'bg-purple-400' },
              { name: 'knowledge_usage', desc: '知识热度', color: 'border-green-500/20', dot: 'bg-green-400' },
              { name: 'workstation_events', desc: '事件流', color: 'border-pink-500/20', dot: 'bg-pink-400' },
            ].map(t => (
              <div key={t.name} className={`rounded border px-2 py-1.5 bg-bg text-center ${t.color}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${t.dot} mx-auto mb-0.5`} />
                <div className="text-[8px] font-mono text-text-secondary">{t.name}</div>
                <div className="text-[8px] text-text-muted">{t.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center text-[9px] text-text-muted">
          <span>&#9660; 三引擎并行处理</span>
        </div>

        {/* Row 3: 3 Engines */}
        <div>
          <div className="text-[9px] text-text-muted font-medium mb-1.5 tracking-wider">引擎层 3 ENGINES</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
              <div className="text-[10px] font-medium text-amber-400 mb-1">PatternEngine</div>
              <div className="space-y-0.5 text-[8px] text-text-secondary">
                <div>&#8226; 每小时扫描活跃用户</div>
                <div>&#8226; ≥3次相同行为 → 凝练</div>
                <div>&#8226; confidence 0.6→0.98</div>
                <div>&#8226; 30天无命中自动衰减</div>
              </div>
            </div>
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-2.5">
              <div className="text-[10px] font-medium text-purple-400 mb-1">InsightEngine</div>
              <div className="space-y-0.5 text-[8px] text-text-secondary">
                <div>&#8226; 6类洞察 × 多时间窗口</div>
                <div>&#8226; 效率/趋势/模式/知识</div>
                <div>&#8226; 环比分析(本周vs上周)</div>
                <div>&#8226; 冷启动引导(信号&lt;50)</div>
              </div>
            </div>
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2.5">
              <div className="text-[10px] font-medium text-red-400 mb-1">RiskEngine</div>
              <div className="space-y-0.5 text-[8px] text-text-secondary">
                <div>&#8226; 9类风险源推断</div>
                <div>&#8226; 4级严重度评估</div>
                <div>&#8226; 趋势单调性检测</div>
                <div>&#8226; 30秒轮询刷新</div>
              </div>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center text-[9px] text-text-muted">
          <span>&#9660; 结果注入到系统各层</span>
        </div>

        {/* Row 4: Output - 5 Emergence Points */}
        <div>
          <div className="text-[9px] text-text-muted font-medium mb-1.5 tracking-wider">涌现输出层 5 EMERGENCE POINTS</div>
          <div className="grid grid-cols-5 gap-1.5">
            {[
              { name: '业务风险预见', inject: 'Prompt第7层\n风险主动注入', color: 'text-red-400 border-red-500/20 bg-red-500/5' },
              { name: '流程自优化', inject: '洞察面板\n+ 时间模式', color: 'text-amber-400 border-amber-500/20 bg-amber-500/5' },
              { name: '知识自沉淀', inject: 'RAG重排序\nboost_weight', color: 'text-green-400 border-green-500/20 bg-green-500/5' },
              { name: '意图进化', inject: 'IntentRouter\n第1级学习匹配', color: 'text-purple-400 border-purple-500/20 bg-purple-500/5' },
              { name: '风格适配', inject: 'Prompt第4层\n偏好注入', color: 'text-cyan-400 border-cyan-500/20 bg-cyan-500/5' },
            ].map(e => (
              <div key={e.name} className={`rounded border px-2 py-2 text-center ${e.color}`}>
                <div className={`text-[9px] font-medium ${e.color.split(' ')[0]}`}>{e.name}</div>
                <div className="text-[8px] text-text-muted mt-0.5 whitespace-pre-line">{e.inject}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Loop-back */}
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-accent/20" />
          <span className="text-[8px] text-accent font-medium px-2.5 py-0.5 rounded-full border border-accent/20 bg-accent/5">
            &#x21BA; 涌现产生更好体验 → 更多使用 → 更多数据 → 更强涌现
          </span>
          <div className="h-px flex-1 bg-accent/20" />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border text-[9px] text-text-muted">
          <span className="font-medium">关键特征：</span>
          <span>&#8226; 无需人工训练</span>
          <span>&#8226; 边际成本趋零</span>
          <span>&#8226; 能力指数增长</span>
          <span>&#8226; 竞对无法复制(数据壁垒)</span>
        </div>
      </div>

      {/* Emergence Category 1: Business Decision */}
      <div className="rounded-lg border border-red-500/20 bg-surface p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded bg-red-500/10"><Target size={15} className="text-red-400" /></div>
          <div>
            <h4 className="text-sm font-semibold text-text">涌现能力一：业务风险预见</h4>
            <p className="text-[10px] text-text-muted">从指标波动中预见业务危机，在问题爆发前预警</p>
          </div>
        </div>
        <div className="text-xs text-text-secondary space-y-2">
          <div className="p-3 rounded bg-bg">
            <div className="font-medium text-text mb-1.5">场景：广告填充率连续下降 → 提前避免百万级收入损失</div>
            <div className="space-y-1.5 text-[10px]">
              <div className="flex items-start gap-2">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-bg border border-border text-text-muted font-mono">Day 1</span>
                <span>运营通过AI对话记录了业务信号："今天填充率掉了2个点，78% → 76%"</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-bg border border-border text-text-muted font-mono">Day 2</span>
                <span>又记录了一条："填充率继续降，现在74%了"</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono">Day 3</span>
                <span><strong className="text-amber-400">RiskEngine 自动触发</strong> -- 检测到 fill_rate 信号连续3天单调下降(趋势风险) + 当前值74%低于目标80%(指标风险) → 叠加判定为<strong className="text-text">"严重"级风险</strong></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 font-mono">触发</span>
                <span>工位风险雷达亮红灯；AI在用户下次对话时<strong className="text-text">主动开口</strong>："注意，填充率已连续3天下降(78%→74%)，建议立即排查广告源配置和瀑布流优先级"</span>
              </div>
            </div>
            <div className="mt-2.5 p-2 rounded bg-red-500/5 border border-red-500/10">
              <div className="text-[10px] text-red-400 font-medium">业务价值</div>
              <div className="text-[10px] text-text-secondary mt-0.5">
                填充率每下降1%，日均收入损失约 ¥2-5万。提前3天预警 = 避免 ¥6-15万潜在损失。
                <strong className="text-text">没有人写过"填充率连降3天要报警"这条规则</strong> --
                它是"指标记录 + 趋势检测 + 风险推断 + Prompt注入"四个模块组合后涌现的能力。
              </div>
            </div>
          </div>
          <div className="text-[10px] text-text-muted">
            <strong>涌现机制：</strong>record_business_signal(信号采集) → signal_history(趋势存储) → _check_trend_risks(单调性检测) → _check_metric_risks(目标偏离) → Prompt Layer 7(风险注入) → AI主动提醒
          </div>
        </div>
      </div>

      {/* Emergence Category 2: Workflow Optimization */}
      <div className="rounded-lg border border-amber-500/20 bg-surface p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded bg-amber-500/10"><TrendingUp size={15} className="text-amber-400" /></div>
          <div>
            <h4 className="text-sm font-semibold text-text">涌现能力二：工作流程自优化</h4>
            <p className="text-[10px] text-text-muted">从用户的重复行为中发现流程改进机会</p>
          </div>
        </div>
        <div className="text-xs text-text-secondary space-y-2">
          <div className="p-3 rounded bg-bg">
            <div className="font-medium text-text mb-1.5">场景：发现每周五下午都在做相同的事 → 自动建议创建工作流</div>
            <div className="space-y-1.5 text-[10px]">
              <div className="flex items-start gap-2">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-bg border border-border text-text-muted font-mono">Week 1</span>
                <span>周五下午，用户问AI："帮我拉一下本周各广告位的eCPM数据，按渠道分组"，然后又说"生成一份周报发给老板"</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-bg border border-border text-text-muted font-mono">Week 2</span>
                <span>周五下午，几乎一样的操作。SignalTracker 记录了 priority 信号(用户在周五关注"周报"类任务)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono">Week 3</span>
                <span><strong className="text-amber-400">PatternEngine 凝练出时间模式</strong> -- "周五 14:00-16:00 是该用户的周报高峰"(confidence: 0.85)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono">Week 3</span>
                <span><strong className="text-amber-400">InsightEngine 生成洞察</strong> -- "你的工作高峰在周五下午，建议将周报流程自动化"</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400 font-mono">结果</span>
                <span>用户根据建议创建"周报自动化"工作流 + 设置每周五14:00定时触发 → <strong className="text-text">每周省2小时手动操作</strong></span>
              </div>
            </div>
            <div className="mt-2.5 p-2 rounded bg-amber-500/5 border border-amber-500/10">
              <div className="text-[10px] text-amber-400 font-medium">业务价值</div>
              <div className="text-[10px] text-text-secondary mt-0.5">
                每人每周省2小时 × 团队10人 × 52周 = <strong className="text-text">年省1040工时</strong>。
                系统不是被动工具，而是<strong className="text-text">主动发现优化机会的顾问</strong>。
              </div>
            </div>
          </div>
          <div className="text-[10px] text-text-muted">
            <strong>涌现机制：</strong>user_signals(行为记录) → _analyze_time_patterns(14天小时聚合) → peak_hour检测(≥1.5x均值) → InsightEngine(洞察生成) → 工位面板展示
          </div>
        </div>
      </div>

      {/* Emergence Category 3: Cross-person Knowledge */}
      <div className="rounded-lg border border-green-500/20 bg-surface p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded bg-green-500/10"><BookOpen size={15} className="text-green-400" /></div>
          <div>
            <h4 className="text-sm font-semibold text-text">涌现能力三：组织知识自沉淀</h4>
            <p className="text-[10px] text-text-muted">个人的经验自动变成组织的知识资产</p>
          </div>
        </div>
        <div className="text-xs text-text-secondary space-y-2">
          <div className="p-3 rounded bg-bg">
            <div className="font-medium text-text mb-1.5">场景：老员工的排查经验 → 自动沉淀为高权重知识 → 新人秒查</div>
            <div className="space-y-1.5 text-[10px]">
              <div className="flex items-start gap-2">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-bg border border-border text-text-muted font-mono">阶段1</span>
                <span>资深运营上传了一份"广告异常排查手册"到知识库。初始 boost_weight = 1.0</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-bg border border-border text-text-muted font-mono">阶段2</span>
                <span>团队多人在遇到广告问题时检索到该文档，每次引用 boost_weight +0.1</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400 font-mono">阶段3</span>
                <span><strong className="text-green-400">boost_weight 升到 2.3</strong> -- 该文档在所有广告相关检索中自动排名第一。新入职的运营问"填充率低怎么办"，第一个命中的就是这份排查手册</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400 font-mono">同时</span>
                <span>半年前上传的"旧版SDK文档"因30天无人引用，boost_weight 自动衰减到 0.6 → 检索排名下降 → <strong className="text-text">知识库自动新陈代谢</strong></span>
              </div>
            </div>
            <div className="mt-2.5 p-2 rounded bg-green-500/5 border border-green-500/10">
              <div className="text-[10px] text-green-400 font-medium">业务价值</div>
              <div className="text-[10px] text-text-secondary mt-0.5">
                新人培训周期从2周缩短到3天 -- 不需要"师傅带"，AI已经知道团队最常用的知识是什么。
                <strong className="text-text">关键人离职不再导致知识流失</strong>，经验已经沉淀在知识库的权重里了。
              </div>
            </div>
          </div>
          <div className="text-[10px] text-text-muted">
            <strong>涌现机制：</strong>knowledge_usage(引用追踪) → boost_weight(热度提权) → 30天衰减机制 → HybridReranker(检索重排序) → 高权重文档自动置顶
          </div>
        </div>
      </div>

      {/* Emergence Category 4: User Understanding */}
      <div className="rounded-lg border border-purple-500/20 bg-surface p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded bg-purple-500/10"><Brain size={15} className="text-purple-400" /></div>
          <div>
            <h4 className="text-sm font-semibold text-text">涌现能力四：用户意图理解进化</h4>
            <p className="text-[10px] text-text-muted">从"听不懂"到"秒懂"，从"被动执行"到"主动匹配"</p>
          </div>
        </div>
        <div className="text-xs text-text-secondary space-y-2">
          <div className="p-3 rounded bg-bg">
            <div className="font-medium text-text mb-1.5">场景：自然语言表达多样性 → 系统自动学会所有说法</div>
            <div className="space-y-1.5 text-[10px]">
              <div className="flex items-start gap-2">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-bg border border-border text-text-muted font-mono">第1次</span>
                <span>用户说"跑一下日报" → AI不确定指哪个工作流 → 返回列表让用户选 → 用户选了"广告日报"</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-bg border border-border text-text-muted font-mono">第3次</span>
                <span>用户说"跑日报" → <strong className="text-purple-400">IntentRouter 直接命中</strong>（LearnedPatterns已记住映射）→ 秒级执行</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 font-mono">第10次</span>
                <span>用户换说法"出一份今天的报表" → <strong className="text-purple-400">仍然命中</strong>（系统学到了"报表"="日报"）</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 font-mono">第20次</span>
                <span>同事用了完全不同的说法"帮忙汇总下今天广告数据" → <strong className="text-purple-400">也能命中</strong>（同组织的映射可共享）</span>
              </div>
            </div>
            <div className="mt-2.5 p-2 rounded bg-purple-500/5 border border-purple-500/10">
              <div className="text-[10px] text-purple-400 font-medium">业务价值</div>
              <div className="text-[10px] text-text-secondary mt-0.5">
                用户不需要记住工作流的"官方名称"或"标准指令"。怎么说都行，系统越用越懂你。
                <strong className="text-text">这消除了"AI不好用"的最大障碍 -- 用户不知道该怎么说才能让AI理解</strong>。
              </div>
            </div>
          </div>
          <div className="text-[10px] text-text-muted">
            <strong>涌现机制：</strong>用户选择(显式反馈) → LearnedPatterns.record_mapping(记录映射) → IntentRouter 第1级匹配(下次直接命中) → confidence 递增(越用越准)
          </div>
        </div>
      </div>

      {/* Emergence Category 5: Personalization */}
      <div className="rounded-lg border border-cyan-500/20 bg-surface p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded bg-cyan-500/10"><Sparkles size={15} className="text-cyan-400" /></div>
          <div>
            <h4 className="text-sm font-semibold text-text">涌现能力五：个性化工作风格适配</h4>
            <p className="text-[10px] text-text-muted">不同人用同一个AI，得到不同风格的服务</p>
          </div>
        </div>
        <div className="text-xs text-text-secondary space-y-2">
          <div className="p-3 rounded bg-bg">
            <div className="font-medium text-text mb-1.5">场景：同一个"项目经理"岗位，两个人得到完全不同风格的AI</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px]">
              <div className="p-2.5 rounded border border-border">
                <div className="font-medium text-text mb-1">张经理的AI助手</div>
                <div className="space-y-1 text-text-muted">
                  <div>- 3次编辑把表格改成Markdown → 学到 format=markdown</div>
                  <div>- 总是覆盖"详细度"参数为"精简" → 学到 detail=brief</div>
                  <div>- 每次都跳过风险分析直接看结论 → 学到 priority=conclusion</div>
                </div>
                <div className="mt-1.5 p-1.5 rounded bg-cyan-500/5 text-cyan-400">
                  AI输出：精简Markdown、结论先行、省略过程
                </div>
              </div>
              <div className="p-2.5 rounded border border-border">
                <div className="font-medium text-text mb-1">李经理的AI助手</div>
                <div className="space-y-1 text-text-muted">
                  <div>- 从不修改AI输出格式 → 保持默认</div>
                  <div>- 经常追问"这个数据的依据是什么" → 学到 detail=thorough</div>
                  <div>- 反复查看风险部分 → 学到 priority=risk</div>
                </div>
                <div className="mt-1.5 p-1.5 rounded bg-cyan-500/5 text-cyan-400">
                  AI输出：详尽分析、附带数据来源、风险优先展示
                </div>
              </div>
            </div>
            <div className="mt-2.5 p-2 rounded bg-cyan-500/5 border border-cyan-500/10">
              <div className="text-[10px] text-cyan-400 font-medium">业务价值</div>
              <div className="text-[10px] text-text-secondary mt-0.5">
                不需要每个人去"设置AI偏好"。<strong className="text-text">用着用着，AI就变成了你习惯的样子</strong>。
                这是消费级产品（如抖音推荐）的"千人千面"能力，首次出现在企业工作场景中。
              </div>
            </div>
          </div>
          <div className="text-[10px] text-text-muted">
            <strong>涌现机制：</strong>edit/override/priority 信号 → PatternEngine(≥3次凝练为模式) → user_patterns(confidence递增) → PromptAssembler Layer 4(偏好注入) → LLM行为自动适配
          </div>
        </div>
      </div>

      {/* Summary: Emergence Flywheel */}
      <div className="rounded-xl border border-accent/30 bg-gradient-to-r from-accent/5 to-purple-500/5 p-5">
        <h4 className="text-sm font-semibold text-text mb-3">涌现飞轮：为什么这些能力会越来越强？</h4>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs mb-3">
          {[
            { label: '更多使用', color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' },
            { label: '更多信号', color: 'text-green-400 border-green-500/30 bg-green-500/10' },
            { label: '更准模式', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
            { label: '更好体验', color: 'text-purple-400 border-purple-500/30 bg-purple-500/10' },
            { label: '更多使用', color: 'text-accent border-accent/30 bg-accent/10' },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full border font-medium ${s.color}`}>{s.label}</span>
              {i < 4 && <span className="text-text-muted">→</span>}
            </div>
          ))}
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">
          这是一个<strong className="text-accent">正反馈循环</strong>。
          用户不需要"训练"AI、不需要"配置"偏好、不需要"教"系统规则。
          只要正常使用，系统就在持续变聪明。
          <strong className="text-text">团队用得越多，竞争优势越大 -- 因为你的AI已经沉淀了你独有的业务经验和工作模式，这是竞争对手无法复制的。</strong>
        </p>
      </div>
    </div>
  )
}

/* ── 4. Self-learning & Evolution ── */
function EvolutionSection() {
  return (
    <div className="space-y-5">
      <SectionTitle title="自主学习与进化" subtitle="六步闭环 -- 行为信号 + 记忆蒸馏 + Playbook沉淀，每一步都在让系统变得更聪明" />

      {/* Overview: Design Philosophy */}
      <div className="rounded-xl border border-accent/20 bg-accent/5 p-5">
        <h4 className="text-sm font-semibold text-text mb-2">设计哲学：静默进化，无感升级</h4>
        <p className="text-xs text-text-secondary leading-relaxed">
          传统AI产品需要用户主动"训练" -- 打标签、写规则、配参数。AgentForge 的进化是<strong className="text-accent">完全静默的</strong>：
          用户正常工作，系统在后台观察、学习、优化。用户唯一的感知是"AI越来越好用了"，但说不清是哪一刻变好的。
        </p>
        <p className="text-xs text-text-secondary leading-relaxed mt-1">
          这背后是一条<strong className="text-text">五步闭环</strong>，每一步都有独立价值，但组合起来形成了<strong className="text-accent">复利效应</strong>。
        </p>
      </div>

      {/* ── Evolution Architecture Diagram ── */}
      <div className="rounded-xl border border-accent/20 bg-surface p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-text">自主进化架构全景</h4>
          <span className="text-[9px] text-text-muted px-2 py-0.5 rounded bg-bg border border-border">静默进化 · 数据驱动 · 自循环</span>
        </div>

        {/* Row 1: User Actions (triggers) */}
        <div>
          <div className="text-[9px] text-text-muted font-medium mb-1.5 tracking-wider">STEP 1 · 用户行为 (进化原料)</div>
          <div className="grid grid-cols-6 gap-1.5">
            {[
              { act: '对话', detail: '提问/追问', emoji: '💬' },
              { act: '采纳', detail: '使用AI回复', emoji: '✅' },
              { act: '编辑', detail: '修改输出格式', emoji: '✏️' },
              { act: '覆盖', detail: '改工作流参数', emoji: '🔄' },
              { act: '复制', detail: '复制到外部', emoji: '📋' },
              { act: '忽略', detail: '重新提问', emoji: '⏭️' },
            ].map(a => (
              <div key={a.act} className="rounded border border-border bg-bg px-1.5 py-1.5 text-center">
                <div className="text-[11px]">{a.emoji}</div>
                <div className="text-[9px] font-medium text-text">{a.act}</div>
                <div className="text-[7px] text-text-muted">{a.detail}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center"><span className="text-[9px] text-blue-400">&#9660; SignalTracker 静默记录 (用户零感知)</span></div>

        {/* Row 2: Signal Processing */}
        <div>
          <div className="text-[9px] text-text-muted font-medium mb-1.5 tracking-wider">STEP 2 · 信号采集 (结构化存储)</div>
          <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-2.5">
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-[10px] font-medium text-green-400">写入</div>
                <div className="text-[8px] text-text-secondary mt-0.5">user_signals 表<br/>每条附带 user_id + position_id + timestamp</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-medium text-green-400">分类</div>
                <div className="text-[8px] text-text-secondary mt-0.5">6种信号类型<br/>positive / negative / edit / override / priority / copy</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-medium text-green-400">关联</div>
                <div className="text-[8px] text-text-secondary mt-0.5">绑定上下文<br/>context_type + context_id → 可追溯到具体对话/工作流</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center"><span className="text-[9px] text-amber-400">&#9660; PatternEngine 每小时凝练</span></div>

        {/* Row 3: Pattern Condensation */}
        <div>
          <div className="text-[9px] text-text-muted font-medium mb-1.5 tracking-wider">STEP 3 · 模式凝练 (从噪声到确定性)</div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded border border-border bg-surface p-2 text-center">
                <div className="text-[9px] text-text-muted">输入: 碎片信号</div>
                <div className="text-[8px] text-text-secondary mt-0.5">"edit格式→MD" ×5<br/>"override详细度→精简" ×3</div>
              </div>
              <div className="shrink-0 text-center px-2">
                <RefreshCw size={14} className="text-amber-400 mx-auto" />
                <div className="text-[8px] text-amber-400 font-medium mt-0.5">≥3次</div>
                <div className="text-[7px] text-text-muted">凝练阈值</div>
              </div>
              <div className="flex-1 rounded border border-amber-500/20 bg-surface p-2 text-center">
                <div className="text-[9px] text-amber-400">输出: 可靠模式</div>
                <div className="text-[8px] text-text-secondary mt-0.5">format=markdown (0.88)<br/>detail=brief (0.78)</div>
              </div>
              <div className="shrink-0 text-center px-2">
                <TrendingUp size={14} className="text-text-muted mx-auto" />
                <div className="text-[8px] text-text-muted font-medium mt-0.5">命中+</div>
                <div className="text-[7px] text-text-muted">conf递增</div>
              </div>
              <div className="flex-1 rounded border border-border bg-surface p-2 text-center">
                <div className="text-[9px] text-text-muted">衰减机制</div>
                <div className="text-[8px] text-text-secondary mt-0.5">30天无命中<br/>conf ×0.9 自动降权</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center"><span className="text-[9px] text-purple-400">&#9660; InsightEngine + RiskEngine 并行分析</span></div>

        {/* Row 4: Insight + Risk */}
        <div>
          <div className="text-[9px] text-text-muted font-medium mb-1.5 tracking-wider">STEP 4 · 洞察生成 (数据变建议)</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-2.5">
              <div className="text-[10px] font-medium text-purple-400 mb-1.5">InsightEngine · 6类洞察</div>
              <div className="grid grid-cols-2 gap-1 text-[8px]">
                {[
                  { name: '效率统计', window: '7天' },
                  { name: '趋势对比', window: '周环比' },
                  { name: '时间模式', window: '14天' },
                  { name: '知识热度', window: '实时' },
                  { name: '优化建议', window: 'conf≥0.8' },
                  { name: '冷启动引导', window: '信号<50' },
                ].map(i => (
                  <div key={i.name} className="flex justify-between px-1.5 py-0.5 rounded bg-surface">
                    <span className="text-text-secondary">{i.name}</span>
                    <span className="text-text-muted">{i.window}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2.5">
              <div className="text-[10px] font-medium text-red-400 mb-1.5">RiskEngine · 9类风险</div>
              <div className="grid grid-cols-3 gap-1 text-[8px]">
                {[
                  { name: '交付风险', trigger: '截止日临近' },
                  { name: '指标风险', trigger: '偏离目标值' },
                  { name: '趋势风险', trigger: '连续下降' },
                  { name: '依赖风险', trigger: '超期未响应' },
                  { name: '负荷风险', trigger: '任务过载' },
                  { name: '流程风险', trigger: '执行失败' },
                  { name: '复合风险', trigger: '多指标异常' },
                  { name: '准备风险', trigger: '会议缺准备' },
                  { name: '盲区风险', trigger: '知识缺口' },
                ].map(r => (
                  <div key={r.name} className="flex justify-between px-1.5 py-0.5 rounded bg-surface">
                    <span className="text-text-secondary">{r.name}</span>
                    <span className="text-text-muted">{r.trigger}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center"><span className="text-[9px] text-cyan-400">&#9660; MemoryDistiller + Playbook 蒸馏</span></div>

        {/* Row 5: Memory Distillation */}
        <div>
          <div className="text-[9px] text-text-muted font-medium mb-1.5 tracking-wider">STEP 5 · 记忆蒸馏 (经验沉淀)</div>
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2.5">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded border border-border bg-surface px-1.5 py-2">
                <div className="text-[9px] font-medium text-blue-400">短期记忆</div>
                <div className="text-[8px] text-text font-medium mt-1">会话上下文</div>
                <div className="text-[7px] text-text-muted mt-0.5">当前对话20条历史</div>
              </div>
              <div className="rounded border border-border bg-surface px-1.5 py-2">
                <div className="text-[9px] font-medium text-amber-400">中期记忆</div>
                <div className="text-[8px] text-text font-medium mt-1">蒸馏摘要</div>
                <div className="text-[7px] text-text-muted mt-0.5">关键决策/偏好/待办</div>
              </div>
              <div className="rounded border border-border bg-surface px-1.5 py-2">
                <div className="text-[9px] font-medium text-purple-400">长期记忆</div>
                <div className="text-[8px] text-text font-medium mt-1">Playbook</div>
                <div className="text-[7px] text-text-muted mt-0.5">可复用工作模式</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center"><span className="text-[9px] text-accent">&#9660; 结果回注到消息管线各层</span></div>

        {/* Row 6: Injection Points */}
        <div>
          <div className="text-[9px] text-text-muted font-medium mb-1.5 tracking-wider">STEP 6 · 体验优化 (进化结果注入)</div>
          <div className="rounded-lg border border-accent/20 bg-accent/5 p-2.5">
            <div className="grid grid-cols-5 gap-1.5 text-center">
              {[
                { target: 'IntentRouter\n学习匹配', what: '意图映射', desc: '"跑日报"→秒懂', color: 'text-amber-400' },
                { target: 'RAG\n重排序', what: '知识提权', desc: '常用文档自动置顶', color: 'text-green-400' },
                { target: 'Prompt\n偏好+Skill层', what: '风格+策略', desc: '偏好适配+Playbook', color: 'text-purple-400' },
                { target: 'Prompt\n风险层', what: '主动预警', desc: 'AI开口就提醒风险', color: 'text-red-400' },
                { target: '工位面板\n洞察区', what: '效率报告', desc: '"本周省了3小时"', color: 'text-cyan-400' },
              ].map(p => (
                <div key={p.target} className="rounded border border-border bg-surface px-1.5 py-2">
                  <div className={`text-[9px] font-medium ${p.color} whitespace-pre-line`}>{p.target}</div>
                  <div className="text-[8px] text-text font-medium mt-1">{p.what}</div>
                  <div className="text-[7px] text-text-muted mt-0.5">{p.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Grand Loop-back */}
        <div className="relative rounded-lg border border-accent/30 bg-gradient-to-r from-accent/5 to-purple-500/5 p-3">
          <div className="flex items-center justify-center gap-2 text-[10px]">
            {['更好体验', '更多使用', '更多信号', '更准模式', '记忆沉淀', '更好体验'].map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full border text-[9px] font-medium ${
                  i === 5 ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border bg-surface text-text-secondary'
                }`}>{s}</span>
                {i < 5 && <span className="text-accent text-[10px]">&#8594;</span>}
              </div>
            ))}
          </div>
          <div className="text-center mt-1.5 text-[8px] text-text-muted">
            &#x21BA; <strong className="text-accent">正反馈飞轮</strong> -- 用户正常工作，系统每天都在学习、记忆、进化
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border text-[9px] text-text-muted">
          <span className="font-medium">设计原则：</span>
          <span>&#8226; 零训练成本(用户无需配置)</span>
          <span>&#8226; 渐进式增强(Day1→Day30逐步变强)</span>
          <span>&#8226; 可逆可衰减(偏好变了AI跟着变)</span>
          <span>&#8226; 数据壁垒(越用越难替代)</span>
        </div>
      </div>

      {/* Step 1: User Behavior */}
      <div className="rounded-lg border border-blue-500/20 bg-surface p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-blue-500/15 flex items-center justify-center text-[11px] font-bold text-blue-400">1</div>
          <div>
            <h4 className="text-sm font-semibold text-text">用户行为 -- 一切进化的原料</h4>
            <p className="text-[10px] text-text-muted">每一次交互都是一份训练数据，但用户完全无感</p>
          </div>
        </div>
        <div className="text-xs text-text-secondary space-y-2">
          <p><strong>设计哲学：</strong>不问用户"你觉得这个回答好不好"，而是从<strong className="text-text">行为本身</strong>推断满意度。行为比问卷诚实。</p>
          <div className="p-3 rounded bg-bg">
            <div className="font-medium text-text mb-2">场景：广告运营的日常对话</div>
            <div className="space-y-2 text-[10px]">
              <div className="p-2 rounded border border-border">
                <div className="text-text-muted mb-0.5">09:15 用户问AI</div>
                <div>"帮我看看今天广告位的填充率数据"</div>
                <div className="text-text-muted mt-1">→ AI返回数据表格 → <strong className="text-green-400">用户直接复制粘贴到周报</strong></div>
                <div className="text-green-400 mt-0.5">行为信号: positive(采纳) + copy(复制)</div>
              </div>
              <div className="p-2 rounded border border-border">
                <div className="text-text-muted mb-0.5">10:30 用户问AI</div>
                <div>"分析一下上周的收入趋势"</div>
                <div className="text-text-muted mt-1">→ AI返回分析 → <strong className="text-amber-400">用户把"表格格式"改成了"Markdown列表"</strong></div>
                <div className="text-amber-400 mt-0.5">行为信号: edit(编辑格式)</div>
              </div>
              <div className="p-2 rounded border border-border">
                <div className="text-text-muted mb-0.5">14:00 用户执行工作流</div>
                <div>执行"竞品分析" → <strong className="text-purple-400">用户覆盖了"分析深度"参数从"标准"改为"详细"</strong></div>
                <div className="text-purple-400 mt-0.5">行为信号: override(参数覆盖)</div>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-text-muted">
              一天下来，系统静默记录了十几条行为信号。用户没填任何问卷，但系统已经知道：他喜欢Markdown格式、他需要详细分析、他的高频工作时段是上午。
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: Signal Collection */}
      <div className="rounded-lg border border-green-500/20 bg-surface p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-green-500/15 flex items-center justify-center text-[11px] font-bold text-green-400">2</div>
          <div>
            <h4 className="text-sm font-semibold text-text">信号采集 -- 把行为变成结构化数据</h4>
            <p className="text-[10px] text-text-muted">6种信号类型 x 5张数据表 = 完整的用户画像原料</p>
          </div>
        </div>
        <div className="text-xs text-text-secondary space-y-2">
          <p><strong>设计哲学：</strong>采集的不是"用户说了什么"，而是<strong className="text-text">"用户对AI输出做了什么"</strong>。这个区别至关重要 -- 前者是输入，后者是反馈。</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { type: 'positive', label: '采纳', desc: '直接使用AI回复', biz: '说明AI理解了需求', color: 'text-green-400 border-green-500/20 bg-green-500/5' },
              { type: 'negative', label: '拒绝', desc: '忽略或重新提问', biz: '说明AI没理解或质量不够', color: 'text-red-400 border-red-500/20 bg-red-500/5' },
              { type: 'edit', label: '编辑', desc: '修改了AI的输出', biz: '暗示偏好差异(格式/风格/详细度)', color: 'text-amber-400 border-amber-500/20 bg-amber-500/5' },
              { type: 'override', label: '覆盖', desc: '改了工作流参数', biz: '暗示默认值不合适', color: 'text-purple-400 border-purple-500/20 bg-purple-500/5' },
              { type: 'priority', label: '关注', desc: '反复查看某类信息', biz: '暗示工作重心', color: 'text-blue-400 border-blue-500/20 bg-blue-500/5' },
              { type: 'copy', label: '复制', desc: '复制到外部使用', biz: '最强的"有用"信号', color: 'text-cyan-400 border-cyan-500/20 bg-cyan-500/5' },
            ].map(s => (
              <div key={s.type} className={`p-2.5 rounded border ${s.color}`}>
                <div className={`font-medium text-[11px] ${s.color.split(' ')[0]}`}>{s.label}</div>
                <div className="text-[10px] text-text mt-0.5">{s.desc}</div>
                <div className="text-[10px] text-text-muted mt-1">{s.biz}</div>
              </div>
            ))}
          </div>
          <div className="p-3 rounded bg-bg">
            <div className="font-medium text-text mb-1.5">业务实例：如何从信号判断AI质量在提升？</div>
            <div className="text-[10px] space-y-1">
              <div>第1周：positive 信号占比 45%，edit 信号占比 30% → AI输出经常需要用户修改</div>
              <div>第3周：positive 信号占比 72%，edit 信号占比 12% → 学到了偏好，修改大幅减少</div>
              <div className="text-accent font-medium mt-1">InsightEngine 自动生成洞察："AI采纳率提升60%，本周为你节省约2.5小时手动调整时间"</div>
            </div>
          </div>
        </div>
      </div>

      {/* Step 3: Pattern Condensation */}
      <div className="rounded-lg border border-amber-500/20 bg-surface p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-amber-500/15 flex items-center justify-center text-[11px] font-bold text-amber-400">3</div>
          <div>
            <h4 className="text-sm font-semibold text-text">模式凝练 -- 从噪声中提取确定性</h4>
            <p className="text-[10px] text-text-muted">PatternEngine 每小时运行一次，把碎片信号变成可靠偏好</p>
          </div>
        </div>
        <div className="text-xs text-text-secondary space-y-2">
          <p><strong>设计哲学：</strong>不是一次行为就下结论，而是<strong className="text-text">≥3次相同行为才凝练为模式</strong>。同时引入 confidence 衰减 -- 30天不命中的模式自动降权。人会变，AI也要跟着变。</p>
          <div className="p-3 rounded bg-bg">
            <div className="font-medium text-text mb-2">场景：运营总监的报告风格学习</div>
            <div className="space-y-2 text-[10px]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="p-2 rounded border border-border">
                  <div className="text-text-muted mb-0.5">原始信号(20条)</div>
                  <div className="space-y-0.5">
                    <div>edit: 改表格→Markdown (5次)</div>
                    <div>edit: 删掉过程只留结论 (4次)</div>
                    <div>override: 详细度→精简 (3次)</div>
                    <div>positive: 直接采纳 (8次)</div>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <div className="text-center">
                    <RefreshCw size={16} className="text-amber-400 mx-auto mb-1" />
                    <div className="text-amber-400 font-medium">PatternEngine</div>
                    <div className="text-text-muted">凝练为3个模式</div>
                  </div>
                </div>
                <div className="p-2 rounded border border-amber-500/20 bg-amber-500/5">
                  <div className="text-amber-400 mb-0.5">凝练结果</div>
                  <div className="space-y-0.5">
                    <div>format: markdown <span className="text-text-muted">(conf: 0.88)</span></div>
                    <div>style: conclusion_first <span className="text-text-muted">(conf: 0.82)</span></div>
                    <div>detail: brief <span className="text-text-muted">(conf: 0.78)</span></div>
                  </div>
                </div>
              </div>
              <div className="p-2 rounded border border-green-500/10 bg-green-500/5">
                <div className="text-green-400 font-medium mb-0.5">业务效果</div>
                <div>下次AI回复自动采用：Markdown格式 + 结论先行 + 精简版。用户打开就能用，不用再改。</div>
                <div className="mt-1"><strong className="text-text">一个人每天省10分钟调格式 × 250个工作日 = 年省41小时/人</strong></div>
              </div>
            </div>
          </div>
          <div className="p-3 rounded bg-bg">
            <div className="font-medium text-text mb-1.5">模式衰减机制 -- 为什么这比"永久记住"更聪明？</div>
            <div className="text-[10px] space-y-1">
              <div>Q1: 用户偏好精简报告 (confidence: 0.88) → AI 输出精简版</div>
              <div>Q2: 公司换了新领导，要求看详细数据 → 用户开始不再修改详细版 → 信号变化</div>
              <div>Q2+30天: 旧模式"detail=brief"无命中，confidence 自动衰减 0.88→0.79→0.71...</div>
              <div className="text-accent font-medium mt-1">AI 悄悄回到详细模式，不需要用户手动"重新训练"。</div>
            </div>
          </div>
        </div>
      </div>

      {/* Step 4: Insight Generation */}
      <div className="rounded-lg border border-purple-500/20 bg-surface p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-purple-500/15 flex items-center justify-center text-[11px] font-bold text-purple-400">4</div>
          <div>
            <h4 className="text-sm font-semibold text-text">洞察生成 -- 从数据中看到人看不到的趋势</h4>
            <p className="text-[10px] text-text-muted">InsightEngine(6类洞察) + RiskEngine(9类风险) = 全方位感知</p>
          </div>
        </div>
        <div className="text-xs text-text-secondary space-y-2">
          <p><strong>设计哲学：</strong>洞察不是"仪表盘上的数字"，而是<strong className="text-text">可行动的建议</strong>。每条洞察都回答"所以我该怎么做？"</p>
          <div className="p-3 rounded bg-bg">
            <div className="font-medium text-text mb-2">场景：广告变现团队的周一早晨</div>
            <div className="space-y-2 text-[10px]">
              <div className="p-2.5 rounded border border-border">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-red-400 font-medium">风险洞察 (RiskEngine)</span>
                </div>
                <div className="text-text">"eCPM 连续5天下降，从 ¥12.3 降至 ¥9.8，跌幅20%。建议立即检查广告源竞价策略。"</div>
                <div className="text-text-muted mt-1">来源: 业务信号趋势单调性检测 + 指标偏离目标值(target: ¥11)</div>
              </div>
              <div className="p-2.5 rounded border border-border">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-amber-400 font-medium">效率洞察 (InsightEngine)</span>
                </div>
                <div className="text-text">"本周AI自动处理了23项任务，节省约1.9小时。其中'广告日报'执行最频繁(每日1次)。"</div>
                <div className="text-text-muted mt-1">来源: workstation_events 7天聚合，completed事件 × 5分钟/项</div>
              </div>
              <div className="p-2.5 rounded border border-border">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-blue-400 font-medium">模式洞察 (PatternEngine)</span>
                </div>
                <div className="text-text">"发现你每周一10点都在做竞品分析，建议设为自动化工作流。"</div>
                <div className="text-text-muted mt-1">来源: user_signals 14天按小时聚合，周一10点活跃度 ≥ 均值1.5倍</div>
              </div>
            </div>
          </div>
          <div className="p-3 rounded bg-purple-500/5 border border-purple-500/10">
            <div className="text-purple-400 font-medium text-[11px] mb-1">业务价值</div>
            <div className="text-[10px]">
              管理者不需要盯仪表盘，AI会<strong className="text-text">主动推送需要关注的事</strong>。
              运营不需要自己发现规律，AI会<strong className="text-text">提出流程优化建议</strong>。
              这把"被动看数据"变成了"主动收建议"，决策效率提升一个量级。
            </div>
          </div>
        </div>
      </div>

      {/* Step 5: Experience Optimization */}
      <div className="rounded-lg border border-accent/20 bg-surface p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center text-[11px] font-bold text-accent">5</div>
          <div>
            <h4 className="text-sm font-semibold text-text">体验优化 -- 闭环的终点，也是新循环的起点</h4>
            <p className="text-[10px] text-text-muted">凝练的模式和洞察回注到系统各层，改善下一次交互</p>
          </div>
        </div>
        <div className="text-xs text-text-secondary space-y-2">
          <p><strong>设计哲学：</strong>进化结果不是存在某个"配置页面"里，而是<strong className="text-text">散布在系统的每一层</strong>。用户感知到的是"整体变好了"，而不是"某个功能更新了"。</p>
          <div className="p-3 rounded bg-bg">
            <div className="font-medium text-text mb-2">进化成果注入的 5 个位置</div>
            <div className="space-y-2 text-[10px]">
              <div className="flex items-start gap-2 p-2 rounded border border-border">
                <span className="shrink-0 text-blue-400 font-mono font-bold mt-0.5">Layer 1</span>
                <div>
                  <strong className="text-text">IntentRouter 第1级</strong> -- LearnedPatterns 让意图路由越来越准
                  <div className="text-text-muted mt-0.5">效果："跑日报"从3秒(LLM判断)变成50毫秒(模式命中)</div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 rounded border border-border">
                <span className="shrink-0 text-green-400 font-mono font-bold mt-0.5">Layer 2</span>
                <div>
                  <strong className="text-text">RAG 检索重排序</strong> -- boost_weight 让常用知识自动置顶
                  <div className="text-text-muted mt-0.5">效果：新人问问题，第一个命中的就是团队最常用的文档</div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 rounded border border-border">
                <span className="shrink-0 text-amber-400 font-mono font-bold mt-0.5">Layer 3</span>
                <div>
                  <strong className="text-text">PromptAssembler 偏好层</strong> -- 用户模式注入 system prompt
                  <div className="text-text-muted mt-0.5">效果：AI 输出自动适配个人风格，无需手动设置</div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 rounded border border-border">
                <span className="shrink-0 text-purple-400 font-mono font-bold mt-0.5">Layer 4</span>
                <div>
                  <strong className="text-text">PromptAssembler 风险层</strong> -- 活跃风险主动注入
                  <div className="text-text-muted mt-0.5">效果：AI 在对话中主动提醒业务风险，不需要用户去看仪表盘</div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 rounded border border-border">
                <span className="shrink-0 text-cyan-400 font-mono font-bold mt-0.5">Layer 5</span>
                <div>
                  <strong className="text-text">工位洞察面板</strong> -- 效率/风险/建议主动推送
                  <div className="text-text-muted mt-0.5">效果：打开工位就看到"本周AI帮你省了3小时"+"2个高风险待处理"</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step 6: Memory Distillation & Playbook */}
      <div className="rounded-lg border border-cyan-500/20 bg-surface p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-cyan-500/15 flex items-center justify-center text-[11px] font-bold text-cyan-400">6</div>
          <div>
            <h4 className="text-sm font-semibold text-text">记忆蒸馏与 Playbook -- AI的"经验沉淀"</h4>
            <p className="text-[10px] text-text-muted">从对话中提炼可复用的工作模式，形成组织级知识资产</p>
          </div>
        </div>
        <div className="text-xs text-text-secondary space-y-2">
          <p><strong>设计哲学：</strong>行为信号捕捉的是"用户偏好"（个体），记忆蒸馏提炼的是"工作方法"（知识）。两者结合，AI 不仅知道你<strong className="text-text">喜欢什么格式</strong>，还知道你<strong className="text-text">如何解决问题</strong>。</p>

          {/* Three-layer memory architecture */}
          <div className="p-3 rounded bg-bg">
            <div className="font-medium text-text mb-2">三层记忆体系</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px]">
              <div className="p-2.5 rounded border border-blue-500/20 bg-blue-500/5">
                <div className="text-blue-400 font-medium mb-1">短期记忆 · 会话上下文</div>
                <div>当前对话的20条消息历史，保证对话连贯性。</div>
                <div className="text-text-muted mt-1">生命周期：当前会话</div>
              </div>
              <div className="p-2.5 rounded border border-amber-500/20 bg-amber-500/5">
                <div className="text-amber-400 font-medium mb-1">中期记忆 · 蒸馏摘要</div>
                <div>MemoryDistiller 从长对话中提炼关键信息：决策、偏好、待办事项。自动压缩冗余内容。</div>
                <div className="text-text-muted mt-1">生命周期：跨会话持久化</div>
              </div>
              <div className="p-2.5 rounded border border-purple-500/20 bg-purple-500/5">
                <div className="text-purple-400 font-medium mb-1">长期记忆 · Playbook</div>
                <div>从多次成功交互中蒸馏出的标准操作手册。包含触发条件、执行步骤、注意事项。</div>
                <div className="text-text-muted mt-1">生命周期：永久，可管理/删除</div>
              </div>
            </div>
          </div>

          {/* Memory Distillation Process */}
          <div className="p-3 rounded bg-bg">
            <div className="font-medium text-text mb-2">记忆蒸馏流程</div>
            <div className="space-y-2 text-[10px]">
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded border border-border p-2 text-center">
                  <div className="text-text-muted">原始对话</div>
                  <div className="text-text-secondary mt-0.5">用户与AI的50轮对话<br/>包含大量重复、闲聊、探索</div>
                </div>
                <ChevronRight size={14} className="text-cyan-400 shrink-0" />
                <div className="flex-1 rounded border border-cyan-500/20 bg-cyan-500/5 p-2 text-center">
                  <div className="text-cyan-400">MemoryDistiller</div>
                  <div className="text-text-secondary mt-0.5">LLM 提炼关键信息<br/>去噪、归纳、结构化</div>
                </div>
                <ChevronRight size={14} className="text-cyan-400 shrink-0" />
                <div className="flex-1 rounded border border-amber-500/20 bg-amber-500/5 p-2 text-center">
                  <div className="text-amber-400">蒸馏记忆</div>
                  <div className="text-text-secondary mt-0.5">"用户决定采用方案B"<br/>"下周三前需要完成报告"</div>
                </div>
              </div>
              <div className="p-2 rounded border border-green-500/10 bg-green-500/5">
                <div className="text-green-400 font-medium mb-0.5">Playbook 自动蒸馏</div>
                <div>当同类任务被成功处理 3+ 次，系统自动提炼为 Playbook：<br/>
                <strong className="text-text">"竞品分析"</strong> → 触发词 + 数据源选择 + 分析框架 + 输出格式 + 历史最佳实践</div>
              </div>
            </div>
          </div>

          {/* Feedback & Decay */}
          <div className="p-3 rounded bg-bg">
            <div className="font-medium text-text mb-2">反馈闭环与衰减机制</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
              <div className="p-2 rounded border border-green-500/20">
                <div className="text-green-400 font-medium mb-0.5">正反馈强化</div>
                <div>Playbook 被采纳 → 置信度+0.1 → 优先推荐</div>
                <div className="text-text-muted mt-0.5">用户越用，Playbook 排名越高</div>
              </div>
              <div className="p-2 rounded border border-red-500/20">
                <div className="text-red-400 font-medium mb-0.5">负反馈衰减</div>
                <div>Playbook 被拒绝/修改 → 置信度-0.15 → 降权或标记待修订</div>
                <div className="text-text-muted mt-0.5">30天无使用自动衰减，避免过时经验误导AI</div>
              </div>
            </div>
          </div>

          {/* Memory Management */}
          <div className="p-3 rounded bg-cyan-500/5 border border-cyan-500/10">
            <div className="text-cyan-400 font-medium text-[11px] mb-1">记忆管理</div>
            <div className="text-[10px]">
              用户可在设置中查看、编辑、删除已蒸馏的记忆和 Playbook。<strong className="text-text">AI 的记忆对用户完全透明可控</strong>，
              不是黑箱。管理员可以将优秀 Playbook 推广为团队级模板。
            </div>
          </div>
        </div>
      </div>

      {/* Complete Timeline Example */}
      <div className="rounded-xl border border-accent/30 bg-gradient-to-r from-accent/5 to-purple-500/5 p-5">
        <h4 className="text-sm font-semibold text-text mb-3">完整进化时间线：一个运营从入职到高效的30天</h4>
        <div className="space-y-3 text-xs text-text-secondary">
          <div className="flex items-start gap-3">
            <span className="shrink-0 px-2 py-0.5 rounded bg-bg text-text-muted font-mono text-[10px] w-16 text-center">Day 1</span>
            <div>
              <div className="text-text font-medium">冷启动期</div>
              <div className="text-[10px] mt-0.5">新人入职，分配"广告运营"岗位。AI是通用的 -- 回复格式默认、不了解个人偏好、不知道哪些知识重要。工位显示"冷启动引导"洞察。</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="shrink-0 px-2 py-0.5 rounded bg-bg text-text-muted font-mono text-[10px] w-16 text-center">Day 3</span>
            <div>
              <div className="text-text font-medium">信号积累</div>
              <div className="text-[10px] mt-0.5">系统已记录约30条行为信号。LearnedPatterns 记住了"查数据"→"数据查询工作流"的映射。引导层仍在（信号&lt;50条）。</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="shrink-0 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono text-[10px] w-16 text-center">Day 7</span>
            <div>
              <div className="text-amber-400 font-medium">首次凝练</div>
              <div className="text-[10px] mt-0.5">PatternEngine 完成首次模式凝练：output_format=markdown(0.75)。引导层消失（信号&gt;50条）。AI开始用Markdown格式回复。知识库中"填充率优化指南"boost_weight升至1.3。</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="shrink-0 px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 font-mono text-[10px] w-16 text-center">Day 14</span>
            <div>
              <div className="text-purple-400 font-medium">洞察启动</div>
              <div className="text-[10px] mt-0.5">InsightEngine 首次生成有效洞察："你的工作高峰在10:00-11:00"、"AI采纳率72%"。时间模式识别发现"每周五下午做周报"。意图路由命中率从40%提升到75%。</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="shrink-0 px-2 py-0.5 rounded bg-accent/10 text-accent font-mono text-[10px] w-16 text-center">Day 30</span>
            <div>
              <div className="text-accent font-medium">成熟期</div>
              <div className="text-[10px] mt-0.5">
                AI 已经完全适配该用户：意图路由命中率 90%+、偏好模式8个(confidence均&gt;0.8)、知识库权重完全按使用频率排序。
                用户感受：<strong className="text-text">"这个AI越来越懂我了，说什么它都能理解，给的建议也越来越靠谱。"</strong>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 p-3 rounded bg-accent/10 border border-accent/20">
          <p className="text-xs text-text leading-relaxed">
            <strong>核心洞察：</strong>这30天里，没有任何人写过一行"训练代码"，没有调过一个"配置参数"。
            用户只是正常工作，系统在后台完成了：<strong className="text-accent">152条信号采集 → 8个偏好模式 → 3条知识提权 → 12条意图映射 → 8层Prompt进化</strong>。
            这就是<strong className="text-accent">"静默进化"</strong>的力量。
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── 5. Key Scenarios ── */
function ScenariosSection() {
  const scenarios = [
    {
      num: '1',
      title: '晨会准备 — AI主动预警 + 知识库检索',
      subtitle: '核心能力：风险引擎 + RAG混合检索 + 工具自主调用',
      color: 'border-blue-500/30',
      highlight: '无需用户主动查询风险，AI基于业务信号自动预警',
      steps: [
        { role: 'user', text: '"帮我看看今天有什么需要关注的"' },
        { role: 'system', text: 'AI 调用 get_workstation_summary → 返回今日待办 + 进行中工作项 + 跟进事项' },
        { role: 'system', text: 'RiskEngine 检测到: 填充率连续3天下降(72%) → 标记"指标风险-高"' },
        { role: 'agent', text: '"今日有3项待办。注意: 填充率已连续3天下降(当前72%)，建议排查广告源配置。"' },
        { role: 'user', text: '"查一下广告SDK接入规范里关于填充率优化的内容"' },
        { role: 'system', text: 'RAG混合检索: BM25快筛"填充率" → 命中3篇文档 → 向量重排 → boost_weight自动+0.1' },
        { role: 'agent', text: '"根据规范文档第3.2节，填充率低于75%时建议: 1)检查瀑布流配置 2)增加备用广告源..."' },
      ]
    },
    {
      num: '2',
      title: '自然语言创建工作流 — 从描述到可执行',
      subtitle: '核心能力：AI工作流生成 + 可视化编辑 + 定时触发',
      color: 'border-green-500/30',
      highlight: '用自然语言描述需求，AI自动生成可编辑的DAG工作流',
      steps: [
        { role: 'user', text: '"帮我创建一个素材审核工作流：AI评估素材质量，70分以上自动通过，以下转人工审核"' },
        { role: 'system', text: 'AI 分析需求 → 生成工作流: 手动触发 → AI节点(质量评分) → IF条件(≥70?) → 通知/审批' },
        { role: 'agent', text: '"已生成工作流「素材审核」，包含4个节点。已自动跳转到可视化编辑器，你可以调整节点配置。"' },
        { role: 'user', text: '在编辑器中微调AI评分提示词 → 点击"立即执行"测试' },
        { role: 'system', text: '工作流按节点逐步执行，实时展示每个节点的输入输出和耗时' },
        { role: 'user', text: '"设为每天上午9点自动执行"' },
        { role: 'system', text: '创建定时触发器: cron 0 9 * * * → 持久化到数据库，服务重启不丢失' },
      ]
    },
    {
      num: '3',
      title: '智能文档处理 — 从原始文件到结构化输出',
      subtitle: '核心能力：34个内置工具 + 文件解析 + AI分析',
      color: 'border-amber-500/30',
      highlight: 'AI自主选择工具链，完成从文件解析到报告生成的全流程',
      steps: [
        { role: 'user', text: '上传一份Excel竞品数据 + "帮我分析竞品趋势并生成周报"' },
        { role: 'system', text: 'AI 调用 read_spreadsheet 解析Excel → 获取数据结构和内容' },
        { role: 'system', text: 'AI 调用 data_analysis 工具做趋势分析 → 识别关键变化点' },
        { role: 'agent', text: '"分析完成：3个竞品中，A品牌eCPM上涨15%，B品牌填充率下降8%。已生成趋势图表。"' },
        { role: 'user', text: '"输出为Word格式的周报"' },
        { role: 'system', text: 'AI 调用 create_document(format=docx) → 生成结构化周报文档' },
        { role: 'agent', text: '"周报已生成，包含数据表格、趋势图、分析结论和行动建议。点击下载。"' },
      ]
    },
    {
      num: '4',
      title: 'AI越用越懂你 — 偏好学习实战',
      subtitle: '核心能力：行为信号采集 + 模式凝练 + Prompt自适应',
      color: 'border-purple-500/30',
      highlight: '无需配置，AI从你的操作中自动学习工作偏好',
      steps: [
        { role: 'system', text: 'Day 1: 用户连续3次将AI输出的表格改成Markdown列表格式' },
        { role: 'system', text: 'SignalTracker 静默记录3条 edit 信号: format → markdown' },
        { role: 'system', text: 'PatternEngine 凝练模式: output_format=markdown (confidence: 0.78)' },
        { role: 'system', text: 'Day 2: 模式注入 PromptAssembler 偏好层 → AI 开始默认用 Markdown 回复' },
        { role: 'user', text: '"帮我分析今天的广告数据"' },
        { role: 'agent', text: 'AI 自动以 Markdown 列表格式输出，无需用户再调整' },
        { role: 'system', text: '用户直接采纳 → positive 信号 → confidence 升至 0.85 → 模式更稳定' },
      ]
    },
    {
      num: '5',
      title: 'Playbook蒸馏 — 经验沉淀为可复用模板',
      subtitle: '核心能力：记忆蒸馏 + Playbook管理 + Skill策略',
      color: 'border-cyan-500/30',
      highlight: '成功的工作方法被自动提炼为Playbook，AI下次遇到类似任务直接复用',
      steps: [
        { role: 'system', text: '用户第3次成功完成"竞品分析"任务，每次步骤相似：拉数据 → 对比 → 生成报告' },
        { role: 'system', text: 'MemoryDistiller 检测到重复模式 → 自动蒸馏为 Playbook "竞品分析流程"' },
        { role: 'system', text: 'Playbook 内容: 触发词["竞品","对比分析"] + 步骤[数据源→分析框架→输出格式] + 历史最佳实践' },
        { role: 'user', text: '"帮我做一下本周的竞品分析"' },
        { role: 'system', text: 'IntentRouter 命中 Playbook → Skill策略层注入执行方案 → AI按最佳实践执行' },
        { role: 'agent', text: 'AI 直接按照蒸馏的流程执行：拉取数据 → 多维对比 → Markdown周报，零试错' },
        { role: 'system', text: '用户采纳 → Playbook confidence +0.1 → 如被拒绝则 -0.15，自动衰减过时经验' },
      ]
    },
    {
      num: '6',
      title: '跨岗位协作 — 审批流 + 工作流联动',
      subtitle: '核心能力：审批节点 + 通知推送 + 权限隔离',
      color: 'border-red-500/30',
      highlight: '工作流中嵌入审批节点，实现跨角色的可控协作',
      steps: [
        { role: 'system', text: '运营发起"大额广告投放"工作流 → AI节点自动生成投放方案和预算分析' },
        { role: 'system', text: '工作流到达审批节点 → 状态暂停(waiting_for_approval) → 持久化到数据库' },
        { role: 'system', text: '通知节点推送消息给项目经理: "有一份投放方案待审批，预算 ¥50,000"' },
        { role: 'user', text: '项目经理在工位面板看到审批事项 → 查看方案详情' },
        { role: 'system', text: '项目经理点击"批准" → 审批节点恢复 → 工作流继续执行后续节点' },
        { role: 'agent', text: '"投放方案已获批准，工作流继续执行：自动配置广告位参数 → 生成投放报告"' },
        { role: 'system', text: '全流程操作日志可追溯：谁发起、谁审批、何时执行、结果如何' },
      ]
    },
  ]

  return (
    <div className="space-y-5">
      <SectionTitle title="场景实例" subtitle="六大核心场景，串联平台全部能力" />

      {scenarios.map(scenario => (
        <div key={scenario.num} className={`rounded-lg border ${scenario.color} bg-surface p-5`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-bold">
              {scenario.num}
            </span>
            <h4 className="text-sm font-semibold text-text">{scenario.title}</h4>
          </div>
          <div className="flex items-center gap-2 mb-3 ml-8">
            <span className="text-[10px] text-text-muted">{scenario.subtitle}</span>
          </div>
          <div className="ml-8 mb-3 p-2 rounded bg-accent/5 border border-accent/10">
            <span className="text-[10px] text-accent font-medium">亮点：{scenario.highlight}</span>
          </div>
          <div className="space-y-2">
            {scenario.steps.map((step, i) => (
              <div key={i} className={`flex gap-2 text-[11px] ${
                step.role === 'user' ? 'justify-end' : ''
              }`}>
                {step.role !== 'user' && (
                  <span className={`shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${
                    step.role === 'agent' ? 'bg-accent/15 text-accent' : 'bg-bg text-text-muted'
                  }`}>
                    {step.role === 'agent' ? 'AI' : '#'}
                  </span>
                )}
                <span className={`inline-block px-2.5 py-1.5 rounded-lg max-w-[85%] ${
                  step.role === 'user'
                    ? 'bg-accent/10 text-text'
                    : step.role === 'agent'
                      ? 'bg-bg text-text-secondary'
                      : 'bg-bg/50 text-text-muted italic'
                }`}>
                  {step.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── 6. Technical Highlights ── */
function TechSection() {
  return (
    <div className="space-y-5">
      <SectionTitle title="技术亮点" subtitle="每个设计选择背后的工程考量" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card icon={Server} title="轻量级工作流引擎">
          <p>自研引擎，<strong>零外部依赖</strong>（不依赖n8n/Temporal/Airflow）。</p>
          <div className="mt-1.5 space-y-0.5">
            <div>- 拓扑排序确定执行顺序，asyncio.gather 并行调度</div>
            <div>- 表达式引擎: {"{{ $input.item.x }}"} 跨节点数据引用</div>
            <div>- 审批暂停/恢复: 执行状态持久化到SQLite，服务重启不丢失</div>
            <div>- Pin Data: 调试时固定节点输出，跳过实际执行</div>
          </div>
        </Card>

        <Card icon={Bot} title="Prompt 动态组装">
          <p><strong>V23 精简为6层按需组装</strong>，约350-800 token，今日概况和风险改为工具按需获取：</p>
          <div className="mt-1.5 font-mono text-[10px] p-2 rounded bg-bg space-y-0.5">
            <div>Layer 1: 身份层 (role/goal/context 三要素)</div>
            <div>Layer 2: 操作指南 (工具调用判断原则)</div>
            <div>Layer 3: 知识层 (RAG检索结果，按需)</div>
            <div>Layer 4: 偏好层 (用户学习到的模式，按需)</div>
            <div>Layer 5: 引导层 (新手期额外提示，按需)</div>
            <div>Layer 6: Skill策略层 (匹配到的执行策略，按需)</div>
          </div>
          <p className="mt-1">工位概况/风险改为 get_workstation_summary / check_risks 工具按需获取，prompt 精简 50%。</p>
        </Card>

        <Card icon={BarChart3} title="混合检索 + 重排序">
          <p><strong>向量语义 + BM25关键词</strong>，取长补短：</p>
          <div className="mt-1.5 space-y-0.5">
            <div>- 向量检索: 理解"收入下降"和"营收减少"是同义</div>
            <div>- BM25检索: 精确匹配"eCPM"这样的专有名词</div>
            <div>- 加权融合: 向量0.7 + BM25 0.3</div>
            <div>- 结构化切分: Markdown标题感知、表格→自然语言转换</div>
          </div>
        </Card>

        <Card icon={Shield} title="企业级安全设计">
          <div className="space-y-0.5">
            <div>- <strong>JWT认证</strong>: Cookie + Bearer双模式</div>
            <div>- <strong>RBAC权限</strong>: superadmin/admin/member 三级</div>
            <div>- <strong>Webhook签名</strong>: HMAC-SHA256 防篡改</div>
            <div>- <strong>敏感头过滤</strong>: Authorization/Cookie不入日志</div>
            <div>- <strong>安全中间件</strong>: CORS + CSP + Rate Limit</div>
            <div>- <strong>审计日志</strong>: 关键操作全记录</div>
          </div>
        </Card>

        <Card icon={Layers} title="Profile-based 行业模板">
          <p><strong>一个目录 = 一个行业解决方案</strong></p>
          <div className="mt-1.5 font-mono text-[10px] p-2 rounded bg-bg">
            profiles/ad-monetization/<br/>
            &nbsp;&nbsp;positions/*.yaml&nbsp;&nbsp;&nbsp;# 15个岗位定义<br/>
            &nbsp;&nbsp;knowledge/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# 行业知识库<br/>
            &nbsp;&nbsp;workflows/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# 预置工作流<br/>
          </div>
          <p className="mt-1.5">新增行业: 复制目录 → 修改YAML → 部署完成</p>
        </Card>

        <Card icon={Zap} title="零外部依赖调度">
          <p><strong>纯asyncio实现</strong>，不依赖APScheduler/Celery/Redis：</p>
          <div className="mt-1.5 space-y-0.5">
            <div>- TriggerManager: 30秒轮询 + SQLite持久化</div>
            <div>- Cron解析器: 内置轻量实现，支持标准5字段</div>
            <div>- 自然语言→Cron: "每周五下午3点" → "0 15 * * 5"</div>
            <div>- 一次性延迟: "30分钟后" → once模式，自动执行后禁用</div>
          </div>
        </Card>
      </div>

      {/* Tech Stack */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <h4 className="text-sm font-semibold text-text mb-3">技术栈</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Backend', items: ['Python 3.11', 'aiohttp', 'aiosqlite'] },
            { label: 'Frontend', items: ['React 18', 'TypeScript', 'Vite', 'Tailwind'] },
            { label: 'AI/ML', items: ['Claude/GPT', 'bge-base-zh', 'ChromaDB', 'jieba'] },
            { label: 'Infra', items: ['SQLite', 'WebSocket', 'SSE', 'asyncio'] },
          ].map(group => (
            <div key={group.label}>
              <div className="text-[10px] font-medium text-text-muted mb-1.5">{group.label}</div>
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <div key={item} className="text-xs text-text-secondary">{item}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
