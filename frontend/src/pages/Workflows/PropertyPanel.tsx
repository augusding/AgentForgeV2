/**
 * PropertyPanel — 节点参数配置 + 调试数据面板。
 *
 * 三个 Tab:
 *  参数配置 — schema 驱动的参数表单（原有功能）
 *  输入数据 — 执行后该节点收到的实际数据
 *  输出数据 — 执行后该节点产出的实际数据 + Test Node 按钮
 */
import { useState } from 'react'
import { X, ChevronDown, ChevronRight, Play, Loader2 } from 'lucide-react'
import type { NodeTypeDef, NodePropertyDef, WFNodeExecState, WFTestNodeResult } from '../../api/workflow'
import { testNode } from '../../api/workflow'
import JsonTreeViewer from './JsonTreeViewer'
import { ExpressionEditor, type NodeFieldTree } from './ExpressionEditor'
import ConditionBuilder from './ConditionBuilder'
import MultiOptionsField from './MultiOptionsField'

type PanelTab = 'params' | 'input' | 'output'

interface Props {
  nodeId: string
  nodeName: string
  nodeTypeDef: NodeTypeDef | null
  parameters: Record<string, any>
  execState?: WFNodeExecState        // 执行状态（含数据），来自 lastExecution
  nodeContexts?: NodeFieldTree[]     // 上游节点字段树，用于表达式编辑器
  onUpdate: (params: Record<string, any>) => void
  onNameChange: (name: string) => void
  onDelete: () => void
  onClose: () => void
}

