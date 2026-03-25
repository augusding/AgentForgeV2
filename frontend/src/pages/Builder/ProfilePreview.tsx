import { useEffect, useState } from 'react'
import { useBuilderStore } from '../../stores/useBuilderStore'
import {
  FileCode, Users, Zap, Clock, Shield, BookOpen,
  AlertTriangle, AlertCircle, ChevronDown, ChevronRight,
  ArrowRight, ArrowLeft, LayoutGrid, Code,
} from 'lucide-react'
import AgentReviewPanel from './AgentReviewPanel'

type Tab = 'agents' | 'workflows' | 'profile' | 'squads' | 'heartbeats' | 'guardrails' | 'knowledge'

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'agents', label: 'Agents', icon: <Users size={14} /> },
  { key: 'workflows', label: '工作流', icon: <Zap size={14} /> },
  { key: 'profile', label: 'Profile', icon: <FileCode size={14} /> },
  { key: 'squads', label: '小队', icon: <Users size={14} /> },
  { key: 'heartbeats', label: '定时任务', icon: <Clock size={14} /> },
  { key: 'guardrails', label: '护栏', icon: <Shield size={14} /> },
  { key: 'knowledge', label: '知识库', icon: <BookOpen size={14} /> },
]

export default function ProfilePreview() {
  const { preview, issues, loadPreview, session } = useBuilderStore()
  const [activeTab, setActiveTab] = useState<Tab>('agents')
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)
  const [agentViewMode, setAgentViewMode] = useState<'card' | 'yaml'>('card')
  const isReviewPhase = session?.phase === 'review'

  useEffect(() => {
    if (!preview) loadPreview()
  }, [])

  if (!preview) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
        <span className="ml-2 text-sm text-text-secondary">加载配置预览...</span>
      </div>
    )
  }

  const errors = issues.filter(i => i.level === 'error')
  const warnings = issues.filter(i => i.level === 'warning')

  return (
    <div>
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard label="Agents" value={Object.keys(preview.agents).length} />
        <StatCard label="Workflows" value={Object.keys(preview.workflows).length} />
        <StatCard label="Errors" value={errors.length} variant={errors.length > 0 ? 'danger' : 'default'} />
        <StatCard label="Warnings" value={warnings.length} variant={warnings.length > 0 ? 'warning' : 'default'} />
      </div>

      {/* Validation issues */}
      {issues.length > 0 && (
        <div className="mb-4 p-3 bg-surface border border-border rounded-lg">
          <h3 className="text-sm font-medium text-text mb-2">校验结果</h3>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                {issue.level === 'error' ? (
                  <AlertCircle size={12} className="text-danger mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle size={12} className="text-warning mt-0.5 shrink-0" />
                )}
                <span className="text-text-secondary">
                  <span className="font-medium text-text">{issue.field}</span>: {issue.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto border-b border-border">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-accent text-accent font-medium'
                : 'border-transparent text-text-secondary hover:text-text'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.key === 'agents' && (
              <span className="text-xs opacity-60">({Object.keys(preview.agents).length})</span>
            )}
            {tab.key === 'workflows' && (
              <span className="text-xs opacity-60">({Object.keys(preview.workflows).length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={activeTab === 'agents' && agentViewMode === 'card' ? '' : 'border border-border rounded-lg overflow-hidden'}>
        {activeTab === 'agents' && (
          <>
            {/* View mode toggle */}
            <div className="flex items-center justify-end gap-1 mb-3">
              <button
                onClick={() => setAgentViewMode('card')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${
                  agentViewMode === 'card'
                    ? 'bg-accent/10 text-accent font-medium'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                <LayoutGrid size={12} /> 卡片
              </button>
              <button
                onClick={() => setAgentViewMode('yaml')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${
                  agentViewMode === 'yaml'
                    ? 'bg-accent/10 text-accent font-medium'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                <Code size={12} /> YAML
              </button>
            </div>

            {/* Card view (default in review phase) */}
            {agentViewMode === 'card' ? (
              isReviewPhase ? (
                <AgentReviewPanel />
              ) : (
                <AgentReviewPanel />
              )
            ) : (
              /* YAML view (original) */
              <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                {Object.entries(preview.agents).map(([aid, yaml]) => (
                  <div key={aid}>
                    <button
                      onClick={() => setExpandedAgent(expandedAgent === aid ? null : aid)}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-surface-hover transition-colors"
                    >
                      {expandedAgent === aid ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span className="font-medium text-accent">{aid}</span>
                      <span className="text-text-muted text-xs ml-auto">{yaml.length} bytes</span>
                    </button>
                    {expandedAgent === aid && (
                      <pre className="px-4 py-3 bg-bg text-xs text-text-secondary overflow-x-auto whitespace-pre border-t border-border font-mono">
                        {yaml}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'workflows' && (
          <div className="divide-y divide-border">
            {Object.entries(preview.workflows).map(([name, yaml]) => (
              <div key={name}>
                <button
                  onClick={() => setExpandedAgent(expandedAgent === name ? null : name)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-surface-hover transition-colors"
                >
                  {expandedAgent === name ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <Zap size={14} className="text-accent" />
                  <span className="font-medium text-text">{name}</span>
                </button>
                {expandedAgent === name && (
                  <pre className="px-4 py-3 bg-bg text-xs text-text-secondary overflow-x-auto whitespace-pre border-t border-border font-mono">
                    {yaml}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}

        {(activeTab === 'profile' || activeTab === 'squads' || activeTab === 'heartbeats' || activeTab === 'guardrails') && (
          <pre className="p-4 bg-bg text-xs text-text-secondary overflow-x-auto whitespace-pre font-mono">
            {activeTab === 'profile' && preview.profile_yaml}
            {activeTab === 'squads' && preview.squads_yaml}
            {activeTab === 'heartbeats' && preview.heartbeats_yaml}
            {activeTab === 'guardrails' && preview.guardrails_yaml}
          </pre>
        )}

        {activeTab === 'knowledge' && (
          <div className="divide-y divide-border">
            {preview.knowledge_docs.length > 0 ? preview.knowledge_docs.map((doc, i) => (
              <div key={i} className="p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-text mb-2">
                  <BookOpen size={14} className="text-accent" />
                  {doc.name}
                </div>
                <pre className="bg-bg rounded p-3 text-xs text-text-secondary whitespace-pre-wrap font-mono">
                  {doc.content}
                </pre>
              </div>
            )) : (
              <div className="p-8 text-center text-sm text-text-muted">暂无知识库文档</div>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3 mt-6">
        <NextPhaseButton />
      </div>
    </div>
  )
}

function NextPhaseButton() {
  const { session, goToPhase } = useBuilderStore()
  const store = useBuilderStore()

  if (session?.phase === 'review') {
    return (
      <>
        <button
          onClick={() => goToPhase('intake')}
          className="flex items-center gap-1.5 px-4 py-2 text-sm border border-border rounded-lg hover:bg-surface-hover transition-colors text-text mr-auto"
        >
          <ArrowLeft size={14} />
          返回信息采集
        </button>
        <button
          onClick={() => store.triggerFinalize()}
          className="flex items-center gap-1.5 px-4 py-2 text-sm border border-border rounded-lg hover:bg-surface-hover transition-colors text-text"
        >
          跳过校准，直接定稿
        </button>
        <button
          onClick={() => goToPhase('calibration')}
          className="flex items-center gap-2 px-5 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
        >
          进入校准
          <ArrowRight size={14} />
        </button>
      </>
    )
  }

  return null
}

function StatCard({ label, value, variant = 'default' }: { label: string; value: number; variant?: 'default' | 'danger' | 'warning' }) {
  const colorCls =
    variant === 'danger' && value > 0 ? 'text-danger' :
    variant === 'warning' && value > 0 ? 'text-warning' : 'text-accent'

  return (
    <div className="p-3 bg-surface border border-border rounded-lg text-center">
      <div className={`text-2xl font-bold ${colorCls}`}>{value}</div>
      <div className="text-xs text-text-muted mt-0.5">{label}</div>
    </div>
  )
}
