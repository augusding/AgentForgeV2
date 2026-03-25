export interface KnowledgeFile {
  id: string
  name: string
  file_type: string
  file_size: number
  category: 'industry' | 'custom'
  chunk_count: number
  index_status: 'pending' | 'indexing' | 'indexed' | 'failed'
  index_error?: string
  created_at: string
  updated_at: string
  last_indexed_at?: string
  used_in_missions?: number
  position_ids?: string[]
  scope_tags?: string[]
}

export interface KnowledgeStats {
  total_files: number
  total_chunks: number
  total_size: number
  last_update: string
  by_category: {
    industry: number
    custom: number
  }
  index_progress: number
}

// ── 知识连接器类型 ──────────────────────────────

export interface ConfigFieldDef {
  key: string
  type: string        // "string" | "number" | "password" | "boolean" | "select" | "code" | "path" | "array"
  title: string
  placeholder?: string
  required?: boolean
  default?: any
  options?: { value: string; label: string }[]
  group?: string
  help_text?: string
  language?: string
}

export interface ConnectorType {
  type: string
  display_name: string
  icon: string
  description: string
  config_fields: ConfigFieldDef[]
}

export interface SyncState {
  connector_id: string
  last_sync_at: string
  last_sync_status: 'idle' | 'syncing' | 'success' | 'partial' | 'failed'
  last_sync_cursor: string
  docs_total: number
  docs_added: number
  docs_updated: number
  docs_deleted: number
  error_message: string
}

export interface Connector {
  id: string
  org_id: string
  connector_type: string
  name: string
  config: Record<string, any>
  field_mapping: Record<string, any>
  sync_strategy: 'manual' | 'cron' | 'watch'
  cron_expression: string
  enabled: boolean
  created_at: string
  updated_at: string
  sync_state?: SyncState | null
}

export interface SyncLog {
  id: string
  connector_id: string
  started_at: string
  finished_at: string
  status: string
  docs_added: number
  docs_updated: number
  docs_deleted: number
  errors: string[]
  duration_seconds: number
}

export interface TestResult {
  success: boolean
  message: string
  details?: Record<string, any>
}

export interface SourceSchema {
  tables?: { name: string; fields: { name: string; type: string }[]; row_count: number }[]
  folders?: { path: string; file_count: number; file_types: string[] }[]
}