export default function PropertyPanel({
  nodeId, nodeName, nodeTypeDef, parameters, execState, nodeContexts = [],
  onUpdate, onNameChange, onDelete, onClose,
}: Props) {
  const [activeTab, setActiveTab] = useState<PanelTab>('params')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<WFTestNodeResult | null>(null)
  const [testInput, setTestInput] = useState('[]')
  const [testInputError, setTestInputError] = useState('')

  if (!nodeTypeDef) {
    return (
      <div className="w-72 border-l border-border bg-surface p-4">
        <p className="text-xs text-text-muted">Unknown node type</p>
      </div>
    )
  }

  const handleParamChange = (name: string, value: any) => {
    onUpdate({ ...parameters, [name]: value })
  }

  // Test Node
  const handleTestNode = async () => {
    let inputData: Record<string, any>[] | undefined
    try {
      const parsed = JSON.parse(testInput)
      inputData = Array.isArray(parsed) ? parsed : [parsed]
      setTestInputError('')
    } catch {
      setTestInputError('输入数据 JSON 格式错误')
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const res = await testNode(nodeTypeDef.name, parameters, inputData)
      setTestResult(res)
    } catch (e: any) {
      setTestResult({ status: 'failed', error: e.message })
    }
    setTesting(false)
  }

  const tabs: { key: PanelTab; label: string }[] = [
    { key: 'params', label: '参数配置' },
    { key: 'input',  label: '输入数据' },
    { key: 'output', label: '输出数据' },
  ]

  return (
    <div className="w-80 border-l border-border bg-surface h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: nodeTypeDef.color || '#6366f1' }}
            />
            <span className="text-sm font-semibold text-text truncate">
              {nodeTypeDef.displayName}
            </span>
            {execState && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                execState.status === 'completed' ? 'bg-success/10 text-success' :
                execState.status === 'failed'    ? 'bg-error/10 text-error' :
                execState.status === 'running'   ? 'bg-blue-400/10 text-blue-400' :
                'bg-surface-hover text-text-muted'
              }`}>
                {execState.status}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text rounded transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Node name input */}
        <div className="px-4 pb-3">
          <input
            type="text"
            value={nodeName}
            onChange={e => onNameChange(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs bg-bg border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-accent text-text"
            placeholder="Node name..."
          />
        </div>

        {/* Tabs */}
        <div className="flex border-t border-border">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 text-[11px] font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-accent border-b-2 border-accent bg-accent/5'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── 参数配置 Tab ── */}
        {activeTab === 'params' && (
          <div className="p-4 space-y-4">
            {nodeTypeDef.properties.map(prop => (
              <PropertyField
                key={prop.name}
                property={prop}
                value={parameters[prop.name] ?? prop.default}
                allValues={parameters}
                nodeContexts={nodeContexts}
                onChange={val => handleParamChange(prop.name, val)}
              />
            ))}
          </div>
        )}

        {/* ── 输入数据 Tab ── */}
        {activeTab === 'input' && (
          <div className="p-4">
            {execState?.inputData ? (
              <>
                <div className="text-[10px] text-text-muted mb-2">
                  {execState.inputData.length} 条输入数据
                </div>
                <JsonTreeViewer data={execState.inputData} emptyText="输入数据为空" />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-center gap-2">
                <span className="text-xs text-text-muted">尚未执行</span>
                <span className="text-[10px] text-text-muted">执行工作流后此处显示实际输入数据</span>
              </div>
            )}
          </div>
        )}

        {/* ── 输出数据 Tab ── */}
        {activeTab === 'output' && (
          <div className="p-4 space-y-4">
            {/* 上次执行结果 */}
            {execState?.outputData ? (
              <div>
                <div className="text-[10px] text-text-muted mb-2">
                  上次执行输出 · {execState.outputItems} 条
                  {execState.duration !== undefined && (
                    <span className="ml-2">
                      {execState.duration < 1
                        ? `${Math.round(execState.duration * 1000)}ms`
                        : `${execState.duration.toFixed(1)}s`}
                    </span>
                  )}
                </div>
                <JsonTreeViewer data={execState.outputData} emptyText="输出为空" />
              </div>
            ) : execState?.status === 'failed' ? (
              <div className="p-3 bg-error/5 border border-error/20 rounded-md">
                <p className="text-xs text-error font-medium mb-1">执行失败</p>
                <p className="text-[11px] text-text-muted">{execState.error}</p>
              </div>
            ) : null}

            {/* Test Node 区域 */}
            <div className="border border-border rounded-md overflow-hidden">
              <div className="px-3 py-2 bg-surface-hover border-b border-border">
                <span className="text-[11px] font-medium text-text">单节点测试</span>
              </div>
              <div className="p-3 space-y-2">
                <label className="block text-[10px] text-text-muted">模拟输入数据 (JSON 数组)</label>
                <textarea
                  value={testInput}
                  onChange={e => { setTestInput(e.target.value); setTestInputError('') }}
                  rows={3}
                  placeholder='[{"field": "value"}]'
                  className={`w-full px-2 py-1.5 text-[10px] font-mono bg-bg border rounded-md resize-y focus:outline-none focus:ring-1 focus:ring-accent text-text ${
                    testInputError ? 'border-error' : 'border-border'
                  }`}
                />
                {testInputError && <p className="text-[10px] text-error">{testInputError}</p>}

                <button
                  onClick={handleTestNode}
                  disabled={testing}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-white bg-accent rounded-md hover:bg-accent/90 disabled:opacity-40 transition-colors"
                >
                  {testing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                  {testing ? 'Testing...' : 'Test Node'}
                </button>

                {/* Test 结果 */}
                {testResult && (
                  <div className={`mt-2 rounded-md border p-2 ${
                    testResult.status === 'completed'
                      ? 'border-success/30 bg-success/5'
                      : 'border-error/30 bg-error/5'
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-medium ${
                        testResult.status === 'completed' ? 'text-success' : 'text-error'
                      }`}>
                        {testResult.status === 'completed' ? 'Success' : 'Failed'}
                      </span>
                      {testResult.duration !== undefined && (
                        <span className="text-[10px] text-text-muted">
                          {testResult.duration < 1
                            ? `${Math.round(testResult.duration * 1000)}ms`
                            : `${testResult.duration.toFixed(1)}s`}
                        </span>
                      )}
                    </div>
                    {testResult.error ? (
                      <p className="text-[10px] text-error">{testResult.error}</p>
                    ) : (
                      <JsonTreeViewer data={testResult.outputData} emptyText="输出为空" />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-muted font-mono truncate max-w-[160px]">{nodeId}</span>
          <button
            onClick={onDelete}
            className="px-2.5 py-1 text-[10px] text-error border border-error/30 rounded hover:bg-error/5 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}


// ── Property Field Renderer ──────────────────────────

interface FieldProps {
  property: NodePropertyDef
  value: any
  allValues: Record<string, any>
  nodeContexts: NodeFieldTree[]
  onChange: (value: any) => void
}

function PropertyField({ property, value, allValues, nodeContexts, onChange }: FieldProps) {
  if (property.displayOptions) {
    const { show, hide } = property.displayOptions
    if (show) {
      for (const [param, allowed] of Object.entries(show)) {
        if (!allowed.includes(allValues[param])) return null
      }
    }
    if (hide) {
      for (const [param, hidden] of Object.entries(hide)) {
        if (hidden.includes(allValues[param])) return null
      }
    }
  }

  if (property.type === 'notice') {
    return (
      <div className="px-3 py-2 text-[11px] text-text-muted bg-bg/50 rounded-md border border-border/50">
        {property.default || property.description}
      </div>
    )
  }

  return (
    <div>
      <label className="block text-[11px] font-medium text-text-secondary mb-1">
        {property.displayName}
        {property.required && <span className="text-error ml-0.5">*</span>}
      </label>

      {property.type === 'string' && (
        <StringField property={property} value={value} nodeContexts={nodeContexts} onChange={onChange} />
      )}
      {property.type === 'number' && (
        <NumberField property={property} value={value} onChange={onChange} />
      )}
      {property.type === 'boolean' && (
        <BooleanField value={value} onChange={onChange} />
      )}
      {property.type === 'options' && (
        <OptionsField property={property} value={value} onChange={onChange} />
      )}
      {property.type === 'multiOptions' && (
        <MultiOptionsField property={property} value={value} onChange={onChange} />
      )}
      {property.type === 'json' && (
        <JsonField property={property} value={value} onChange={onChange} />
      )}
      {property.type === 'code' && (
        <CodeField property={property} value={value} onChange={onChange} />
      )}
      {property.type === 'filter' && (
        <ConditionBuilder value={value} onChange={onChange} nodeContexts={nodeContexts} />
      )}
      {property.type === 'collection' && (
        <CollectionField property={property} value={value} allValues={allValues} nodeContexts={nodeContexts} onChange={onChange} />
      )}

      {property.description && (
        <p className="mt-1 text-[10px] text-text-muted">{property.description}</p>
      )}
    </div>
  )
}


// ── Individual field components ────────────────────────

function StringField({ property, value, nodeContexts, onChange }: {
  property: NodePropertyDef; value: any; nodeContexts: NodeFieldTree[]; onChange: (v: any) => void
}) {
  const rows = property.typeOptions?.rows || 1
  const isPassword = property.typeOptions?.password

  // Password and noDataExpression fields skip expression mode
  if (isPassword || property.noDataExpression) {
    return rows > 1 ? (
      <textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={property.placeholder}
        className="w-full px-2.5 py-1.5 text-xs bg-bg border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-accent text-text placeholder:text-text-muted font-mono resize-y"
      />
    ) : (
      <input
        type={isPassword ? 'password' : 'text'}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={property.placeholder}
        className="w-full px-2.5 py-1.5 text-xs bg-bg border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-accent text-text placeholder:text-text-muted"
      />
    )
  }

  return (
    <ExpressionEditor
      value={value || ''}
      onChange={onChange}
      placeholder={property.placeholder}
      rows={rows}
      nodeContexts={nodeContexts}
    />
  )
}

function NumberField({ property, value, onChange }: { property: NodePropertyDef; value: any; onChange: (v: any) => void }) {
  return (
    <input
      type="number"
      value={value ?? ''}
      onChange={e => onChange(e.target.value ? Number(e.target.value) : property.default)}
      min={property.typeOptions?.minValue}
      max={property.typeOptions?.maxValue}
      step={property.typeOptions?.numberPrecision ? Math.pow(10, -property.typeOptions.numberPrecision) : 1}
      className="w-full px-2.5 py-1.5 text-xs bg-bg border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-accent text-text"
    />
  )
}

function BooleanField({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-9 h-5 rounded-full transition-colors ${value ? 'bg-accent' : 'bg-border'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${value ? 'translate-x-4' : ''}`} />
    </button>
  )
}

