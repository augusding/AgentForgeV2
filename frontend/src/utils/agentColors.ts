const AGENT_COLOR_MAP: Record<string, string> = {
  ceo: 'var(--color-agent-ceo)',
  analyst: 'var(--color-agent-analyst)',
  content: 'var(--color-agent-content)',
  developer: 'var(--color-agent-developer)',
  cs: 'var(--color-agent-cs)',
  pm: 'var(--color-agent-pm)',
  ops: 'var(--color-agent-ops)',
  marketing: 'var(--color-agent-marketing)',
}

const FALLBACK_COLORS = [
  '#8B5CF6', '#3B82F6', '#EC4899', '#10B981',
  '#F59E0B', '#6366F1', '#14B8A6', '#F43F5E',
]

export function getAgentColor(agentId: string): string {
  const lower = agentId.toLowerCase()
  for (const [key, color] of Object.entries(AGENT_COLOR_MAP)) {
    if (lower.includes(key)) return color
  }
  // Deterministic fallback based on hash
  let hash = 0
  for (let i = 0; i < agentId.length; i++) {
    hash = ((hash << 5) - hash + agentId.charCodeAt(i)) | 0
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length]
}

export function getAgentInitials(name: string): string {
  const parts = name.split(/[\s\-_]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}
