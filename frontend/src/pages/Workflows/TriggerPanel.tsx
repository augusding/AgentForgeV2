/**
 * TriggerPanel -- workflow trigger management panel.
 *
 * Two modes:
 * 1. With workflowId (in VisualEditor) — triggers scoped to that workflow
 * 2. Without workflowId (in Workflows index "triggers" tab) — all triggers, with workflow selector
 */
import { useEffect, useState, useCallback } from 'react'
import {
  Clock, Webhook, Play, Pause, Trash2, Plus, Copy,
  Loader2, RefreshCw, Zap, GitBranch,
} from 'lucide-react'
import {
  listTriggers, createTrigger, deleteTrigger,
  pauseTrigger, resumeTrigger, executeTrigger,
  listWorkflows,
  type WFTrigger, type WFWorkflow,
} from '../../api/workflow'
import toast from 'react-hot-toast'
import dayjs from 'dayjs'

interface Props {
  workflowId?: string
  workflowName?: string
  className?: string
}

const TYPE_ICONS: Record<string, typeof Clock> = {
  schedule: Clock,
  webhook: Webhook,
  once: Zap,
  manual: Play,
}

export default function TriggerPanel({ workflowId, workflowName, className = '' }: Props) {
  const [triggers, setTriggers] = useState<WFTrigger[]>([])
  const [workflows, setWorkflows] = useState<WFWorkflow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  // 是否为独立模式（无 workflowId，需要用户选择工作流）
  const standalone = !workflowId

  // Form state
  const [selectedWfId, setSelectedWfId] = useState('')
  const [addType, setAddType] = useState<'schedule' | 'webhook'>('schedule')
  const [scheduleText, setScheduleText] = useState('')
  const [cronExpr, setCronExpr] = useState('0 9 * * *')
  const [webhookPath, setWebhookPath] = useState('')
  const [webhookMethod, setWebhookMethod] = useState('POST')
  const [creating, setCreating] = useState(false)

  // 工作流名称映射 (用于列表显示)
  const wfNameMap = useCallback(() => {
    const map: Record<string, string> = {}
    for (const wf of workflows) map[wf.id] = wf.name
    return map
  }, [workflows])

  const load = useCallback(async () => {
    try {
      const [triggerList, wfList] = await Promise.all([
        listTriggers(workflowId),
        standalone ? listWorkflows() : Promise.resolve([]),
      ])
      setTriggers(triggerList)
      if (standalone) setWorkflows(wfList)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [workflowId, standalone])

  useEffect(() => { load() }, [load])

  const getTargetWfId = () => workflowId || selectedWfId
  const getTargetWfName = () => {
    if (workflowName) return workflowName
    const wf = workflows.find(w => w.id === selectedWfId)
    return wf?.name || 'Workflow'
  }

  const handleCreate = async () => {
    const targetWfId = getTargetWfId()
    if (!targetWfId) {
      toast.error('请先选择要绑定的工作流')
      return
    }
    const targetName = getTargetWfName()

    setCreating(true)
    try {
      if (addType === 'schedule') {
        if (scheduleText.trim()) {
          await createTrigger({
            workflow_id: targetWfId,
            type: 'schedule',
            name: `${targetName} - 定时`,
            text: scheduleText.trim(),
            created_by: 'editor',
          })
        } else {
          await createTrigger({
            workflow_id: targetWfId,
            type: 'schedule',
            name: `${targetName} - 定时`,
            rule: 'cron',
            cron_expression: cronExpr,
            created_by: 'editor',
          })
        }
      } else {
        if (!webhookPath.trim()) {
          toast.error('请输入 Webhook 路径')
          setCreating(false)
          return
        }
        await createTrigger({
          workflow_id: targetWfId,
          type: 'webhook',
          name: `${targetName} - Webhook`,
          webhook_path: webhookPath.trim(),
          webhook_method: webhookMethod,
          created_by: 'editor',
        })
      }
      toast.success('触发器创建成功')
      setShowAdd(false)
      setScheduleText('')
      setSelectedWfId('')
      await load()
    } catch (e: any) {
      toast.error(e?.message || '创建失败')
    } finally {
      setCreating(false)
    }
  }

  const handlePauseResume = async (trg: WFTrigger) => {
    try {
      if (trg.enabled) {
        await pauseTrigger(trg.id)
        toast.success(`已暂停: ${trg.name}`)
      } else {
        await resumeTrigger(trg.id)
        toast.success(`已恢复: ${trg.name}`)
      }
      await load()
    } catch {
      toast.error('操作失败')
    }
  }

  const handleDelete = async (trg: WFTrigger) => {
    if (!confirm(`确定删除触发器「${trg.name}」?`)) return
    try {
      await deleteTrigger(trg.id)
      toast.success('已删除')
      await load()
    } catch {
      toast.error('删除失败')
    }
  }

  const handleExecuteNow = async (trg: WFTrigger) => {
    try {
      await executeTrigger(trg.id)
      toast.success('已触发执行')
      setTimeout(load, 2000)
    } catch {
      toast.error('执行失败')
    }
  }

  const copyWebhookUrl = (path: string) => {
    const url = `${window.location.origin}/api/v1/webhooks${path.startsWith('/') ? path : '/' + path}`
    navigator.clipboard.writeText(url)
    toast.success('Webhook URL 已复制')
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <Loader2 size={20} className="animate-spin text-text-muted" />
      </div>
    )
  }

  const nameMap = wfNameMap()

  return (
    <div className={`bg-surface border border-border rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-accent" />
          <span className="text-sm font-medium text-text">触发器</span>
          <span className="text-xs text-text-muted">({triggers.length})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={load}
            className="p-1.5 text-text-muted hover:text-text rounded transition-colors"
            title="刷新"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-accent text-white rounded hover:bg-accent/90 transition-colors"
          >
            <Plus size={12} /> 添加
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="px-4 py-3 border-b border-border bg-bg space-y-3">

          {/* Workflow Selector (standalone mode only) */}
          {standalone && (
            <div>
              <label className="block text-xs text-text-muted mb-1">选择工作流 *</label>
              <select
                value={selectedWfId}
                onChange={e => setSelectedWfId(e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded focus:border-accent focus:outline-none"
              >
                <option value="">-- 请选择工作流 --</option>
                {workflows.map(wf => (
                  <option key={wf.id} value={wf.id}>
                    {wf.name}{wf.active ? '' : ' (未激活)'}
                  </option>
                ))}
              </select>
              {workflows.length === 0 && (
                <p className="text-xs text-text-muted mt-1">
                  暂无工作流，请先在「全部工作流」中创建
                </p>
              )}
            </div>
          )}

          {/* Type Toggle */}
          <div className="flex gap-1">
            <button
              onClick={() => setAddType('schedule')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                addType === 'schedule'
                  ? 'bg-accent text-white'
                  : 'bg-surface text-text-muted hover:text-text'
              }`}
            >
              <Clock size={12} className="inline mr-1" />
              定时
            </button>
            <button
              onClick={() => setAddType('webhook')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                addType === 'webhook'
                  ? 'bg-accent text-white'
                  : 'bg-surface text-text-muted hover:text-text'
              }`}
            >
              <Webhook size={12} className="inline mr-1" />
              Webhook
            </button>
          </div>

          {addType === 'schedule' ? (
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-text-muted mb-1">
                  自然语言 (如"每天上午9点"、"每周一10点")
                </label>
                <input
                  type="text"
                  value={scheduleText}
                  onChange={e => setScheduleText(e.target.value)}
                  placeholder="输入中文时间描述 / 留空使用 Cron"
                  className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded focus:border-accent focus:outline-none"
                />
              </div>
              {!scheduleText && (
                <div>
                  <label className="block text-xs text-text-muted mb-1">Cron 表达式</label>
                  <input
                    type="text"
                    value={cronExpr}
                    onChange={e => setCronExpr(e.target.value)}
                    placeholder="0 9 * * *"
                    className="w-full px-3 py-1.5 text-sm font-mono bg-surface border border-border rounded focus:border-accent focus:outline-none"
                  />
                  <p className="text-xs text-text-muted mt-1">分 时 日 月 周</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-text-muted mb-1">Webhook 路径</label>
                <input
                  type="text"
                  value={webhookPath}
                  onChange={e => setWebhookPath(e.target.value)}
                  placeholder="/my-webhook"
                  className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">方法</label>
                <select
                  value={webhookMethod}
                  onChange={e => setWebhookMethod(e.target.value)}
                  className="px-3 py-1.5 text-sm bg-surface border border-border rounded focus:border-accent focus:outline-none"
                >
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 text-xs text-text-muted hover:text-text transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || (standalone && !selectedWfId)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-accent text-white rounded hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {creating && <Loader2 size={12} className="animate-spin" />}
              创建
            </button>
          </div>
        </div>
      )}

      {/* Trigger List */}
      {triggers.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-text-muted">
          暂无触发器。
          {standalone ? ' 点击「添加」为工作流创建定时或 Webhook 触发器。' : ' 点击「添加」创建。'}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {triggers.map(trg => {
            const Icon = TYPE_ICONS[trg.type] || Clock
            // 独立模式下显示绑定的工作流名称
            const boundWfName = standalone ? (nameMap[trg.workflow_id] || trg.workflow_id.slice(0, 8)) : null
            return (
              <div
                key={trg.id}
                className={`px-4 py-3 flex items-center gap-3 ${
                  !trg.enabled ? 'opacity-60' : ''
                }`}
              >
                {/* Icon */}
                <div className={`p-1.5 rounded ${trg.enabled ? 'bg-accent/10 text-accent' : 'bg-bg text-text-muted'}`}>
                  <Icon size={14} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-text truncate">{trg.name}</span>
                    {boundWfName && (
                      <span className="flex items-center gap-0.5 text-[10px] text-text-muted bg-bg px-1.5 py-0.5 rounded shrink-0">
                        <GitBranch size={10} />
                        {boundWfName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {trg.type === 'schedule' && (
                      <code className="text-xs bg-bg px-1.5 py-0.5 rounded text-text-secondary">
                        {trg.rule === 'cron' ? trg.cron_expression : `每 ${trg.interval_minutes} 分钟`}
                      </code>
                    )}
                    {trg.type === 'webhook' && (
                      <code className="text-xs bg-bg px-1.5 py-0.5 rounded text-text-secondary">
                        {trg.webhook_method} {trg.webhook_path}
                      </code>
                    )}
                    {trg.type === 'once' && trg.run_at > 0 && (
                      <span className="text-xs text-text-muted">
                        {dayjs.unix(trg.run_at).format('MM-DD HH:mm')}
                      </span>
                    )}
                    {trg.run_count > 0 && (
                      <span className="text-xs text-text-muted">
                        {trg.run_count} 次
                      </span>
                    )}
                    {trg.last_status && (
                      <span className={`text-xs ${trg.last_status === 'success' ? 'text-success' : 'text-error'}`}>
                        {trg.last_status === 'success' ? '成功' : '失败'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Next Run */}
                {trg.next_run > 0 && trg.enabled && (
                  <div className="text-right shrink-0">
                    <div className="text-xs text-text-muted">下次</div>
                    <div className="text-xs text-text-secondary">
                      {dayjs.unix(trg.next_run).format('MM-DD HH:mm')}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-0.5 shrink-0">
                  {trg.type === 'webhook' && (
                    <button
                      onClick={() => copyWebhookUrl(trg.webhook_path)}
                      className="p-1.5 text-text-muted hover:text-text rounded transition-colors"
                      title="复制 URL"
                    >
                      <Copy size={13} />
                    </button>
                  )}
                  <button
                    onClick={() => handleExecuteNow(trg)}
                    className="p-1.5 text-text-muted hover:text-accent rounded transition-colors"
                    title="立即执行"
                  >
                    <Play size={13} />
                  </button>
                  <button
                    onClick={() => handlePauseResume(trg)}
                    className="p-1.5 text-text-muted hover:text-amber-400 rounded transition-colors"
                    title={trg.enabled ? '暂停' : '恢复'}
                  >
                    {trg.enabled ? <Pause size={13} /> : <RefreshCw size={13} />}
                  </button>
                  <button
                    onClick={() => handleDelete(trg)}
                    className="p-1.5 text-text-muted hover:text-danger rounded transition-colors"
                    title="删除"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
