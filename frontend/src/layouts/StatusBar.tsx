interface Props {
  engineRunning?: boolean
  wsConnected?: boolean
}

export default function StatusBar({
  engineRunning = true,
  wsConnected = false,
}: Props) {
  return (
    <footer className="h-9 bg-surface border-t border-border flex items-center px-4 text-xs text-text-muted gap-4 shrink-0">
      {/* Engine status */}
      <div className="flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: engineRunning ? 'var(--color-success)' : 'var(--color-danger)' }}
        />
        <span>{engineRunning ? 'Engine Running' : 'Engine Offline'}</span>
      </div>

      <span className="text-border">|</span>

      {/* WebSocket status */}
      <div className="flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: wsConnected ? 'var(--color-success)' : 'var(--color-danger)' }}
        />
        <span>WS: {wsConnected ? 'Connected' : 'Disconnected'}</span>
      </div>
    </footer>
  )
}
