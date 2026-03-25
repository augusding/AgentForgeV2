/**
 * 用户行为信号追踪 — 隐式反馈采集
 *
 * 自动记录用户行为信号（无感知），用于「越用越聪明」的模式学习。
 * 信号类型：
 *  - positive: 用户采纳了 AI 建议（直接使用）
 *  - negative: 用户忽略了 AI 建议（重新提问）
 *  - edit: 用户修改后采纳（有 diff）
 *  - override: 用户手动修正工作流输出
 *  - priority: 用户对聚焦项的操作（点击/跳过）
 *  - insight: 用户对洞察的操作（采纳/忽略）
 */

import { recordSignal } from '../api/workstation'

/** Debounced signal sender to avoid flooding */
let pendingSignals: Array<{
  signal_type: string
  context_type?: string
  context_id?: string
  detail?: Record<string, any>
}> = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function flushSignals() {
  const batch = pendingSignals.splice(0, pendingSignals.length)
  for (const signal of batch) {
    recordSignal(signal).catch(() => {})
  }
  flushTimer = null
}

function enqueueSignal(signal: {
  signal_type: string
  context_type?: string
  context_id?: string
  detail?: Record<string, any>
}) {
  pendingSignals.push(signal)
  if (!flushTimer) {
    flushTimer = setTimeout(flushSignals, 2000) // Batch every 2s
  }
}

/** Track that user adopted AI response (used it directly) */
export function trackAdoption(contextType: string, contextId?: string) {
  enqueueSignal({
    signal_type: 'positive',
    context_type: contextType,
    context_id: contextId,
  })
}

/** Track that user ignored/skipped AI response */
export function trackIgnored(contextType: string, contextId?: string) {
  enqueueSignal({
    signal_type: 'negative',
    context_type: contextType,
    context_id: contextId,
  })
}

/** Track that user edited AI output before using */
export function trackEdit(contextType: string, diff?: string, contextId?: string) {
  enqueueSignal({
    signal_type: 'edit',
    context_type: contextType,
    context_id: contextId,
    detail: diff ? { diff: diff.slice(0, 500) } : undefined,
  })
}

/** Track workflow parameter override */
export function trackParamOverride(workflowId: string, paramKey: string, newValue: string) {
  enqueueSignal({
    signal_type: 'override',
    context_type: 'workflow',
    context_id: workflowId,
    detail: { param_key: paramKey, new_value: newValue },
  })
}

/** Track focus item interaction */
export function trackFocusClick(itemId: string, itemType: string) {
  enqueueSignal({
    signal_type: 'priority',
    context_type: 'focus',
    context_id: itemId,
    detail: { item_type: itemType },
  })
}

/** Track insight interaction */
export function trackInsightAction(insightType: string, action: 'adopt' | 'dismiss') {
  enqueueSignal({
    signal_type: 'insight',
    context_type: 'insight',
    detail: { insight_type: insightType, action },
  })
}
