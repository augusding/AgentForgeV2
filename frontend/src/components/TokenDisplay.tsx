import { formatTokenCount, formatCost } from '../utils/formatToken'

interface Props {
  tokens?: number
  cost?: number
  variant?: 'default' | 'compact'
}

export default function TokenDisplay({ tokens, cost, variant = 'default' }: Props) {
  if (variant === 'compact' && tokens != null) {
    return <span className="font-mono text-sm text-text-secondary">{formatTokenCount(tokens)}</span>
  }

  return (
    <span className="font-mono text-sm text-text-secondary">
      {cost != null && formatCost(cost)}
      {cost != null && tokens != null && ' / '}
      {tokens != null && formatTokenCount(tokens)}
    </span>
  )
}
