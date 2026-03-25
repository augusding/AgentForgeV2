interface Props {
  size?: 'sm' | 'md' | 'lg'
  label?: string
  fullPage?: boolean
}

const SIZES = { sm: 16, md: 24, lg: 40 }

export default function LoadingSpinner({ size = 'md', label, fullPage }: Props) {
  const px = SIZES[size]

  const spinner = (
    <div className={fullPage ? 'flex flex-col items-center gap-3' : 'inline-flex items-center gap-2'}>
      <svg
        className="animate-spin"
        style={{ width: px, height: px }}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          className="opacity-25"
          cx="12" cy="12" r="10"
          stroke="currentColor" strokeWidth="3"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      {label && <span className="text-sm text-text-secondary">{label}</span>}
    </div>
  )

  if (fullPage) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] text-accent">
        {spinner}
      </div>
    )
  }

  return <span className="text-accent">{spinner}</span>
}
