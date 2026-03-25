/**
 * 工作流勾选确认（Intake Round 3）
 *
 * 显示模板预设的工作流列表，用户可以：
 * - 勾选/取消勾选现有工作流
 * - 添加自定义新工作流
 * 确认后一次性提交。
 */
import { useState } from 'react'
import { Check, Plus, X, GitBranch, Send, Users } from 'lucide-react'
import type { WorkflowOption } from '../../types/builder'

interface Props {
  workflows: WorkflowOption[]
  onConfirm: (selected: WorkflowOption[], newWorkflows: { name: string; description: string }[]) => void
  disabled?: boolean
}

export default function WorkflowSelector({ workflows: initialWorkflows, onConfirm, disabled }: Props) {
  const [workflows, setWorkflows] = useState<WorkflowOption[]>(
    initialWorkflows.map(w => ({ ...w, checked: w.checked ?? true }))
  )
  const [newWorkflows, setNewWorkflows] = useState<{ name: string; description: string }[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addDesc, setAddDesc] = useState('')

  const toggleWorkflow = (id: string) => {
    if (disabled) return
    setWorkflows(prev => prev.map(w => w.id === id ? { ...w, checked: !w.checked } : w))
  }

  const addWorkflow = () => {
    if (!addName.trim()) return
    setNewWorkflows(prev => [...prev, { name: addName.trim(), description: addDesc.trim() }])
    setAddName('')
    setAddDesc('')
    setShowAdd(false)
  }

  const removeNewWorkflow = (idx: number) => {
    setNewWorkflows(prev => prev.filter((_, i) => i !== idx))
  }

  const handleConfirm = () => {
    if (disabled) return
    onConfirm(workflows, newWorkflows)
  }

  const checkedCount = workflows.filter(w => w.checked).length + newWorkflows.length

  return (
    <div className="py-2">
      {/* 工作流列表 */}
      <div className="space-y-2">
        {workflows.map(wf => (
          <button
            key={wf.id}
            onClick={() => toggleWorkflow(wf.id)}
            disabled={disabled}
            className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border-2 transition-all duration-150 ${
              wf.checked
                ? 'border-accent/50 bg-accent/5'
                : 'border-border bg-surface opacity-60 hover:opacity-80'
            } ${disabled ? 'cursor-not-allowed' : ''}`}
          >
            {/* Checkbox */}
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
              wf.checked
                ? 'bg-accent border-accent text-white'
                : 'border-border bg-bg'
            }`}>
              {wf.checked && <Check size={12} strokeWidth={3} />}
            </div>

            {/* Icon */}
            <div className="w-8 h-8 rounded-lg bg-bg flex items-center justify-center shrink-0">
              <GitBranch size={16} className="text-accent" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-text">{wf.name}</h4>
              {wf.description && (
                <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{wf.description}</p>
              )}
              <div className="flex items-center gap-3 mt-1.5">
                {wf.steps != null && wf.steps > 0 && (
                  <span className="text-[11px] text-text-secondary">
                    {wf.steps} 个步骤
                  </span>
                )}
                {wf.agents_involved && wf.agents_involved.length > 0 && (
                  <span className="flex items-center gap-0.5 text-[11px] text-text-secondary">
                    <Users size={10} /> {wf.agents_involved.length} 个角色参与
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}

        {/* 用户新增的工作流 */}
        {newWorkflows.map((nw, idx) => (
          <div
            key={`new-${idx}`}
            className="flex items-start gap-3 p-3 rounded-xl border-2 border-accent/50 bg-accent/5"
          >
            <div className="w-5 h-5 rounded border-2 bg-accent border-accent text-white flex items-center justify-center shrink-0 mt-0.5">
              <Check size={12} strokeWidth={3} />
            </div>
            <div className="w-8 h-8 rounded-lg bg-bg flex items-center justify-center shrink-0">
              <GitBranch size={16} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-text">{nw.name}</h4>
              {nw.description && (
                <p className="text-xs text-text-muted mt-0.5">{nw.description}</p>
              )}
              <span className="text-[11px] text-accent mt-1 inline-block">自定义</span>
            </div>
            <button
              onClick={() => removeNewWorkflow(idx)}
              className="shrink-0 text-text-muted hover:text-error transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* 添加新工作流 */}
      {showAdd ? (
        <div className="mt-3 p-3 rounded-xl border border-border bg-surface">
          <input
            value={addName}
            onChange={e => setAddName(e.target.value)}
            placeholder="工作流名称"
            className="w-full px-3 py-1.5 text-sm bg-bg border border-border rounded-lg text-text placeholder:text-text-muted focus:outline-none focus:border-accent mb-2"
            autoFocus
          />
          <input
            value={addDesc}
            onChange={e => setAddDesc(e.target.value)}
            placeholder="简要描述（可选）"
            className="w-full px-3 py-1.5 text-sm bg-bg border border-border rounded-lg text-text placeholder:text-text-muted focus:outline-none focus:border-accent mb-2"
          />
          <div className="flex gap-2">
            <button
              onClick={addWorkflow}
              disabled={!addName.trim()}
              className="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-40"
            >
              添加
            </button>
            <button
              onClick={() => { setShowAdd(false); setAddName(''); setAddDesc('') }}
              className="px-3 py-1.5 text-xs text-text-muted hover:text-text border border-border rounded-lg"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          disabled={disabled}
          className="mt-3 flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 transition-colors disabled:opacity-40"
        >
          <Plus size={14} /> 添加自定义工作流
        </button>
      )}

      {/* 确认按钮 */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-text-muted flex items-center gap-1">
          <GitBranch size={12} /> 已选 {checkedCount} 条工作流
        </span>
        <button
          onClick={handleConfirm}
          disabled={checkedCount === 0 || disabled}
          className="inline-flex items-center gap-1.5 px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send size={14} /> 确认工作流
        </button>
      </div>
    </div>
  )
}
