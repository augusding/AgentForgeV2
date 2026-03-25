import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Play, Clock, Webhook, GitBranch, Split, Code, Sparkles, Globe, Table, Mail, Bell, Edit3,
         MessageCircle, MessageSquare, MessagesSquare, FileText, Database, Scan } from 'lucide-react'

const ICONS: Record<string, any> = {
  manualTrigger: Play, scheduleTrigger: Clock, webhookTrigger: Webhook,
  if: GitBranch, switch: Split, condition: GitBranch,
  code: Code, ai: Sparkles, http: Globe, excel: Table, email: Mail, notification: Bell, set: Edit3,
  feishu: MessageCircle, dingtalk: MessageSquare, wecom: MessagesSquare,
  document: FileText, database: Database, scraper: Scan,
}
const GRP_CLR: Record<string, string> = {
  trigger: '#22c55e', logic: '#f59e0b', ai: '#a855f7', data: '#3b82f6', action: '#06b6d4', notify: '#f97316',
}

function WfNodeComponent({ data, selected }: NodeProps) {
  const { label, nodeType, catalog } = data as any
  const def = (catalog || []).find((c: any) => c.name === nodeType)
  const group = def?.group || 'action'
  const Icon = ICONS[nodeType] || Code
  const color = GRP_CLR[group] || '#6b7280'
  const ins = def?.inputs ?? 1
  const outs = def?.outputs ?? 1

  return (
    <div style={{ minWidth: 180 }}>
      {ins > 0 && <Handle type="target" position={Position.Left} id="in-0"
        style={{ width: 8, height: 8, background: color, border: '2px solid var(--bg)' }} />}
      <div className={`px-3 py-2 rounded-lg text-xs ${selected ? 'shadow-lg' : 'shadow-sm'}`}
        style={{ background: 'var(--bg-surface)', border: `2px solid ${selected ? color : 'var(--border)'}`, borderLeft: `4px solid ${color}` }}>
        <div className="flex items-center gap-2">
          <Icon size={14} style={{ color }} />
          <span className="font-medium truncate" style={{ color: 'var(--text)' }}>{label || def?.displayName || nodeType}</span>
        </div>
        {def?.displayName && label !== def.displayName && (
          <div className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{def.displayName}</div>
        )}
      </div>
      {Array.from({ length: outs }).map((_, i) => (
        <Handle key={i} type="source" position={Position.Right} id={`out-${i}`}
          style={{ width: 8, height: 8, background: color, border: '2px solid var(--bg)',
            top: outs === 1 ? '50%' : `${20 + (i * 60) / Math.max(outs - 1, 1)}%` }} />
      ))}
    </div>
  )
}

export default memo(WfNodeComponent)
