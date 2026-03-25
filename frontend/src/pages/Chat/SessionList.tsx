import { useEffect, useState, useRef } from 'react'
import { MessageSquarePlus, Trash2, Search, X, RefreshCw } from 'lucide-react'
import { useChatStore } from '../../stores/useChatStore'
import ConfirmDialog from '../../components/ConfirmDialog'

function timeAgo(dateStr: string): string {
  if (!dateStr) return ''
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return new Date(dateStr).toLocaleDateString()
}

export default function SessionList() {
  const sessions = useChatStore((s) => s.sessions)
  const sessionId = useChatStore((s) => s.sessionId)
  const loadSessions = useChatStore((s) => s.loadSessions)
  const switchSession = useChatStore((s) => s.switchSession)
  const deleteSession = useChatStore((s) => s.deleteSession)
  const createNewSession = useChatStore((s) => s.createNewSession)
  const renameSession = useChatStore((s) => s.renameSession)
  const sessionsError = useChatStore((s) => s.sessionsError)

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  const handleDoubleClick = (sid: string, currentTitle: string) => {
    setEditingId(sid)
    setEditTitle(currentTitle)
  }

  const handleRenameSubmit = () => {
    if (editingId && editTitle.trim()) {
      renameSession(editingId, editTitle.trim())
    }
    setEditingId(null)
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit()
    } else if (e.key === 'Escape') {
      setEditingId(null)
    }
  }

  // Filter sessions by search query
  const filteredSessions = searchQuery.trim()
    ? sessions.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : sessions

  return (
    <div className="flex flex-col">
      {/* New chat button */}
      <button
        onClick={createNewSession}
        className="flex items-center gap-2 px-3 py-2 mx-2 mb-1 text-sm font-medium text-accent hover:bg-accent/10 rounded-md transition-colors"
      >
        <MessageSquarePlus size={16} />
        <span>新建对话</span>
      </button>

      {/* Search input */}
      <div className="relative mx-2 mb-1">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="搜索对话..."
          className="w-full pl-8 pr-7 py-1.5 text-xs rounded-md bg-surface-hover border-0 text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/40"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* P2 Task 8: Session load error */}
      {sessionsError && (
        <div className="flex items-center gap-2 mx-2 mb-1 px-3 py-2 text-xs text-warning bg-warning/5 border border-warning/20 rounded-md">
          <span className="flex-1 truncate">加载失败</span>
          <button
            onClick={loadSessions}
            className="flex items-center gap-1 text-warning hover:text-warning/80 underline shrink-0"
          >
            <RefreshCw size={12} />
            重试
          </button>
        </div>
      )}

      {/* Session list */}
      <div className="space-y-0.5 px-2 overflow-y-auto max-h-[calc(100vh-320px)]">
        {filteredSessions.length === 0 && (
          <p className="text-xs text-text-muted px-3 py-2">
            {searchQuery ? '无匹配结果' : '暂无历史对话'}
          </p>
        )}
        {filteredSessions.map((s) => (
          <div
            key={s.session_id}
            className={`group flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
              s.session_id === sessionId
                ? 'bg-accent/10 text-accent'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text'
            }`}
            onClick={() => switchSession(s.session_id)}
            onDoubleClick={() => handleDoubleClick(s.session_id, s.title)}
          >
            <div className="flex-1 min-w-0">
              {editingId === s.session_id ? (
                <input
                  ref={editInputRef}
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  onBlur={handleRenameSubmit}
                  onKeyDown={handleRenameKeyDown}
                  onClick={e => e.stopPropagation()}
                  className="w-full bg-transparent border-b border-accent text-xs font-medium outline-none"
                />
              ) : (
                <div className="truncate text-xs font-medium">{s.title}</div>
              )}
              <div className="flex items-center gap-2 text-[10px] text-text-muted mt-0.5">
                <span>{s.message_count} 条</span>
                <span>{timeAgo(s.last_message_at)}</span>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setDeleteTarget(s.session_id)
              }}
              className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-danger transition-all shrink-0"
              title="删除对话"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          open={!!deleteTarget}
          title="删除对话"
          message="确定要删除这个对话吗？删除后无法恢复。"
          confirmLabel="删除"
          cancelLabel="取消"
          destructive
          onConfirm={() => {
            deleteSession(deleteTarget)
            setDeleteTarget(null)
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
