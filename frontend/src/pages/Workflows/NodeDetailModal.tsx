/**
 * NodeDetailModal — n8n 风格的全屏节点详情面板。
 *
 * 三栏布局: INPUT | Parameters | OUTPUT
 * 顶部: ← Back to canvas  |  节点名  |  Execute step 按钮
 */
import { useState } from 'react'
import {
  ArrowLeft, Play, Loader2, Trash2, Settings, ChevronDown, ChevronRight,
} from 'lucide-react'
import type {
  NodeTypeDef, NodePropertyDef, WFNodeExecState, WFTestNodeResult,
} from '../../api/workflow'
import { testNode } from '../../api/workflow'
import JsonTreeViewer from './JsonTreeViewer'
import { ExpressionEditor, type NodeFieldTree } from './ExpressionEditor'
import ConditionBuilder from './ConditionBuilder'
import MultiOptionsField from './MultiOptionsField'

type CenterTab = 'parameters' | 'settings'

interface Props {
  nodeId: string
  nodeName: string
  nodeTypeDef: NodeTypeDef | null
  parameters: Record<string, any>
  execState?: WFNodeExecState
  nodeContexts?: NodeFieldTree[]
  onUpdate: (params: Record<string, any>) => void
  onNameChange: (name: string) => void
  onDelete: () => void
  onClose: () => void
  onExecute?: () => void
  isExecuting?: boolean
}

