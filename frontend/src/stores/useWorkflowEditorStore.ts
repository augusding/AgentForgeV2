import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'
import type { ValidationResult, WorkflowMeta, WorkflowNodeType } from '../types/workflow'
import { validateGraph } from '../utils/workflowGraph'

let nodeCounter = 0

interface WorkflowEditorState {
  nodes: Node[]
  edges: Edge[]
  selectedNodeId: string | null
  dirty: boolean
  validation: ValidationResult
  meta: WorkflowMeta

  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  onNodesChange: (changes: any[]) => void
  onEdgesChange: (changes: any[]) => void
  selectNode: (nodeId: string | null) => void
  addNode: (type: WorkflowNodeType, position: { x: number; y: number }) => void
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void
  deleteNode: (nodeId: string) => void
  setMeta: (meta: Partial<WorkflowMeta>) => void
  validate: () => ValidationResult
  markClean: () => void
  reset: () => void
}

const defaultMeta: WorkflowMeta = {
  name: '',
  description: '',
  version: '1.0',
  trigger: { keywords: [], semantic: '', priority: 0 },
  parameters: [],
  metadata: {},
}

export const useWorkflowEditorStore = create<WorkflowEditorState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  dirty: false,
  validation: { valid: true, errors: [] },
  meta: { ...defaultMeta },

  setNodes: (nodes) => set({ nodes, dirty: true }),
  setEdges: (edges) => set({ edges, dirty: true }),

  onNodesChange: (changes) => {
    set((state) => {
      // Apply React Flow node changes (position, selection, removal)
      let nodes = [...state.nodes]
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          nodes = nodes.map((n) =>
            n.id === change.id ? { ...n, position: change.position } : n,
          )
        } else if (change.type === 'remove') {
          nodes = nodes.filter((n) => n.id !== change.id)
        } else if (change.type === 'select') {
          nodes = nodes.map((n) =>
            n.id === change.id ? { ...n, selected: change.selected } : n,
          )
        }
      }
      return { nodes, dirty: true }
    })
  },

  onEdgesChange: (changes) => {
    set((state) => {
      let edges = [...state.edges]
      for (const change of changes) {
        if (change.type === 'remove') {
          edges = edges.filter((e) => e.id !== change.id)
        }
      }
      return { edges, dirty: true }
    })
  },

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  addNode: (type, position) => {
    nodeCounter++
    const id = `${type}_${nodeCounter}_${Date.now().toString(36)}`
    const newNode: Node = {
      id,
      type: 'workflowNode',
      position,
      data: {
        id,
        type,
        skill: '',
        agent: '',
        instruction: '',
        output: '',
        depends_on: [],
        max_retries: 2,
        expression: '',
        on_true: '',
        on_false: '',
        workflow_ref: '',
        params_map: {},
        max_iterations: 0,
        metadata: {},
      },
    }
    set((state) => ({
      nodes: [...state.nodes, newNode],
      selectedNodeId: id,
      dirty: true,
    }))
  },

  updateNodeData: (nodeId, data) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data, id: nodeId } } : n,
      ),
      dirty: true,
    }))
  },

  deleteNode: (nodeId) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      dirty: true,
    }))
  },

  setMeta: (partial) => {
    set((state) => ({
      meta: { ...state.meta, ...partial },
      dirty: true,
    }))
  },

  validate: () => {
    const { nodes, edges } = get()
    const result = validateGraph(nodes, edges)
    set({ validation: result })
    return result
  },

  markClean: () => set({ dirty: false }),

  reset: () => {
    nodeCounter = 0
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      dirty: false,
      validation: { valid: true, errors: [] },
      meta: { ...defaultMeta },
    })
  },
}))
