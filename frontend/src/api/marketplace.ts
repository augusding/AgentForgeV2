import client from './client'
import type {
  BuiltinTool,
  InstalledServer,
  RegistryServer,
  SecurityAuditReport,
} from '../types/marketplace'

export async function fetchBuiltinTools(): Promise<BuiltinTool[]> {
  // show_hidden=1 让前端拿到所有工具（含 developer），由前端控制是否显示
  return client.get('/marketplace/builtin', { params: { show_hidden: '1' } })
}

export async function fetchInstalledServers(): Promise<InstalledServer[]> {
  return client.get('/marketplace/installed')
}

export async function searchRegistry(q: string, limit = 10): Promise<RegistryServer[]> {
  return client.get('/marketplace/search', { params: { q, limit } })
}

export async function auditSecurity(
  name: string,
  pkg: { identifier: string; registry_type: string },
): Promise<SecurityAuditReport> {
  return client.post('/marketplace/audit', { name, package: pkg })
}

export async function installServer(
  server: RegistryServer,
  packageIndex = 0,
): Promise<{ success: boolean; record: InstalledServer }> {
  return client.post('/marketplace/install', { server, package_index: packageIndex })
}

export async function toggleServer(
  serverId: string,
  enabled: boolean,
): Promise<{ success: boolean }> {
  return client.post(`/marketplace/${serverId}/toggle`, { enabled })
}

export async function uninstallServer(
  serverId: string,
): Promise<{ success: boolean }> {
  return client.delete(`/marketplace/${serverId}`)
}
