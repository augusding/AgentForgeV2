import { useState, useEffect, useCallback } from 'react'
import { Brain, Trash2, RefreshCw, Edit3, Check, X, Sparkles, MessageSquare, AlertCircle } from 'lucide-react'
import client from '../../api/client'

interface MemoryItem {
  id: string
  content: string
  type: string
  importance: number
  category: string
  source: string
  importance_label: string
  created_at: string
}

type FilterTab = '' | 'distilled' | 'conversation_outcome' | 'user_directive'

const FILTER_TABS: { key: FilterTab; label: string; icon: typeof Brain }[] = [
  { key: '', label: '全部', icon: Brain },
  { key: 'distilled', label: '用户画像', icon: Sparkles },
  { key: 'conversation_outcome', label: '对话记忆', icon: MessageSquare },
  { key: 'user_directive', label: '用户指令', icon: AlertCircle },
]

const CATEGORY_LABELS: Record<string, { text: string; cls: string }> = {
  distilled: { text: '蒸馏', cls: 'bg-accent/10 text-accent' },
  conversation_outcome: { text: '对话', cls: 'bg-info/10 text-info' },
  user_directive: { text: '指令', cls: 'bg-warning/10 text-warning' },
  insight: { text: '洞察', cls: 'bg-success/10 text-success' },
}

export default function MemoryManagement() {
  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<FilterTab>('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchMemories = useCallback(async () => {
    setLoading(true)
    try {
      const q = filter ? `?category=${filter}` : ''
      const res: any = await client.get(`/memories${q}`)
      setMemories(res.memories || [])
    } catch { /* */ }
    finally { setLoading(false) }
  }, [filter])

  useEffect(() => { fetchMemories() }, [fetchMemories])

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除该记忆？AI 将不再记住这条信息。')) return
    setDeleting(id)
    try {
      await client.delete(`/memories/${id}`)
      setMemories(prev => prev.filter(m => m.id !== id))
    } catch { /* */ }
    finally { setDeleting(null) }
  }

  const startEdit = (m: MemoryItem) => {
    setEditingId(m.id)
    setEditContent(m.content)
  }

  const saveEdit = async (id: string) => {
    try {
      await client.put(`/memories/${id}`, { content: editContent })
      setMemories(prev => prev.map(m => m.id === id ? { ...m, content: editContent } : m))
    } catch { /* */ }
    finally { setEditingId(null) }
  }

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) }
    catch { return iso }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Brain size={20} />
            AI 记忆管理
          </h2>
          <p className="text-sm text-text-muted mt-1">
            查看和管理 AI 学到的长期记忆。你可以编辑错误信息或删除不再准确的记忆。
          </p>
        </div>
        <button
          onClick={fetchMemories}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-bg transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          刷新
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1">
        {FILTER_TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === tab.key
                  ? 'bg-accent/10 text-accent border border-accent/30'
                  : 'text-text-muted hover:text-text hover:bg-bg border border-transparent'
              }`}
            >
              <Icon size={12} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {loading && memories.length === 0 ? (
        <div className="text-center text-text-muted py-12">加载中...</div>
      ) : memories.length === 0 ? (
        <div className="text-center text-text-muted py-12">
          <Brain size={40} className="mx-auto mb-3 opacity-30" />
          <p>暂无长期记忆</p>
          <p className="text-xs mt-1">与 AI 对话后，系统会自动提炼关键信息到长期记忆</p>
        </div>
      ) : (
        <div className="space-y-2">
          {memories.map(m => {
            const cat = CATEGORY_LABELS[m.category] || { text: m.category, cls: 'bg-gray-100 text-gray-500' }
            const isEditing = editingId === m.id

            return (
              <div key={m.id} className="border border-border rounded-lg p-4 group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border border-accent/30 rounded-md bg-surface focus:outline-none focus:ring-1 focus:ring-accent"
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(m.id); if (e.key === 'Escape') setEditingId(null) }}
                        />
                        <button onClick={() => saveEdit(m.id)} className="p-1 text-success hover:bg-success/10 rounded">
                          <Check size={14} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1 text-text-muted hover:bg-bg rounded">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed">{m.content}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${cat.cls}`}>{cat.text}</span>
                      <span>重要度 {Math.round(m.importance * 100)}%</span>
                      <span>{formatDate(m.created_at)}</span>
                      {m.source === 'conversation_distillation' && (
                        <span className="text-accent flex items-center gap-0.5"><Sparkles size={10} /> AI 蒸馏</span>
                      )}
                    </div>
                  </div>
                  {!isEditing && (
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(m)}
                        className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/5 rounded transition-colors"
                        title="编辑"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        disabled={deleting === m.id}
                        className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="删除"
                      >
                        <Trash2 size={14} className={deleting === m.id ? 'animate-pulse' : ''} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
