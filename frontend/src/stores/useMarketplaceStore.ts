import { create } from 'zustand'
import type { BuiltinTool, InstalledServer, RegistryServer, SecurityAuditReport } from '../types/marketplace'
import {
  fetchBuiltinTools,
  fetchInstalledServers,
  searchRegistry,
  auditSecurity,
  installServer,
  toggleServer,
  uninstallServer,
} from '../api/marketplace'

type TabKey = 'builtin' | 'installed' | 'marketplace'

interface MarketplaceStore {
  activeTab: TabKey
  setActiveTab: (tab: TabKey) => void

  // builtin
  builtinTools: BuiltinTool[]
  builtinLoading: boolean

  // installed
  installedServers: InstalledServer[]
  installedLoading: boolean

  // search
  searchResults: RegistryServer[]
  searchQuery: string
  searchLoading: boolean

  // audit dialog
  auditReport: SecurityAuditReport | null
  auditTarget: RegistryServer | null
  auditLoading: boolean
  installLoading: boolean

  // actions
  loadBuiltinTools: () => Promise<void>
  loadInstalledServers: () => Promise<void>
  search: (q: string) => Promise<void>
  requestInstall: (server: RegistryServer) => Promise<void>
  confirmInstall: () => Promise<void>
  cancelInstall: () => void
  toggle: (id: string, enabled: boolean) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useMarketplaceStore = create<MarketplaceStore>((set, get) => ({
  activeTab: 'builtin',
  setActiveTab: (tab) => set({ activeTab: tab }),

  builtinTools: [],
  builtinLoading: false,

  installedServers: [],
  installedLoading: false,

  searchResults: [],
  searchQuery: '',
  searchLoading: false,

  auditReport: null,
  auditTarget: null,
  auditLoading: false,
  installLoading: false,

  loadBuiltinTools: async () => {
    set({ builtinLoading: true })
    try {
      const tools = await fetchBuiltinTools()
      set({ builtinTools: tools, builtinLoading: false })
    } catch {
      set({ builtinLoading: false })
    }
  },

  loadInstalledServers: async () => {
    set({ installedLoading: true })
    try {
      const servers = await fetchInstalledServers()
      set({ installedServers: servers, installedLoading: false })
    } catch {
      set({ installedLoading: false })
    }
  },

  search: async (q: string) => {
    set({ searchQuery: q, searchLoading: true })
    try {
      const results = await searchRegistry(q)
      set({ searchResults: results, searchLoading: false })
    } catch {
      set({ searchLoading: false })
    }
  },

  requestInstall: async (server: RegistryServer) => {
    if (!server.packages.length) return
    set({ auditTarget: server, auditLoading: true, auditReport: null })
    try {
      const pkg = server.packages[0]
      const report = await auditSecurity(server.name, {
        identifier: pkg.identifier,
        registry_type: pkg.registry_type,
      })
      set({ auditReport: report, auditLoading: false })
    } catch {
      set({ auditLoading: false })
    }
  },

  confirmInstall: async () => {
    const { auditTarget } = get()
    if (!auditTarget) return
    set({ installLoading: true })
    try {
      await installServer(auditTarget)
      set({
        installLoading: false,
        auditReport: null,
        auditTarget: null,
        activeTab: 'installed',
      })
      get().loadInstalledServers()
    } catch {
      set({ installLoading: false })
    }
  },

  cancelInstall: () => {
    set({ auditReport: null, auditTarget: null, auditLoading: false })
  },

  toggle: async (id: string, enabled: boolean) => {
    await toggleServer(id, enabled)
    set((s) => ({
      installedServers: s.installedServers.map((srv) =>
        srv.id === id ? { ...srv, enabled } : srv,
      ),
    }))
  },

  remove: async (id: string) => {
    await uninstallServer(id)
    set((s) => ({
      installedServers: s.installedServers.filter((srv) => srv.id !== id),
    }))
  },
}))
