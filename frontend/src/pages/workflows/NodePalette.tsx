import { useState, useMemo } from 'react'
import { Search, X, Code, Play, Clock, Webhook, GitBranch, Split, Sparkles, Globe, Table, Mail, Bell, Edit3,
         MessageCircle, MessageSquare, MessagesSquare, FileText, Database, Scan,
         Repeat, Timer, GitMerge, GitFork, Shuffle, UserCheck, HardDrive } from 'lucide-react'
import type { NodeTypeDef } from '../../api/workflow'

const ICONS: Record<string, any> = {
  manualTrigger: Play, scheduleTrigger: Clock, webhookTrigger: Webhook,
  if: GitBranch, switch: Split, condition: GitBranch,
  code: Code, ai: Sparkles, http: Globe, excel: Table, email: Mail, notification: Bell, set: Edit3,
  feishu: MessageCircle, dingtalk: MessageSquare, wecom: MessagesSquare,
  document: FileText, database: Database, scraper: Scan,
  loop: Repeat, delay: Timer, merge: GitMerge, subWorkflow: GitFork,
  transform: Shuffle, approval: UserCheck, kvStore: HardDrive,
}
const GRP_LABEL: Record<string, string> = { trigger: '触发器', logic: '逻辑', ai: 'AI', data: '数据', action: '动作', notify: '通知' }
const GRP_ORDER = ['trigger', 'logic', 'ai', 'data', 'action', 'notify']

export default function NodePalette({ catalog, onAdd }: { catalog: NodeTypeDef[]; onAdd: (n: NodeTypeDef) => void }) {
  const [q, setQ] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const grouped = useMemo(() => {
    const f = q.trim() ? catalog.filter(n => n.displayName.includes(q) || n.name.includes(q.toLowerCase())) : catalog
    const g: Record<string, NodeTypeDef[]> = {}
    for (const n of f) { const k = n.group || 'action'; (g[k] ??= []).push(n) }
    return g
  }, [catalog, q])

  return (
    <div className="w-[220px] flex flex-col border-r shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
      <div className="p-2">
        <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <Search size={12} style={{ color: 'var(--text-muted)' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="搜索节点..."
            className="flex-1 text-xs bg-transparent outline-none" style={{ color: 'var(--text)' }} />
          {q && <button onClick={() => setQ('')}><X size={10} style={{ color: 'var(--text-muted)' }} /></button>}
        </div>
      </div>
      <div className="flex-1 overflow-auto px-2 pb-2">
        {GRP_ORDER.filter(g => grouped[g]?.length).map(g => (
          <div key={g} className="mb-2">
            <button onClick={() => setCollapsed(p => ({ ...p, [g]: !p[g] }))}
              className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-medium uppercase"
              style={{ color: 'var(--text-muted)' }}>{GRP_LABEL[g] || g} <span className="text-[9px]">{collapsed[g] ? '▶' : '▼'}</span></button>
            {!collapsed[g] && <div className="space-y-0.5">
              {(grouped[g] || []).map(n => { const I = ICONS[n.name] || Code; return (
                <button key={n.name} onClick={() => onAdd(n)} title={n.description}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-[var(--bg-hover)] text-left"
                  style={{ color: 'var(--text-muted)' }}><I size={13} /><span className="flex-1 truncate">{n.displayName}</span></button>
              )})}
            </div>}
          </div>))}
      </div>
    </div>
  )
}
