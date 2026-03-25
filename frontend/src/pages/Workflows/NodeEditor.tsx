/**
 * Right-side property editor for the selected workflow node.
 */
import { X } from 'lucide-react'
import { useWorkflowEditorStore } from '../../stores/useWorkflowEditorStore'
import type { WorkflowNodeData, WorkflowNodeType } from '../../types/workflow'

interface Props {
  agents: { id: string; name: string }[]
}

export default function NodeEditor({ agents }: Props) {
  const selectedNodeId = useWorkflowEditorStore((s) => s.selectedNodeId)
  const nodes = useWorkflowEditorStore((s) => s.nodes)
  const updateNodeData = useWorkflowEditorStore((s) => s.updateNodeData)
  const deleteNode = useWorkflowEditorStore((s) => s.deleteNode)
  const selectNode = useWorkflowEditorStore((s) => s.selectNode)

  const node = nodes.find((n) => n.id === selectedNodeId)
  if (!node) return null

  const d = node.data as unknown as WorkflowNodeData
  const nodeType = (d.type || 'task') as WorkflowNodeType

  const update = (field: string, value: unknown) => {
    updateNodeData(node.id, { [field]: value })
  }

  return (
    <div className="w-64 bg-surface border-l border-border p-4 flex flex-col gap-3 shrink-0 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Properties</h3>
        <button onClick={() => selectNode(null)} className="text-text-muted hover:text-text">
          <X size={14} />
        </button>
      </div>

      {/* Node ID */}
      <Field label="Node ID">
        <input
          className="input-sm"
          value={d.id}
          readOnly
          disabled
        />
      </Field>

      {/* Type */}
      <Field label="Type">
        <select
          className="input-sm"
          value={nodeType}
          onChange={(e) => update('type', e.target.value)}
        >
          <option value="task">Task</option>
          <option value="condition">Condition</option>
          <option value="approval">Approval</option>
          <option value="human_input">Human Input</option>
          <option value="loop">Loop</option>
          <option value="sub_workflow">Sub-workflow</option>
        </select>
      </Field>

      {/* Task / Approval fields */}
      {(nodeType === 'task' || nodeType === 'approval') && (
        <>
          <Field label="Agent">
            <select
              className="input-sm"
              value={d.agent || ''}
              onChange={(e) => update('agent', e.target.value)}
            >
              <option value="">— Auto (skill-based) —</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name || a.id}</option>
              ))}
            </select>
          </Field>

          <Field label="Skill">
            <input
              className="input-sm"
              value={d.skill || ''}
              onChange={(e) => update('skill', e.target.value)}
              placeholder="e.g. product_listing_optimization"
            />
          </Field>

          <Field label="Instruction">
            <textarea
              className="input-sm min-h-[60px] resize-y"
              value={d.instruction || ''}
              onChange={(e) => update('instruction', e.target.value)}
              placeholder="What should the agent do?"
            />
          </Field>

          <Field label="Output Key">
            <input
              className="input-sm"
              value={d.output || ''}
              onChange={(e) => update('output', e.target.value)}
              placeholder="blackboard key"
            />
          </Field>

          <Field label="Max Retries">
            <input
              type="number"
              className="input-sm"
              value={d.max_retries ?? 2}
              min={0}
              max={10}
              onChange={(e) => update('max_retries', parseInt(e.target.value) || 0)}
            />
          </Field>
        </>
      )}

      {/* Condition fields */}
      {nodeType === 'condition' && (
        <>
          <Field label="Expression">
            <input
              className="input-sm"
              value={d.expression || ''}
              onChange={(e) => update('expression', e.target.value)}
              placeholder="e.g. severity == 'high'"
            />
          </Field>
          <Field label="On True (node IDs)">
            <input
              className="input-sm"
              value={Array.isArray(d.on_true) ? d.on_true.join(', ') : d.on_true || ''}
              onChange={(e) => {
                const v = e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                update('on_true', v.length === 1 ? v[0] : v)
              }}
              placeholder="node_id_1, node_id_2"
            />
          </Field>
          <Field label="On False (node IDs)">
            <input
              className="input-sm"
              value={Array.isArray(d.on_false) ? d.on_false.join(', ') : d.on_false || ''}
              onChange={(e) => {
                const v = e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                update('on_false', v.length === 1 ? v[0] : v)
              }}
              placeholder="node_id_1, node_id_2"
            />
          </Field>
        </>
      )}

      {/* Sub-workflow fields */}
      {nodeType === 'sub_workflow' && (
        <>
          <Field label="Workflow Ref">
            <input
              className="input-sm"
              value={d.workflow_ref || ''}
              onChange={(e) => update('workflow_ref', e.target.value)}
              placeholder="workflow name"
            />
          </Field>
        </>
      )}

      {/* Human Input fields */}
      {nodeType === 'human_input' && (
        <>
          <Field label="Input Prompt">
            <textarea
              className="input-sm min-h-[60px] resize-y"
              value={d.input_prompt || ''}
              onChange={(e) => update('input_prompt', e.target.value)}
              placeholder="What data do you need from the user?"
            />
          </Field>

          <Field label="Input Schema (JSON)">
            <textarea
              className="input-sm min-h-[80px] resize-y font-mono text-[11px]"
              value={JSON.stringify(d.input_schema || [], null, 2)}
              onChange={(e) => {
                try {
                  const schema = JSON.parse(e.target.value)
                  if (Array.isArray(schema)) update('input_schema', schema)
                } catch { /* ignore parse errors while typing */ }
              }}
              placeholder='[{"name":"field","type":"text","label":"Field","required":true}]'
            />
            <span className="text-[10px] text-text-muted">Array of {'{'}name, type, label, required, options?{'}'}</span>
          </Field>

          <Field label="Output Key">
            <input
              className="input-sm"
              value={d.output || ''}
              onChange={(e) => update('output', e.target.value)}
              placeholder="blackboard key"
            />
          </Field>
        </>
      )}

      {/* Loop fields */}
      {nodeType === 'loop' && (
        <>
          <Field label="Continue Condition">
            <input
              className="input-sm"
              value={d.expression || ''}
              onChange={(e) => update('expression', e.target.value)}
              placeholder="e.g. quality_score < 8"
            />
            <span className="text-[10px] text-text-muted">True = continue looping</span>
          </Field>

          <Field label="Loop Body (node IDs)">
            <input
              className="input-sm"
              value={Array.isArray(d.loop_body) ? d.loop_body.join(', ') : ''}
              onChange={(e) => {
                const v = e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                update('loop_body', v)
              }}
              placeholder="node_id_1, node_id_2"
            />
          </Field>

          <Field label="Max Iterations">
            <input
              type="number"
              className="input-sm"
              value={d.max_iterations ?? 5}
              min={1}
              max={20}
              onChange={(e) => update('max_iterations', parseInt(e.target.value) || 5)}
            />
          </Field>

          <Field label="Output Key">
            <input
              className="input-sm"
              value={d.output || ''}
              onChange={(e) => update('output', e.target.value)}
              placeholder="blackboard key"
            />
          </Field>
        </>
      )}

      {/* Generic Max Iterations (for non-loop nodes) */}
      {nodeType !== 'loop' && (
        <Field label="Max Iterations">
          <input
            type="number"
            className="input-sm"
            value={d.max_iterations ?? 0}
            min={0}
            onChange={(e) => update('max_iterations', parseInt(e.target.value) || 0)}
          />
          <span className="text-[10px] text-text-muted">0 = no loop</span>
        </Field>
      )}

      {/* Delete */}
      <button
        className="mt-2 text-xs text-danger hover:bg-danger/10 rounded px-3 py-1.5 transition-colors border border-danger/30"
        onClick={() => deleteNode(node.id)}
      >
        Delete Node
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}
