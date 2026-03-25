import { useState, useEffect, useCallback } from 'react'
import { Trash2, RefreshCw, BookOpen, AlertTriangle } from 'lucide-react'
import client from '../../api/client'

interface PlaybookRule {
  id: string
  rule: string
  context: string
  confidence: number
  applied_count: number
  success_count: number
  status: string
  created_at: string
  updated_at: string
}

export default function PlaybookManagement() {
  const [rules, setRules] = useState<PlaybookRule[]>([])
  const [agentId, setAgentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchRules = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await client.get('/playbook/rules')
      setRules(res.rules || [])
      setAgentId(res.agent_id || '')
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRules() }, [fetchRules])

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除该经验规则？删除后不可恢复。')) return
    setDeleting(id)
    try {
      await client.delete(`/playbook/rules/${id}`)
      setRules(prev => prev.filter(r => r.id !== id))
    } catch {
      // error handled by client interceptor
    } finally {
      setDeleting(null)
    }
  }

  const confidenceColor = (c: number) => {
    if (c >= 0.8) return 'text-green-600'
    if (c >= 0.5) return 'text-yellow-600'
    return 'text-red-500'
  }

  const statusLabel = (s: string) => {
    if (s === 'active') return { text: '生效中', cls: 'bg-green-100 text-green-700' }
    if (s === 'deprecated') return { text: '已淘汰', cls: 'bg-gray-100 text-gray-500' }
    return { text: s, cls: 'bg-gray-100 text-gray-500' }
  }

  const activeRules = rules.filter(r => r.status === 'active')
  const deprecatedRules = rules.filter(r => r.status !== 'active')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BookOpen size={20} />
            Playbook 经验规则
          </h2>
          <p className="text-sm text-text-muted mt-1">
            AI 在工作中自动积累的经验规则，影响后续回答质量。置信度低的规则会被自动淘汰。
          </p>
          {agentId && (
            <p className="text-xs text-text-muted mt-1">当前岗位: {agentId}</p>
          )}
        </div>
        <button
          onClick={fetchRules}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-bg transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          刷新
        </button>
      </div>

      {loading && rules.length === 0 ? (
        <div className="text-center text-text-muted py-12">加载中...</div>
      ) : rules.length === 0 ? (
        <div className="text-center text-text-muted py-12">
          <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
          <p>暂无经验规则</p>
          <p className="text-xs mt-1">AI 会在与你的交互中自动积累经验</p>
        </div>
      ) : (
        <>
          {/* Active rules */}
          {activeRules.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-text-muted">
                生效中 ({activeRules.length})
              </h3>
              {activeRules.map(rule => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  onDelete={handleDelete}
                  deleting={deleting === rule.id}
                  confidenceColor={confidenceColor}
                  statusLabel={statusLabel}
                />
              ))}
            </div>
          )}

          {/* Deprecated rules */}
          {deprecatedRules.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-text-muted flex items-center gap-1.5">
                <AlertTriangle size={14} />
                已淘汰 ({deprecatedRules.length})
              </h3>
              {deprecatedRules.map(rule => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  onDelete={handleDelete}
                  deleting={deleting === rule.id}
                  confidenceColor={confidenceColor}
                  statusLabel={statusLabel}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function RuleCard({
  rule,
  onDelete,
  deleting,
  confidenceColor,
  statusLabel,
}: {
  rule: PlaybookRule
  onDelete: (id: string) => void
  deleting: boolean
  confidenceColor: (c: number) => string
  statusLabel: (s: string) => { text: string; cls: string }
}) {
  const sl = statusLabel(rule.status)
  const successRate = rule.applied_count > 0
    ? Math.round((rule.success_count / rule.applied_count) * 100)
    : 0

  return (
    <div className={`border border-border rounded-lg p-4 ${rule.status !== 'active' ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-relaxed">{rule.rule}</p>
          {rule.context && (
            <p className="text-xs text-text-muted mt-1">场景: {rule.context}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
            <span className={`font-medium ${confidenceColor(rule.confidence)}`}>
              置信度 {Math.round(rule.confidence * 100)}%
            </span>
            <span>验证 {rule.applied_count} 次</span>
            {rule.applied_count > 0 && (
              <span>成功率 {successRate}%</span>
            )}
            <span className={`px-1.5 py-0.5 rounded text-xs ${sl.cls}`}>{sl.text}</span>
          </div>
        </div>
        <button
          onClick={() => onDelete(rule.id)}
          disabled={deleting}
          className="shrink-0 p-1.5 text-text-muted hover:text-red-500 hover:bg-red-50 rounded transition-colors"
          title="删除规则"
        >
          <Trash2 size={15} className={deleting ? 'animate-pulse' : ''} />
        </button>
      </div>
    </div>
  )
}
