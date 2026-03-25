import { useEffect, useCallback, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { RotateCcw, Bot, Plus } from 'lucide-react'
import ChatMain from './ChatMain'
import ChatInput from './ChatInput'
import ChatContext from './ChatContext'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useChatStore } from '../../stores/useChatStore'
import { useMissionStore } from '../../stores/useMissionStore'
import { useApprovalStore } from '../../stores/useApprovalStore'
import { useWorkstationStore } from '../../stores/useWorkstationStore'
import toast from 'react-hot-toast'
import { uploadFile } from '../../api/chat'
import type { FileAttachment } from '../../types/chat'

export default function Chat() {
  const location = useLocation()
  const messages = useChatStore(s => s.messages)
  const responding = useChatStore(s => s.responding)
  const streamingMessageId = useChatStore(s => s.streamingMessageId)
  const send = useChatStore(s => s.send)
  const clearMessages = useChatStore(s => s.clearMessages)
  const createNewSession = useChatStore(s => s.createNewSession)
  const switchSession = useChatStore(s => s.switchSession)

  const missions = useMissionStore(s => s.missions)
  const approvals = useApprovalStore(s => s.approvals)
  const resolveApproval = useApprovalStore(s => s.resolve)

  // V7: Position-aware chat context
  const home = useWorkstationStore(s => s.home)
  const positionName = home?.position?.display_name || ''
  const positionPersonality = (home?.assistant as any)?.personality || ''
  const knowledgeScope: string[] = home?.knowledge_scope || []
  const onboarding = home?.onboarding

  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const syncFromServer = useChatStore(s => s.syncFromServer)
  const loadFeedbacks = useChatStore(s => s.loadFeedbacks)
  const loadHome = useWorkstationStore(s => s.loadHome)

  // Ensure workstation home data is loaded (position info for chat context)
  useEffect(() => { if (!home) loadHome() }, [home, loadHome])

  // Sync messages and feedbacks from server on mount
  useEffect(() => {
    const timer = setTimeout(() => { syncFromServer(); loadFeedbacks() }, 800)
    return () => clearTimeout(timer)
  }, [syncFromServer, loadFeedbacks])

  // Handle session switch from workstation RecentChats
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const sessionParam = params.get('session')
    if (sessionParam) {
      switchSession(sessionParam)
    }
  }, [location.search, switchSession])

  // Handle prefillPrompt from workstation AI quick actions
  const [prefillPrompt, setPrefillPrompt] = useState<string | null>(null)
  useEffect(() => {
    const state = location.state as { prefillPrompt?: string } | null
    if (state?.prefillPrompt) {
      setPrefillPrompt(state.prefillPrompt)
      window.history.replaceState({}, '')
    }
  }, [location.state])

  const [droppedAttachments, setDroppedAttachments] = useState<FileAttachment[]>([])

  const handleFileDrop = useCallback(async (files: File[]) => {
    const MAX_FILES = 5
    const toUpload = files.slice(0, MAX_FILES)

    for (const file of toUpload) {
      const tempId = `drop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const placeholder: FileAttachment = {
        file_id: tempId,
        filename: file.name,
        file_type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'document',
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        parsed_text_preview: '',
        uploading: true,
      }

      setDroppedAttachments(prev => [...prev, placeholder])
      toast.success(`正在上传 ${file.name}...`, { duration: 2000 })

      try {
        const result = await uploadFile(file)
        setDroppedAttachments(prev =>
          prev.map(a => a.file_id === tempId ? { ...result, uploading: false } : a)
        )
        toast.success(`${file.name} 上传完成`)
      } catch (err) {
        const message = err instanceof Error ? err.message : '上传失败'
        setDroppedAttachments(prev => prev.filter(a => a.file_id !== tempId))
        toast.error(`${file.name}: ${message}`)
      }
    }
  }, [])

  const handleSend = useCallback((content: string, targetAgent?: string, attachments?: FileAttachment[], webSearch?: boolean) => {
    const allAttachments = [...(attachments || []), ...droppedAttachments.filter(a => !a.uploading && !a.error)]
    send(content, undefined, allAttachments.length > 0 ? allAttachments : undefined, webSearch)
    setDroppedAttachments([])
  }, [send, droppedAttachments])

  const handleResolveApproval = useCallback((id: string, decision: string) => {
    resolveApproval(id, decision)
  }, [resolveApproval])

  const activeMission = missions.find(m => m.status === 'in_progress') || null
  const pendingApprovals = approvals.filter(a => a.status === 'pending')

  return (
    <div className="chat-page-root flex bg-bg">
      {/* Center: Header + Messages + Input */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header bar */}
        <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-text">
              {positionName ? `${positionName} AI助手` : 'AI助手'}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={createNewSession}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted
                         hover:text-accent hover:bg-accent/10 rounded-md transition-colors"
              title="新建对话"
            >
              <Plus size={14} />
              新建对话
            </button>
            {messages.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted
                           hover:text-text hover:bg-surface-hover rounded-md transition-colors"
                title="清空对话"
              >
                <RotateCcw size={13} />
                清空对话
              </button>
            )}
          </div>
        </div>

        <ChatMain
          messages={messages}
          mission={activeMission}
          approvals={pendingApprovals}
          onResolveApproval={handleResolveApproval}
          responding={responding}
          streamingMessageId={streamingMessageId}
          onFileDrop={handleFileDrop}
          onSend={(content) => handleSend(content)}
          positionName={positionName}
          positionPersonality={positionPersonality}
          knowledgeScope={knowledgeScope}
          onboarding={onboarding}
        />
        <ChatInput
          onSend={handleSend}
          disabled={responding}
          placeholder={positionName ? `向${positionName}AI助手提问...` : undefined}
          prefillPrompt={prefillPrompt}
          onPrefillConsumed={() => setPrefillPrompt(null)}
        />
      </div>

      {/* Right: Context panel */}
      <ChatContext />

      {/* Clear confirmation dialog */}
      <ConfirmDialog
        open={showClearConfirm}
        title="清空对话"
        message="确定要清空当前所有消息吗？此操作不可撤销。"
        confirmLabel="清空"
        cancelLabel="取消"
        destructive
        onConfirm={() => {
          clearMessages()
          setShowClearConfirm(false)
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  )
}
