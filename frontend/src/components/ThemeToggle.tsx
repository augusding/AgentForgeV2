import { Sun, Moon, Monitor } from 'lucide-react'
import { useThemeStore } from '../stores/useThemeStore'

const CYCLE: Record<string, 'light' | 'dark' | 'system'> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
}

const LABELS: Record<string, string> = {
  light: '浅色模式',
  dark: '深色模式',
  system: '跟随系统',
}

export default function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)

  const next = () => setMode(CYCLE[mode])
  const Icon = mode === 'dark' ? Moon : mode === 'system' ? Monitor : Sun

  return (
    <button
      onClick={next}
      className="p-1.5 text-text-secondary hover:text-text transition-colors"
      title={LABELS[mode]}
    >
      <Icon size={20} />
    </button>
  )
}
