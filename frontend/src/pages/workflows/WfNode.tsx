import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Play, Clock, Webhook, GitBranch, Split, Code, Sparkles, Globe, Table, Mail, Bell, Edit3,
         MessageCircle, MessageSquare, MessagesSquare, FileText, Database, Scan,
         Repeat, Timer, GitMerge, GitFork, Shuffle, UserCheck, HardDrive } from 'lucide-react'

const ICONS: Record<string, any> = {
  manualTrigger: Play, scheduleTrigger: Clock, webhookTrigger: Webhook,
  if: GitBranch, switch: Split, condition: GitBranch,
  code: Code, ai: Sparkles, http: Globe, excel: Table, email: Mail, notification: Bell, set: Edit3,
  feishu: MessageCircle, dingtalk: MessageSquare, wecom: MessagesSquare,
  document: FileText, database: Database, scraper: Scan,
  loop: Repeat, delay: Timer, merge: GitMerge, subWorkflow: GitFork,
  transform: Shuffle, approval: UserCheck, kvStore: HardDrive,
}
const GRP_CLR: Record<string, string> = {
  trigger: '#22c55e', logic: '#f59e0b', ai: '#a855f7', data: '#3b82f6', action: '#06b6d4', notify: '#f97316',
}
const STATUS_CLR: Record<string, string> = { completed: '#22c55e', failed: '#ef4444', running: '#3b82f6', skipped: '#9ca3af' }

function WfNodeComponent({ data, selected }: NodeProps) {
  const { label, nodeType, catalog, execState } = data as any
  const def = (catalog || []).find((c: any) => c.name === nodeType)
  const group = def?.group || 'action'
  const Icon = ICONS[nodeType] || Code
  const baseClr = GRP_CLR[group] || '#6b7280'
  const ins = def?.inputs ?? 1; const outs = def?.outputs ?? 1
  const borderClr = execState?.status ? (STATUS_CLR[execState.status] || 'var(--border)') : (selected ? baseClr : 'var(--border)')

  return (
    <div className="relative" style={{ minWidth: 180 }}>
      {/* Status indicator */}
      {execState?.status && <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full border-2 z-10"
        style={{ background: STATUS_CLR[execState.status] || '#6b7280', borderColor: 'var(--bg)' }}>
        {execState.status === 'running' && <div className="w-full h-full rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />}
      </div>}

      {ins > 0 && <Handle type="target" position={Position.Left} id="in-0"
        style={{ width: 8, height: 8, background: baseClr, border: '2px solid var(--bg)' }} />}

      <div className={`px-3 py-2 rounded-lg text-xs transition-all ${selected ? 'shadow-lg' : 'shadow-sm'}`}
        style={{ background: 'var(--bg-surface)', border: `2px solid ${borderClr}`, borderLeft: `4px solid ${baseClr}` }}>
        <div className="flex items-center gap-2">
          <Icon size={14} style={{ color: baseClr }} />
          <span className="font-medium truncate" style={{ color: 'var(--text)' }}>{label || def?.displayName || nodeType}</span>
        </div>
        {execState?.duration > 0 && <div className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{execState.duration.toFixed(2)}s</div>}
        {!execState?.duration && def?.displayName && label !== def.displayName && (
          <div className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{def.displayName}</div>)}
      </div>

      {Array.from({ length: outs }).map((_, i) => (
        <Handle key={i} type="source" position={Position.Right} id={`out-${i}`}
          style={{ width: 8, height: 8, background: baseClr, border: '2px solid var(--bg)',
            top: outs === 1 ? '50%' : `${20 + (i * 60) / Math.max(outs - 1, 1)}%` }} />
      ))}
    </div>
  )
}

export default memo(WfNodeComponent)