export default function NodeDetailModal({
  nodeId, nodeName, nodeTypeDef, parameters, execState, nodeContexts = [],
  onUpdate, onNameChange, onDelete, onClose, onExecute, isExecuting,
}: Props) {
  const [centerTab, setCenterTab] = useState<CenterTab>('parameters')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<WFTestNodeResult | null>(null)
  const [testInput, setTestInput] = useState('[]')
  const [testInputError, setTestInputError] = useState('')

  if (!nodeTypeDef) return null

  const handleParamChange = (name: string, value: any) => {
    onUpdate({ ...parameters, [name]: value })
  }

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

  const color = nodeTypeDef.color || '#6366f1'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-surface shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to canvas
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Node icon + name */}
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
          style={{ backgroundColor: color + '20' }}
        >
          <div className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: color }} />
        </div>
        <input
          type="text"
          value={nodeName}
          onChange={e => onNameChange(e.target.value)}
          className="text-sm font-semibold bg-transparent border-none outline-none text-text w-48"
          placeholder="Node name..."
        />

        {execState && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            execState.status === 'completed' ? 'bg-green-100 text-green-700' :
            execState.status === 'failed'    ? 'bg-red-100 text-red-700' :
            execState.status === 'running'   ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-500'
          }`}>
            {execState.status === 'completed' ? '✓ Success' :
             execState.status === 'failed' ? '✕ Error' :
             execState.status === 'running' ? '● Running' : 'Pending'}
          </span>
        )}

        <div className="flex-1" />

        <button
          onClick={onDelete}
          className="p-1.5 text-text-muted hover:text-error rounded transition-colors"
          title="Delete node"
        >
          <Trash2 size={14} />
        </button>

        {onExecute && (
          <button
            onClick={onExecute}
            disabled={isExecuting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-40 transition-colors"
          >
            {isExecuting ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            Execute step
          </button>
        )}
      </div>

      {/* ── Three-column body ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT: INPUT */}
        <div className="w-[320px] border-r border-border flex flex-col bg-surface/50">
          <div className="px-4 py-3 border-b border-border">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
              INPUT
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {execState?.inputData && execState.inputData.length > 0 ? (
              <>
                <div className="text-[10px] text-text-muted mb-3">
                  {execState.inputData.length} 条输入数据
                </div>
                {/* Table-like display for items */}
                <InputDataTable data={execState.inputData} />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center">
                  <ArrowLeft size={20} className="text-text-muted" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-secondary">No input data yet</p>
                  <p className="text-xs text-text-muted mt-1">
                    Execute the workflow to see input data
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CENTER: Parameters */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Center tabs */}
          <div className="flex items-center border-b border-border bg-surface/30 shrink-0">
            <button
              onClick={() => setCenterTab('parameters')}
              className={`px-4 py-2.5 text-xs font-medium transition-colors ${
                centerTab === 'parameters'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              Parameters
            </button>
            <button
              onClick={() => setCenterTab('settings')}
              className={`px-4 py-2.5 text-xs font-medium transition-colors ${
                centerTab === 'settings'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              Settings
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {centerTab === 'parameters' ? (
              <div className="max-w-xl mx-auto p-6 space-y-5">
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
            ) : (
              <div className="max-w-xl mx-auto p-6 space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Node ID</label>
                    <div className="px-3 py-2 text-xs font-mono bg-bg border border-border rounded-md text-text-muted">
                      {nodeId}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Node Type</label>
                    <div className="px-3 py-2 text-xs bg-bg border border-border rounded-md text-text-muted">
                      {nodeTypeDef.displayName} ({nodeTypeDef.name})
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Description</label>
                    <div className="px-3 py-2 text-xs bg-bg border border-border rounded-md text-text-muted">
                      {nodeTypeDef.description}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: OUTPUT */}
        <div className="w-[320px] border-l border-border flex flex-col bg-surface/50">
          <div className="px-4 py-3 border-b border-border">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
              OUTPUT
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {execState?.outputData && execState.outputData.length > 0 ? (
              <>
                <div className="text-[10px] text-text-muted mb-1">
                  {execState.outputItems} 条输出
                  {execState.duration !== undefined && (
                    <span className="ml-2">
                      · {execState.duration < 1
                        ? `${Math.round(execState.duration * 1000)}ms`
                        : `${execState.duration.toFixed(1)}s`}
                    </span>
                  )}
                </div>
                <InputDataTable data={execState.outputData} />
              </>
            ) : execState?.status === 'failed' ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-700 font-medium mb-1">Execution Error</p>
                <p className="text-xs text-red-600">{execState.error}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center">
                  <Play size={20} className="text-text-muted" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-secondary">Execute this node to view data</p>
                  <p className="text-xs text-text-muted mt-1">
                    Run the workflow or test this node
                  </p>
                </div>

                {/* Test Node 区域 */}
                <div className="w-full mt-4 border border-border rounded-lg overflow-hidden text-left">
                  <div className="px-3 py-2 bg-surface-hover border-b border-border">
                    <span className="text-[11px] font-medium text-text">Test Node</span>
                  </div>
                  <div className="p-3 space-y-2">
                    <label className="block text-[10px] text-text-muted">Mock input (JSON)</label>
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
                  </div>
                </div>
              </div>
            )}

            {/* Test result (shown below output data if available) */}
            {testResult && (
              <div className={`mt-3 rounded-lg border p-3 ${
                testResult.status === 'completed'
                  ? 'border-green-200 bg-green-50'
                  : 'border-red-200 bg-red-50'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[11px] font-medium ${
                    testResult.status === 'completed' ? 'text-green-700' : 'text-red-700'
                  }`}>
                    Test {testResult.status === 'completed' ? 'Success' : 'Failed'}
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
                  <p className="text-[10px] text-red-600">{testResult.error}</p>
                ) : (
                  <JsonTreeViewer data={testResult.outputData} emptyText="No output" />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


// ── Input/Output Data Table — n8n style item cards ───────

function InputDataTable({ data }: { data: Record<string, any>[] }) {
  return (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div key={i} className="border border-border rounded-lg overflow-hidden">
          <div className="px-3 py-1.5 bg-surface-hover border-b border-border flex items-center justify-between">
            <span className="text-[10px] font-medium text-text-muted">Item {i}</span>
          </div>
          <div className="divide-y divide-border">
            {Object.entries(item).map(([key, val]) => (
              <div key={key} className="flex px-3 py-1.5">
                <span className="text-[11px] font-medium text-text-secondary w-28 shrink-0 truncate" title={key}>
                  {key}
                </span>
                <span className="text-[11px] text-text break-all min-w-0">
                  {typeof val === 'object' && val !== null
                    ? <JsonTreeViewer data={val} defaultExpanded={false} emptyText="" />
                    : String(val ?? '')}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}


// ── Property Field Renderer (reused from PropertyPanel) ──

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
      <div className="px-4 py-3 text-xs text-amber-700 bg-amber-50 rounded-lg border border-amber-200">
        {property.default || property.description}
      </div>
    )
  }

  return (
    <div>
      <label className="block text-xs font-medium text-text-secondary mb-1.5">
        {property.displayName}
        {property.required && <span className="text-red-500 ml-0.5">*</span>}
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


// ── Field components ─────────────────────────────────────

const fieldClass = "w-full px-3 py-2 text-sm bg-bg border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent text-text placeholder:text-text-muted"

function StringField({ property, value, nodeContexts, onChange }: {
  property: NodePropertyDef; value: any; nodeContexts: NodeFieldTree[]; onChange: (v: any) => void
}) {
  const rows = property.typeOptions?.rows || 1
  const isPassword = property.typeOptions?.password

  if (isPassword || property.noDataExpression) {
    return rows > 1 ? (
      <textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={property.placeholder}
        className={`${fieldClass} font-mono resize-y`}
      />
    ) : (
      <input
        type={isPassword ? 'password' : 'text'}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={property.placeholder}
        className={fieldClass}
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
      className={fieldClass}
    />
  )
}

function BooleanField({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-10 h-5.5 rounded-full transition-colors ${value ? 'bg-accent' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full transition-transform shadow-sm ${value ? 'translate-x-[18px]' : ''}`} />
    </button>
  )
}

function OptionsField({ property, value, onChange }: { property: NodePropertyDef; value: any; onChange: (v: any) => void }) {
  return (
    <select
      value={value ?? property.default}
      onChange={e => onChange(e.target.value)}
      className={fieldClass}
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
        className={`${fieldClass} font-mono resize-y ${error ? 'border-red-400 focus:ring-red-300' : ''}`}
      />
      {error && <p className="mt-0.5 text-[10px] text-red-500">{error}</p>}
    </div>
  )
}

function CodeField({ property, value, onChange }: { property: NodePropertyDef; value: any; onChange: (v: any) => void }) {
  return (
    <textarea
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      rows={property.typeOptions?.rows || 10}
      className={`${fieldClass} font-mono resize-y`}
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
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-surface-hover transition-colors"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {property.displayName}
      </button>
      {expanded && property.properties && (
        <div className="p-3 pt-0 space-y-4 border-t border-border">
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
