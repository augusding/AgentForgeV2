export interface Position {
  position_id: string
  display_name: string
  icon: string
  color: string
  department: string
  description: string
}

export interface Session {
  id: string
  title: string
  position_id: string
  updated_at: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: number
  tokens_used?: number
  model?: string
}

export interface WorkflowSummary {
  id: string
  name: string
  description: string
  enabled: boolean
}

export interface KnowledgeStats {
  total_files: number
  total_chunks: number
  status: string
}

export interface FileInfo {
  file_id: string
  filename: string
  size: number
  modified: number
}
