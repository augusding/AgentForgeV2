import { useEffect } from 'react'

interface ShortcutMap {
  [key: string]: () => void
}

/**
 * Registers global keyboard shortcuts.
 * Key format: 'mod+k' (mod = Cmd on Mac, Ctrl on Win/Linux)
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      const parts: string[] = []
      if (mod) parts.push('mod')
      if (e.shiftKey) parts.push('shift')
      parts.push(e.key.toLowerCase())
      const combo = parts.join('+')

      if (shortcuts[combo]) {
        e.preventDefault()
        shortcuts[combo]()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts])
}
