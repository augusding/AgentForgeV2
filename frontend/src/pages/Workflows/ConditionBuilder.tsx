/**
 * ConditionBuilder — 可视化多条件构建器。
 *
 * 支持:
 *  - 多条件行（添加/删除）
 *  - AND / OR 组合模式切换
 *  - 15 种比较操作符
 *  - 字段名 + 值 均支持原生文本 / 表达式 {{ }} 双模式
 *
 * 数据格式:
 * {
 *   combineMode: "AND" | "OR",
 *   rules: [{ field, operator, value }]
 * }
 */
import { useState, useCallback } from 'react'
import { Plus, X, GripVertical } from 'lucide-react'
import { ExpressionEditor, type NodeFieldTree } from './ExpressionEditor'

interface ConditionRule {
  field: string
  operator: string
  value: string
}

interface ConditionData {
  combineMode: 'AND' | 'OR'
  rules: ConditionRule[]
}

interface Props {
  value: string | ConditionData
  onChange: (value: string) => void
  nodeContexts?: NodeFieldTree[]
}

const OPERATORS: { value: string; label: string; needsValue: boolean }[] = [
  { value: 'equals',      label: '等于',     needsValue: true },
  { value: 'notEquals',   label: '不等于',   needsValue: true },
  { value: 'gt',          label: '大于',     needsValue: true },
  { value: 'gte',         label: '大于等于', needsValue: true },
  { value: 'lt',          label: '小于',     needsValue: true },
  { value: 'lte',         label: '小于等于', needsValue: true },
  { value: 'contains',    label: '包含',     needsValue: true },
  { value: 'notContains', label: '不包含',   needsValue: true },
  { value: 'startsWith',  label: '开头是',   needsValue: true },
  { value: 'endsWith',    label: '结尾是',   needsValue: true },
  { value: 'regex',       label: '正则匹配', needsValue: true },
  { value: 'isEmpty',     label: '为空',     needsValue: false },
  { value: 'isNotEmpty',  label: '不为空',   needsValue: false },
  { value: 'exists',      label: '存在',     needsValue: false },
  { value: 'notExists',   label: '不存在',   needsValue: false },
]

const DEFAULT_RULE: ConditionRule = { field: '', operator: 'equals', value: '' }

function parseConditions(raw: string | ConditionData): ConditionData {
  if (typeof raw === 'object' && raw !== null) return raw as ConditionData
  try {
    const parsed = JSON.parse(raw as string)
    return {
      combineMode: parsed.combineMode || 'AND',
      rules: Array.isArray(parsed.rules) && parsed.rules.length > 0
        ? parsed.rules
        : [{ ...DEFAULT_RULE }],
    }
  } catch {
    return { combineMode: 'AND', rules: [{ ...DEFAULT_RULE }] }
  }
}

export default function ConditionBuilder({ value, onChange, nodeContexts = [] }: Props) {
  const [data, setData] = useState<ConditionData>(() => parseConditions(value))

  const emit = useCallback((next: ConditionData) => {
    setData(next)
    onChange(JSON.stringify(next))
  }, [onChange])

  const updateRule = (index: number, patch: Partial<ConditionRule>) => {
    const next = { ...data, rules: data.rules.map((r, i) => i === index ? { ...r, ...patch } : r) }
    emit(next)
  }

  const addRule = () => {
    emit({ ...data, rules: [...data.rules, { ...DEFAULT_RULE }] })
  }

  const removeRule = (index: number) => {
    if (data.rules.length <= 1) return
    emit({ ...data, rules: data.rules.filter((_, i) => i !== index) })
  }

  const toggleCombine = () => {
    emit({ ...data, combineMode: data.combineMode === 'AND' ? 'OR' : 'AND' })
  }

  const needsValue = (op: string) => {
    return OPERATORS.find(o => o.value === op)?.needsValue ?? true
  }

  return (
    <div className="space-y-0">
      {data.rules.map((rule, idx) => (
        <div key={idx}>
          {/* Condition row */}
          <div className="flex items-start gap-1.5 group">
            <GripVertical size={12} className="text-text-muted/40 shrink-0 mt-2" />

            {/* Field — 支持表达式 */}
            <div className="flex-1 min-w-0">
              <ExpressionEditor
                value={rule.field}
                onChange={v => updateRule(idx, { field: v })}
                placeholder="字段名"
                rows={1}
                nodeContexts={nodeContexts}
              />
            </div>

            {/* Operator */}
            <select
              value={rule.operator}
              onChange={e => updateRule(idx, { operator: e.target.value })}
              className="w-[90px] shrink-0 px-1.5 py-1.5 text-[11px] bg-bg border border-border rounded focus:outline-none focus:ring-1 focus:ring-accent text-text"
            >
              {OPERATORS.map(op => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>

            {/* Value — 支持表达式 */}
            {needsValue(rule.operator) ? (
              <div className="flex-1 min-w-0">
                <ExpressionEditor
                  value={rule.value}
                  onChange={v => updateRule(idx, { value: v })}
                  placeholder="值"
                  rows={1}
                  nodeContexts={nodeContexts}
                />
              </div>
            ) : (
              <div className="flex-1" />
            )}

            {/* Delete button */}
            <button
              onClick={() => removeRule(idx)}
              disabled={data.rules.length <= 1}
              className="p-1 shrink-0 mt-0.5 text-text-muted hover:text-error disabled:opacity-20 disabled:hover:text-text-muted transition-colors"
              title="删除条件"
            >
              <X size={13} />
            </button>
          </div>

          {/* AND / OR separator between rules */}
          {idx < data.rules.length - 1 && (
            <div className="flex items-center gap-2 py-1.5 pl-5">
              <button
                onClick={toggleCombine}
                className={`px-2.5 py-0.5 text-[10px] font-semibold rounded-full border transition-colors ${
                  data.combineMode === 'AND'
                    ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800'
                    : 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
                }`}
              >
                {data.combineMode}
              </button>
              <div className="flex-1 border-t border-border/50" />
            </div>
          )}
        </div>
      ))}

      {/* Add condition button */}
      <button
        onClick={addRule}
        className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-accent border border-dashed border-accent/30 rounded-md hover:bg-accent/5 transition-colors"
      >
        <Plus size={13} />
        添加条件
      </button>
    </div>
  )
}