function OptionsField({ property, value, onChange }: { property: NodePropertyDef; value: any; onChange: (v: any) => void }) {
  return (
    <select
      value={value ?? property.default}
      onChange={e => onChange(e.target.value)}
      className="w-full px-2.5 py-1.5 text-xs bg-bg border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-accent text-text"
    >
      {property.options?.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.name}</option>
      ))}
    </select>
  )
}

function JsonField({ property, value, onChange }: { property: NodePropertyDef; value: any; onChange: (v: any) => void }) {
  const [text, setText] = useState(() =>
    typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  )
  const [error, setError] = useState('')

  const handleChange = (raw: string) => {
    setText(raw)
    try {
      JSON.parse(raw)
      setError('')
      onChange(raw)
    } catch {
      setError('Invalid JSON')
    }
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={e => handleChange(e.target.value)}
        rows={property.typeOptions?.rows || 5}
        className={`w-full px-2.5 py-1.5 text-xs bg-bg border rounded-md focus:outline-none focus:ring-1 text-text font-mono resize-y ${
          error ? 'border-error focus:ring-error' : 'border-border focus:ring-accent'
        }`}
      />
      {error && <p className="mt-0.5 text-[10px] text-error">{error}</p>}
    </div>
  )
}

function CodeField({ property, value, onChange }: { property: NodePropertyDef; value: any; onChange: (v: any) => void }) {
  return (
    <textarea
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      rows={property.typeOptions?.rows || 10}
      className="w-full px-2.5 py-1.5 text-xs bg-bg border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-accent text-text font-mono resize-y"
      spellCheck={false}
    />
  )
}

function CollectionField({ property, value, allValues, nodeContexts, onChange }: {
  property: NodePropertyDef; value: any; allValues: Record<string, any>; nodeContexts: NodeFieldTree[]; onChange: (v: any) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const current = value || {}

  const handleSubChange = (name: string, val: any) => {
    onChange({ ...current, [name]: val })
  }

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-secondary hover:bg-surface-hover transition-colors"
      >
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {property.displayName}
      </button>
      {expanded && property.properties && (
        <div className="p-2.5 pt-0 space-y-3 border-t border-border">
          {property.properties.map(sub => (
            <PropertyField
              key={sub.name}
              property={sub}
              value={current[sub.name] ?? sub.default}
              allValues={{ ...allValues, ...current }}
              nodeContexts={nodeContexts}
              onChange={val => handleSubChange(sub.name, val)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
