export default function LoadingSpinner({ label = '加载中...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--text-muted)]">
      <div className="w-8 h-8 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  )
}
