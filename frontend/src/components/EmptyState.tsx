import { FolderOpen, Search, AlertTriangle } from 'lucide-react'

interface Props {
  variant?: 'empty' | 'no-results' | 'error'
  title?: string
  description?: string
  action?: { label: string; onClick: () => void }
}

const ICONS = {
  empty: FolderOpen,
  'no-results': Search,
  error: AlertTriangle,
}

const DEFAULTS = {
  empty: 'No data yet',
  'no-results': 'No results found',
  error: 'Something went wrong',
}

export default function EmptyState({ variant = 'empty', title, description, action }: Props) {
  const Icon = ICONS[variant]
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon size={48} className="text-text-muted mb-4" strokeWidth={1.5} />
      <h3 className="text-lg font-medium text-text-secondary mb-1">
        {title || DEFAULTS[variant]}
      </h3>
      {description && <p className="text-sm text-text-muted max-w-md">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary-light transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
