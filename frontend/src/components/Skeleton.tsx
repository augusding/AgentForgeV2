interface Props {
  className?: string
  width?: string | number
  height?: string | number
  rounded?: 'sm' | 'md' | 'lg' | 'full'
}

export default function Skeleton({ className = '', width, height, rounded = 'md' }: Props) {
  const roundedClass = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  }[rounded]

  return (
    <div
      className={`animate-pulse bg-border/60 ${roundedClass} ${className}`}
      style={{ width, height }}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-surface border border-border rounded-lg p-5 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton width={40} height={40} rounded="full" />
        <div className="flex-1 space-y-2">
          <Skeleton height={14} width="60%" />
          <Skeleton height={10} width="40%" />
        </div>
      </div>
      <Skeleton height={10} width="100%" />
      <Skeleton height={10} width="80%" />
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="border-b border-border bg-bg px-4 py-3 flex gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} height={12} width={`${15 + Math.random() * 10}%`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-b border-border last:border-0 flex gap-4">
          {Array.from({ length: 5 }).map((_, j) => (
            <Skeleton key={j} height={12} width={`${15 + Math.random() * 10}%`} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonChat() {
  return (
    <div className="space-y-4 p-4">
      {/* Left message */}
      <div className="flex gap-3">
        <Skeleton width={36} height={36} rounded="full" />
        <div className="space-y-2 flex-1 max-w-[60%]">
          <Skeleton height={12} width="30%" />
          <Skeleton height={60} width="100%" rounded="lg" />
        </div>
      </div>
      {/* Right message */}
      <div className="flex gap-3 justify-end">
        <div className="space-y-2 max-w-[50%]">
          <Skeleton height={48} width="100%" rounded="lg" />
        </div>
      </div>
      {/* Left message */}
      <div className="flex gap-3">
        <Skeleton width={36} height={36} rounded="full" />
        <div className="space-y-2 flex-1 max-w-[70%]">
          <Skeleton height={12} width="25%" />
          <Skeleton height={80} width="100%" rounded="lg" />
        </div>
      </div>
    </div>
  )
}
