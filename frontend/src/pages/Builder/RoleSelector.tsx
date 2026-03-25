/**
 * 角色勾选确认（Intake Round 2）
 *
 * 显示模板预设的角色列表，用户可以：
 * - 勾选/取消勾选现有角色
 * - 添加自定义新角色
 * 确认后一次性提交。
 */
import { useState } from 'react'
import { Check, Plus, X, Users, Send } from 'lucide-react'
import type { RoleOption } from '../../types/builder'

interface Props {
  roles: RoleOption[]
  onConfirm: (selected: RoleOption[], newRoles: { name: string; description: string }[]) => void
  disabled?: boolean
}

export default function RoleSelector({ roles: initialRoles, onConfirm, disabled }: Props) {
  const [roles, setRoles] = useState<RoleOption[]>(
    initialRoles.map(r => ({ ...r, checked: r.checked ?? true }))
  )
  const [newRoles, setNewRoles] = useState<{ name: string; description: string }[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addDesc, setAddDesc] = useState('')

  const toggleRole = (id: string) => {
    if (disabled) return
    setRoles(prev => prev.map(r => r.id === id ? { ...r, checked: !r.checked } : r))
  }

  const addRole = () => {
    if (!addName.trim()) return
    setNewRoles(prev => [...prev, { name: addName.trim(), description: addDesc.trim() }])
    setAddName('')
    setAddDesc('')
    setShowAdd(false)
  }

  const removeNewRole = (idx: number) => {
    setNewRoles(prev => prev.filter((_, i) => i !== idx))
  }

  const handleConfirm = () => {
    if (disabled) return
    onConfirm(roles, newRoles)
  }

  const checkedCount = roles.filter(r => r.checked).length + newRoles.length

  return (
    <div className="py-2">
      {/* 角色列表 */}
      <div className="space-y-2">
        {roles.map(role => (
          <button
            key={role.id}
            onClick={() => toggleRole(role.id)}
            disabled={disabled}
            className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-150 ${
              role.checked
                ? 'border-accent/50 bg-accent/5'
                : 'border-border bg-surface opacity-60 hover:opacity-80'
            } ${disabled ? 'cursor-not-allowed' : ''}`}
          >
            {/* Checkbox */}
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
              role.checked
                ? 'bg-accent border-accent text-white'
                : 'border-border bg-bg'
            }`}>
              {role.checked && <Check size={12} strokeWidth={3} />}
            </div>

            {/* Avatar */}
            <div className="w-8 h-8 rounded-lg bg-bg flex items-center justify-center text-base shrink-0">
              {role.avatar_emoji || '👤'}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-text">{role.name}</h4>
              {role.description && (
                <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{role.description}</p>
              )}
            </div>
          </button>
        ))}

        {/* 用户新增的角色 */}
        {newRoles.map((nr, idx) => (
          <div
            key={`new-${idx}`}
            className="flex items-center gap-3 p-3 rounded-xl border-2 border-accent/50 bg-accent/5"
          >
            <div className="w-5 h-5 rounded border-2 bg-accent border-accent text-white flex items-center justify-center shrink-0">
              <Check size={12} strokeWidth={3} />
            </div>
            <div className="w-8 h-8 rounded-lg bg-bg flex items-center justify-center text-base shrink-0">
              ✨
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-text">{nr.name}</h4>
              {nr.description && (
                <p className="text-xs text-text-muted mt-0.5">{nr.description}</p>
              )}
            </div>
            <button
              onClick={() => removeNewRole(idx)}
              className="shrink-0 text-text-muted hover:text-error transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* 添加新角色 */}
      {showAdd ? (
        <div className="mt-3 p-3 rounded-xl border border-border bg-surface">
          <div className="flex gap-2 mb-2">
            <input
              value={addName}
              onChange={e => setAddName(e.target.value)}
              placeholder="角色名称"
              className="flex-1 px-3 py-1.5 text-sm bg-bg border border-border rounded-lg text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
              autoFocus
            />
          </div>
          <input
            value={addDesc}
            onChange={e => setAddDesc(e.target.value)}
            placeholder="角色职责描述（可选）"
            className="w-full px-3 py-1.5 text-sm bg-bg border border-border rounded-lg text-text placeholder:text-text-muted focus:outline-none focus:border-accent mb-2"
          />
          <div className="flex gap-2">
            <button
              onClick={addRole}
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
          <Plus size={14} /> 添加自定义角色
        </button>
      )}

      {/* 确认按钮 */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-text-muted flex items-center gap-1">
          <Users size={12} /> 已选 {checkedCount} 个角色
        </span>
        <button
          onClick={handleConfirm}
          disabled={checkedCount === 0 || disabled}
          className="inline-flex items-center gap-1.5 px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send size={14} /> 确认角色
        </button>
      </div>
    </div>
  )
}
