import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import client from '../../api/client'

export default function SystemTab() {
  const [h, setH] = useState<any>(null)
  useEffect(() => { client.get('/health').then((d: any) => setH(d)).catch(() => {}) }, [])
  if (!h) return <div className="text-center py-8"><Loader2 className="animate-spin mx-auto" size={20} style={{ color: 'var(--accent)' }} /></div>

  const sections = [
    { title: '基本信息', rows: [
      { l: '系统名称', v: h.name || 'AgentForge V2' }, { l: '版本', v: h.version || '-' },
      { l: '运行状态', v: h.status === 'ok' ? '✅ 正常' : '❌ 异常' }] },
    { title: '服务组件', rows: [
      { l: 'LLM 引擎', v: h.llm || '-' }, { l: '数据库', v: h.db || 'SQLite' },
      { l: '可用工具', v: `${h.tools || 0} 个` }, { l: 'WebSocket', v: `${h.ws_connections || 0} 连接` },
      { l: 'Profile', v: (h.profiles || []).join(', ') || '-' }] },
    { title: '引擎能力', rows: [
      { l: '工作流节点', v: `${h.workflow_node_types || 26} 种` },
      { l: '知识库', v: h.knowledge || '-' }] },
  ]

  return (
    <div className="space-y-6">
      {sections.map(s => (
        <div key={s.title} className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <h3 className="text-sm font-medium mb-3">{s.title}</h3>
          <div className="space-y-2">
            {s.rows.map(r => (
              <div key={r.l} className="flex items-center justify-between py-1.5 text-sm">
                <span style={{ color: 'var(--text-muted)' }}>{r.l}</span><span>{r.v}</span></div>))}
          </div>
        </div>))}
    </div>
  )
}
