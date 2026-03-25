/** WorkflowV2 types — mirrors Python core/models.py WorkflowV2 / WorkflowNode */

export type WorkflowNodeType = 'task' | 'condition' | 'approval' | 'sub_workflow' | 'human_input' | 'loop'

export interface WorkflowNodeData {
  id: string
  type: WorkflowNodeType

  // task / approval
  skill: string
  agent: string
  instruction: string
  output: string
  depends_on: string[]
  max_retries: number

  // condition
  expression: string
  on_true: string | string[]
  on_false: string | string[]

  // sub_workflow
  workflow_ref: string
  params_map: Record<string, string>

  // human_input
  input_schema: Array<{
    name: string
    type: 'text' | 'number' | 'select' | 'textarea'
    label: string
    required: boolean
    options?: string[]
    default?: string
  }>
  input_prompt: string

  // loop
  loop_body: string[]
  max_iterations: number

  // metadata
  metadata: Record<string, unknown>
}

export interface WorkflowTriggerData {
  keywords: string[]
  semantic: string
  priority: number
}

export interface WorkflowParameterData {
  name: string
  type: string
  required: boolean
  default?: unknown
  description: string
}

export interface WorkflowV2Data {
  name: string
  description: string
  version: string
  trigger: WorkflowTriggerData
  parameters: WorkflowParameterData[]
  nodes: WorkflowNodeData[]
  metadata: Record<string, unknown>
}

export interface WorkflowMeta {
  name: string
  description: string
  version: string
  trigger: WorkflowTriggerData
  parameters: WorkflowParameterData[]
  metadata: Record<string, unknown>
}

export interface ValidationError {
  nodeId?: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}
