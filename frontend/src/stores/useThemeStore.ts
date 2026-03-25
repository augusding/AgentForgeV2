import { create } from 'zustand'

type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeState {
  mode: ThemeMode
  resolved: 'light' | 'dark'
  setMode: (mode: ThemeMode) => void
  init: () => void
}

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

function applyTheme(resolved: 'light' | 'dark') {
  const root = document.documentElement
  if (resolved === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: (localStorage.getItem('agentforge_theme') as ThemeMode) || 'light',
  resolved: 'light',

  setMode: (mode) => {
    localStorage.setItem('agentforge_theme', mode)
    const resolved = resolveTheme(mode)
    applyTheme(resolved)
    set({ mode, resolved })
  },

  init: () => {
    const mode = get().mode
    const resolved = resolveTheme(mode)
    applyTheme(resolved)
    set({ resolved })

    // Listen for system theme changes
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (get().mode === 'system') {
        const newResolved = resolveTheme('system')
        applyTheme(newResolved)
        set({ resolved: newResolved })
      }
    }
    mql.addEventListener('change', handler)
  },
}))
