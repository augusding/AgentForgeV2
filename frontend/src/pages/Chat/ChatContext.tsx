import { useState } from 'react'
import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import SessionList from './SessionList'
import UsageTab from './UsageTab'
import QualityTab from './QualityTab'

type Tab = 'usage' | 'quality' | 'history'

const TAB_LABELS: Record<Tab, string> = {
  usage: '📊 用量',
  quality: '🎯 质量',
  history: '📜 历史',
}

export default function ChatContext() {
  const [collapsed, setCollapsed] = useState(false)
  const [tab, setTab] = useState<Tab>('history')

  if (collapsed) {
    return (
      <div className="hidden md:flex w-8 flex-col items-center border-l border-border bg-bg shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="mt-3 p-1 text-text-muted hover:text-text transition-colors"
          title="展开面板"
        >
          <PanelRightOpen size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="hidden md:flex w-[320px] bg-bg border-l border-border flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <div className="flex gap-1">
          {(['usage', 'quality', 'history'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-sm transition-colors ${
                tab === t ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 text-text-muted hover:text-text transition-colors"
          title="收起面板"
        >
          <PanelRightClose size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'usage' ? (
          <UsageTab />
        ) : tab === 'quality' ? (
          <QualityTab />
        ) : (
          <div className="pt-2">
            <SessionList />
          </div>
        )}
      </div>
    </div>
  )
}
