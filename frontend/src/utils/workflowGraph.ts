/**
 * WorkflowV2 ↔ React Flow conversion, dagre auto-layout, and DAG validation.
 */
import type { Node, Edge } from '@xyflow/react'
import dagre from 'dagre'
import type {
  WorkflowV2Data,
  WorkflowNodeData,
  WorkflowMeta,
  WorkflowNodeType,
  ValidationResult,
  ValidationError,
} from '../types/workflow'

// ── Constants ─────────────────────────────────────────

export const NODE_WIDTH = 200
export const NODE_HEIGHT = 60

export const NODE_TYPE_COLORS: Record<WorkflowNodeType, string> = {
  task: '#6366f1',       // indigo / accent
  condition: '#f59e0b',  // amber / warning
  approval: '#10b981',   // emerald / success
  human_input: '#0ea5e9', // sky blue
  loop: '#ec4899',       // pink
  sub_workflow: '#8b5cf6', // violet
}

export const NODE_STATUS_COLORS: Record<string, string> = {
  pending: '#4b5563',    // gray-600
  ready: '#6b7280',      // gray-500
  running: '#3b82f6',    // blue-500
  completed: '#22c55e',  // green-500
  skipped: '#9ca3af',    // gray-400
  failed: '#ef4444',     // red-500
  waiting: '#f59e0b',    // amber-500
}

// ── WorkflowV2 → React Flow ──────────────────────────

export function workflowToGraph(workflow: WorkflowV2Data): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = workflow.nodes.map((n, i) => ({
    id: n.id,
    type: 'workflowNode',
    position: { x: 0, y: i * 100 },
    data: { ...n },
  }))

  const edges: Edge[] = []

  for (const n of workflow.nodes) {
    // depends_on → edges
    for (const dep of (n.depends_on || [])) {
      edges.push({
        id: `${dep}->${n.id}`,
        source: dep,
        target: n.id,
        animated: false,
      })
    }

    // condition on_true / on_false → edges
    if (n.type === 'condition') {
      const trueTargets = Array.isArray(n.on_true) ? n.on_true : n.on_true ? [n.on_true] : []
      const falseTargets = Array.isArray(n.on_false) ? n.on_false : n.on_false ? [n.on_false] : []

      for (const t of trueTargets) {
        edges.push({
          id: `${n.id}->true->${t}`,
          source: n.id,
          target: t,
          label: 'true',
          style: { stroke: '#22c55e' },
        })
      }
      for (const t of falseTargets) {
        edges.push({
          id: `${n.id}->false->${t}`,
          source: n.id,
          target: t,
          label: 'false',
          style: { stroke: '#ef4444' },
        })
      }
    }
  }

  // Auto-layout
  const laid = autoLayout(nodes, edges)
  return { nodes: laid, edges }
}

// ── React Flow → WorkflowV2 ──────────────────────────

export function graphToWorkflow(nodes: Node[], edges: Edge[], meta: WorkflowMeta): WorkflowV2Data {
  // Build depends_on from edges (non-condition edges only)
  const depsMap = new Map<string, string[]>()
  const condTrueMap = new Map<string, string[]>()
  const condFalseMap = new Map<string, string[]>()

  for (const e of edges) {
    if (e.id.includes('->true->')) {
      const list = condTrueMap.get(e.source) || []
      list.push(e.target)
      condTrueMap.set(e.source, list)
    } else if (e.id.includes('->false->')) {
      const list = condFalseMap.get(e.source) || []
      list.push(e.target)
      condFalseMap.set(e.source, list)
    } else {
      const list = depsMap.get(e.target) || []
      list.push(e.source)
      depsMap.set(e.target, list)
    }
  }

  const wfNodes: WorkflowNodeData[] = nodes.map((n) => {
    const d = n.data as WorkflowNodeData
    return {
      id: n.id,
      type: (d.type || 'task') as WorkflowNodeType,
      skill: d.skill || '',
      agent: d.agent || '',
      instruction: d.instruction || '',
      output: d.output || '',
      depends_on: depsMap.get(n.id) || d.depends_on || [],
      max_retries: d.max_retries ?? 2,
      expression: d.expression || '',
      on_true: condTrueMap.get(n.id) || d.on_true || '',
      on_false: condFalseMap.get(n.id) || d.on_false || '',
      workflow_ref: d.workflow_ref || '',
      params_map: d.params_map || {},
      max_iterations: d.max_iterations ?? 0,
      metadata: d.metadata || {},
    }
  })

  return {
    ...meta,
    nodes: wfNodes,
  }
}

// ── dagre auto-layout ────────────────────────────────

export function autoLayout(nodes: Node[], edges: Edge[], direction: 'TB' | 'LR' = 'TB'): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, nodesep: 50, ranksep: 80 })

  for (const n of nodes) {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  for (const e of edges) {
    g.setEdge(e.source, e.target)
  }

  dagre.layout(g)

  return nodes.map((n) => {
    const pos = g.node(n.id)
    return {
      ...n,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    }
  })
}

// ── DAG Validation ───────────────────────────────────

export function validateGraph(nodes: Node[], edges: Edge[]): ValidationResult {
  const errors: ValidationError[] = []

  if (nodes.length === 0) {
    errors.push({ message: 'Workflow must have at least one node' })
    return { valid: false, errors }
  }

  // Check for duplicate IDs
  const ids = new Set<string>()
  for (const n of nodes) {
    if (ids.has(n.id)) {
      errors.push({ nodeId: n.id, message: `Duplicate node ID: ${n.id}` })
    }
    ids.add(n.id)
  }

  // Check edges reference existing nodes
  for (const e of edges) {
    if (!ids.has(e.source)) {
      errors.push({ message: `Edge source "${e.source}" not found` })
    }
    if (!ids.has(e.target)) {
      errors.push({ message: `Edge target "${e.target}" not found` })
    }
  }

  // Cycle detection (Kahn's algorithm)
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()
  for (const n of nodes) {
    inDegree.set(n.id, 0)
    adj.set(n.id, [])
  }
  for (const e of edges) {
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1)
    adj.get(e.source)?.push(e.target)
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }
  let visited = 0
  while (queue.length > 0) {
    const cur = queue.shift()!
    visited++
    for (const next of adj.get(cur) || []) {
      const deg = (inDegree.get(next) || 1) - 1
      inDegree.set(next, deg)
      if (deg === 0) queue.push(next)
    }
  }
  if (visited < nodes.length) {
    errors.push({ message: 'Workflow contains a cycle' })
  }

  // Check task nodes have instruction or skill
  for (const n of nodes) {
    const d = n.data as WorkflowNodeData
    if (d.type === 'task' && !d.instruction && !d.skill) {
      errors.push({ nodeId: n.id, message: `Task node "${n.id}" needs instruction or skill` })
    }
    if (d.type === 'condition' && !d.expression) {
      errors.push({ nodeId: n.id, message: `Condition node "${n.id}" needs expression` })
    }
    if (d.type === 'sub_workflow' && !d.workflow_ref) {
      errors.push({ nodeId: n.id, message: `Sub-workflow node "${n.id}" needs workflow_ref` })
    }
  }

  return { valid: errors.length === 0, errors }
}
