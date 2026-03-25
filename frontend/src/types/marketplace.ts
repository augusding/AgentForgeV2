// ── Tool Marketplace Types ────────────────────────────────

export type ToolCategory = 'document' | 'image' | 'audio' | 'web' | 'system' | 'data' | 'developer' | 'general'

export interface BuiltinTool {
  name: string
  name_zh: string
  description: string
  description_zh: string
  level: string
  risk_level: string
  category: ToolCategory
  visible: boolean
}

export interface MCPPackage {
  registry_type: string
  identifier: string
  transport_type: string
  runtime_hint: string
  package_arguments: string[]
}

export interface RegistryServer {
  name: string
  description: string
  version: string
  packages: MCPPackage[]
  name_zh: string
  description_zh: string
}

export interface InstalledServer {
  id: string
  name: string
  registry_name: string
  description: string
  name_zh: string
  description_zh: string
  package_identifier: string
  registry_type: string
  command: string
  args: string[]
  env: Record<string, string>
  enabled: boolean
  status: string
  installed_at: string
  security_report: SecurityAuditReport
}

export interface SecurityAuditReport {
  package_name: string
  registry_type: string
  risk_level: 'low' | 'medium' | 'high'
  permissions: string[]
  warnings: string[]
  recommendation: string
  details: string
}
