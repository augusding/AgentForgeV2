const COLORS: Record<string, { bg: string; text: string }> = {
  idle: { bg: '#DCFCE7', text: '#16A34A' },
  executing: { bg: '#DBEAFE', text: '#2563EB' },
  waiting: { bg: '#FEF3C7', text: '#D97706' },
  completed: { bg: '#DCFCE7', text: '#16A34A' },
  pending: { bg: '#FEF3C7', text: '#D97706' },
  approved: { bg: '#DCFCE7', text: '#16A34A' },
  rejected: { bg: '#FEE2E2', text: '#DC2626' },
  failed: { bg: '#FEE2E2', text: '#DC2626' },
  in_progress: { bg: '#DBEAFE', text: '#2563EB' },
  cancelled: { bg: '#F1F5F9', text: '#64748B' },
  error: { bg: '#FEE2E2', text: '#DC2626' },
}

interface Props {
  status: string
  label?: string
}

export default function StatusBadge({ status, label }: Props) {
  const colors = COLORS[status] || COLORS.pending
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {label || status.replace(/_/g, ' ')}
    </span>
  )
}
