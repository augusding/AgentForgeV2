import { getAgentColor, getAgentInitials } from '../utils/agentColors'

interface Props {
  agentId: string
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  status?: 'idle' | 'executing' | 'waiting' | 'error'
}

const SIZES = { sm: 32, md: 40, lg: 56, xl: 80 }
const FONT_SIZES = { sm: 12, md: 14, lg: 20, xl: 28 }
const STATUS_COLORS = {
  idle: 'var(--color-success)',
  executing: 'var(--color-info)',
  waiting: 'var(--color-warning)',
  error: 'var(--color-danger)',
}

export default function AgentAvatar({ agentId, name, size = 'md', status }: Props) {
  const px = SIZES[size]
  const fontSize = FONT_SIZES[size]
  const dotSize = size === 'sm' ? 8 : 10

  return (
    <div className="relative inline-flex shrink-0" style={{ width: px, height: px }}>
      <div
        className="flex items-center justify-center rounded-full text-white font-semibold select-none"
        style={{
          width: px,
          height: px,
          fontSize,
          backgroundColor: getAgentColor(agentId),
        }}
      >
        {getAgentInitials(name)}
      </div>
      {status && (
        <span
          className="absolute bottom-0 right-0 rounded-full border-2 border-white"
          style={{
            width: dotSize,
            height: dotSize,
            backgroundColor: STATUS_COLORS[status],
          }}
        />
      )}
    </div>
  )
}
