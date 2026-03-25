export type MessageRole = 'user' | 'agent' | 'system'

// ── 多Agent步骤相关类型 ──

export interface StepToolCall {
  tool: string
  input?: Record<string, unknown>
  result?: string
  status: 'running' | 'done'
}

export interface StepState {
  step_id: string
  step_index: number
  agent_id: string
  agent_name: string
  instruction: string
  model?: string
  status: 'pending' | 'running' | 'done' | 'error'
  content: string
  tokens_used?: number
  duration_ms?: number
  quality_score?: number
  tools: StepToolCall[]
  collapsed: boolean
}

// ── Solo 模式结构化数据 ──

export interface SoloToolCall {
  tool: string
  input?: Record<string, unknown>
  result?: string
  status: 'running' | 'done'
}

export interface SoloFileCard {
  filename: string
  url: string            // 下载 URL (Content-Disposition: attachment)
  preview_url?: string   // 预览 URL (Content-Disposition: inline)
  size: number
  type: string  // pdf, xlsx, csv...
}

// ── 人工输入请求 ──

export interface HumanInputField {
  name: string
  type: 'text' | 'number' | 'select' | 'textarea'
  label: string
  required: boolean
  options?: string[]
  default?: string
}

export interface HumanInputRequest {
  node_id: string
  mission_id: string
  input_schema: HumanInputField[]
  input_prompt: string
  status: 'pending' | 'submitted' | 'cancelled'
}

// ── 文件附件 ──

export interface FileAttachment {
  file_id: string
  filename: string
  file_type: 'image' | 'document' | 'audio'
  mime_type: string
  size_bytes: number
  parsed_text_preview: string
  preview_url?: string
  /** 前端上传过程中的临时状态 */
  uploading?: boolean
  error?: string
}

// ── RAG 引用 ──

export interface Citation {
  order: number
  title: string
  text_preview: string
  score: number
  source: string   // "vector" | "keyword" | "both"
}

export interface SkillInfo {
  id: string
  name: string
  score: number
  tools_required: string[]
  tools_called: string[]
  tools_missing: string[]
}

// ── 消息 ──

export interface ChatMessage {
  id: string
  mission_id?: string
  role: MessageRole
  content: string
  agent_id?: string
  agent_name?: string
  model_used?: string
  tokens_used?: number
  duration_ms?: number
  created_at: string
  /** 多Agent模式步骤数据 */
  steps?: StepState[]
  plan_source?: string
  is_multi_agent?: boolean
  /** 文件附件 */
  attachments?: FileAttachment[]
  /** Solo 模式结构化数据 */
  solo_plan?: string
  solo_thinking?: string[]
  solo_tools?: SoloToolCall[]
  solo_files?: SoloFileCard[]
  /** 人工输入请求 */
  human_inputs?: HumanInputRequest[]
  /** 深度推理过程 */
  reasoning?: string
  reasoning_phase?: string
  /** 对话模式标记（true=纯对话，无工具/计划） */
  chat_mode?: boolean
  /** RAG 知识引用 */
  citations?: Citation[]
  /** Skill 执行信息 */
  skill?: SkillInfo
}

export interface ChatInput {
  content: string
  target_agent?: string
  attachments?: string[]
}

export interface QuickCommand {
  id: string
  label: string
  template: string
  placeholder: string
  icon: string
  category: string
}
