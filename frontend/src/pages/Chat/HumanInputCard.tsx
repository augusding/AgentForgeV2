/**
 * HumanInputCard — 人工输入节点表单卡片
 *
 * DAG 执行遇到 type="human_input" 节点时展示。
 * 根据 input_schema 动态渲染表单字段，提交后恢复工作流。
 */
import { useState } from 'react'
import { ClipboardEdit, Send, Loader2, CheckCircle, XCircle, Ban } from 'lucide-react'
import type { HumanInputRequest } from '../../types/chat'
import { submitHumanInput, cancelHumanInput } from '../../api/humanInput'

interface Props {
  request: HumanInputRequest
  onSubmitted?: () => void
  onCancelled?: () => void
}

export default function HumanInputCard({ request, onSubmitted, onCancelled }: Props) {
  const isPending = request.status === 'pending'
  const isCancelled = request.status === 'cancelled'
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {}
    for (const field of request.input_schema) {
      defaults[field.name] = field.default || ''
    }
    return defaults
  })
  const [submitting, setSubmitting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')

  const updateField = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async () => {
    // Validate required fields
    for (const field of request.input_schema) {
      if (field.required && !formData[field.name]?.trim()) {
        setError(`"${field.label}" 为必填项`)
        return
      }
    }

    setSubmitting(true)
    setError('')
    try {
      // Convert number fields
      const data: Record<string, unknown> = {}
      for (const field of request.input_schema) {
        const val = formData[field.name]
        if (field.type === 'number' && val) {
          data[field.name] = parseFloat(val) || 0
        } else {
          data[field.name] = val
        }
      }

      await submitHumanInput(request.mission_id, request.node_id, data)
      onSubmitted?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async () => {
    setCancelling(true)
    setError('')
    try {
      await cancelHumanInput(request.mission_id, request.node_id)
      onCancelled?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : '取消失败')
    } finally {
      setCancelling(false)
    }
  }

  const isDisabled = submitting || cancelling

  return (
    <div className="my-3 mx-auto max-w-[85%]">
      <div
        className={`rounded-lg border overflow-hidden ${
          isPending
            ? 'bg-accent/[0.04] border-accent/50 shadow-sm'
            : isCancelled
              ? 'bg-surface border-border/60 opacity-80'
              : 'bg-surface border-border opacity-80'
        }`}
      >
        {/* Header */}
        <div className="px-4 py-3 flex items-center gap-2.5">
          {isPending ? (
            <ClipboardEdit size={16} className="text-accent shrink-0" />
          ) : isCancelled ? (
            <Ban size={16} className="text-text-muted shrink-0" />
          ) : (
            <CheckCircle size={16} className="text-success shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <span className={`text-sm font-semibold ${
              isPending ? 'text-accent' : isCancelled ? 'text-text-muted' : 'text-success'
            }`}>
              {isPending ? '需要你的输入' : isCancelled ? '已取消' : '已提交'}
            </span>
          </div>
        </div>

        {/* Prompt */}
        <div className="px-4 pb-3">
          <p className="text-sm text-text leading-relaxed">
            {request.input_prompt}
          </p>
        </div>

        {/* Form Fields */}
        {isPending && (
          <div className="px-4 pb-3 space-y-3 border-t border-border/50 pt-3">
            {request.input_schema.map((field) => (
              <div key={field.name} className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                  {field.label}
                  {field.required && <span className="text-danger ml-0.5">*</span>}
                </label>

                {field.type === 'text' && (
                  <input
                    type="text"
                    className="px-3 py-2 text-sm bg-bg border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-accent text-text placeholder:text-text-muted"
                    value={formData[field.name] || ''}
                    onChange={(e) => updateField(field.name, e.target.value)}
                    disabled={isDisabled}
                    placeholder={field.label}
                  />
                )}

                {field.type === 'number' && (
                  <input
                    type="number"
                    className="px-3 py-2 text-sm bg-bg border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-accent text-text placeholder:text-text-muted"
                    value={formData[field.name] || ''}
                    onChange={(e) => updateField(field.name, e.target.value)}
                    disabled={isDisabled}
                    placeholder={field.label}
                  />
                )}

                {field.type === 'select' && (
                  <select
                    className="px-3 py-2 text-sm bg-bg border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-accent text-text"
                    value={formData[field.name] || ''}
                    onChange={(e) => updateField(field.name, e.target.value)}
                    disabled={isDisabled}
                  >
                    <option value="">-- 请选择 --</option>
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}

                {field.type === 'textarea' && (
                  <textarea
                    className="px-3 py-2 text-sm bg-bg border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-accent text-text placeholder:text-text-muted resize-y min-h-[60px]"
                    value={formData[field.name] || ''}
                    onChange={(e) => updateField(field.name, e.target.value)}
                    disabled={isDisabled}
                    placeholder={field.label}
                    rows={3}
                  />
                )}
              </div>
            ))}

            {/* Error */}
            {error && (
              <p className="text-xs text-danger">{error}</p>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSubmit}
                disabled={isDisabled}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-accent rounded-md hover:bg-accent/90 disabled:opacity-50 transition-colors"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                提交
              </button>
              <button
                onClick={handleCancel}
                disabled={isDisabled}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-text-muted bg-surface-hover border border-border rounded-md hover:bg-border/30 disabled:opacity-50 transition-colors"
              >
                {cancelling ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                取消
              </button>
            </div>
          </div>
        )}

        {/* Submitted State */}
        {!isPending && !isCancelled && (
          <div className="px-4 py-2 border-t border-border/50 bg-bg/30">
            <div className="flex items-center gap-2 text-xs text-success">
              <CheckCircle size={12} />
              <span>数据已提交，工作流继续执行中</span>
            </div>
          </div>
        )}

        {/* Cancelled State */}
        {isCancelled && (
          <div className="px-4 py-2.5 border-t border-border/50 bg-bg/30">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Ban size={12} />
              <span>已跳过此步骤，任务因缺少必要信息已停止执行</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
