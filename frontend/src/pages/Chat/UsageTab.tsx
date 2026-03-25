import { useState, useEffect } from 'react'
import { fetchSessionUsage, fetchDailyUsage } from '../../api/analytics'
import { useChatStore } from '../../stores/useChatStore'
import { formatTokenCount } from '../../utils/formatToken'
import type { UsageEntry, DailyUsage } from '../../api/analytics'

const CAP_LABELS: Record<string, string> = {
  knowledge_retrieval: '知识检索',
  content_generation: '内容生成',
  data_analysis: '数据分析',
  tool_invocation: '工具调用',
  chat: '闲聊/澄清',
}

const CAP_COLORS: Record<string, string> = {
  knowledge_retrieval: 'bg-blue-500',
  content_generation: 'bg-emerald-500',
  data_analysis: 'bg-amber-500',
  tool_invocation: 'bg-purple-500',
  chat: 'bg-gray-400',
}

export default function UsageTab() {
  const sessionId = useChatStore(s => s.sessionId)
  const [sessionUsage, setSessionUsage] = useState<UsageEntry[]>([])
  const [daily, setDaily] = useState<DailyUsage | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchSessionUsage(sessionId).catch(() => []),
      fetchDailyUsage().catch(() => null),
    ]).then(([su, d]) => {
      if (cancelled) return
      setSessionUsage(su)
      setDaily(d)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [sessionId])

  if (loading) {
    return <div className="p-4 text-xs text-text-muted text-center py-8">加载中...</div>
  }

  // Session capability breakdown
  const capMap: Record<string, { tokens: number; count: number }> = {}
  let sessionTokens = 0
  for (const entry of sessionUsage) {
    const cap = entry.capability
    if (!capMap[cap]) capMap[cap] = { tokens: 0, count: 0 }
    capMap[cap].tokens += entry.tokens_used
    capMap[cap].count += 1
    sessionTokens += entry.tokens_used
  }

  // Sort by tokens descending
  const capEntries = Object.entries(capMap).sort((a, b) => b[1].tokens - a[1].tokens)

  return (
    <div className="p-4 space-y-5">
      {/* Session usage */}
      <section>
        <h4 className="text-[11px] font-medium text-text-muted uppercase tracking-wide mb-1">
          本次对话
        </h4>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-2xl font-bold text-primary font-mono">
            {formatTokenCount(sessionTokens)}
          </span>
          <span className="text-sm text-text-muted">tokens</span>
        </div>
        <div className="text-[11px] text-text-muted">
          {sessionUsage.length} 轮对话
          {sessionUsage.length > 0 && (
            <span> · 平均 {formatTokenCount(Math.round(sessionTokens / sessionUsage.length))}/轮</span>
          )}
        </div>
      </section>

      {/* Capability distribution */}
      {capEntries.length > 0 && (
        <section>
          <h4 className="text-[11px] font-medium text-text-muted uppercase tracking-wide mb-2">
            按能力分布
          </h4>
          <div className="space-y-2">
            {capEntries.map(([cap, info]) => {
              const pct = sessionTokens > 0 ? (info.tokens / sessionTokens) * 100 : 0
              return (
                <div key={cap}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="text-text-secondary">{CAP_LABELS[cap] || cap}</span>
                    <span className="text-text-muted font-mono">{Math.round(pct)}%</span>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${CAP_COLORS[cap] || 'bg-accent'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Daily summary */}
      {daily && (
        <section>
          <h4 className="text-[11px] font-medium text-text-muted uppercase tracking-wide mb-2">
            今日汇总
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-surface rounded px-2.5 py-1.5">
              <div className="text-[10px] text-text-muted">总消耗</div>
              <div className="text-sm font-bold text-accent font-mono">{formatTokenCount(daily.total_tokens)}</div>
            </div>
            <div className="bg-surface rounded px-2.5 py-1.5">
              <div className="text-[10px] text-text-muted">对话数</div>
              <div className="text-sm font-bold text-text font-mono">{daily.total_sessions}</div>
            </div>
            <div className="bg-surface rounded px-2.5 py-1.5">
              <div className="text-[10px] text-text-muted">AI 回复</div>
              <div className="text-sm font-bold text-text font-mono">{daily.total_messages}</div>
            </div>
            {daily.total_messages > 0 && (
              <div className="bg-surface rounded px-2.5 py-1.5">
                <div className="text-[10px] text-text-muted">平均/条</div>
                <div className="text-sm font-bold text-text font-mono">
                  {formatTokenCount(Math.round(daily.total_tokens / daily.total_messages))}
                </div>
              </div>
            )}
          </div>

          {/* Daily capability breakdown */}
          {Object.keys(daily.by_capability).length > 0 && (
            <div className="mt-3 space-y-1">
              {Object.entries(daily.by_capability)
                .sort((a, b) => b[1].tokens - a[1].tokens)
                .map(([cap, info]) => (
                  <div key={cap} className="flex items-center justify-between text-[11px]">
                    <span className="text-text-secondary">{CAP_LABELS[cap] || cap}</span>
                    <span className="text-text-muted">
                      {formatTokenCount(info.tokens)} · {info.count}次
                    </span>
                  </div>
                ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
