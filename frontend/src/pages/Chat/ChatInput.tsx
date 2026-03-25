import { useState, useRef, useCallback, useEffect } from 'react'
import { Paperclip, SendHorizontal, Mic, Globe, LayoutDashboard, ShieldAlert, Sparkles, Wrench, ChevronRight } from 'lucide-react'
import SmartToolBar from './SmartToolBar'
import ToolInputPanel from './ToolInputPanel'
import AttachmentChip from './AttachmentChip'
import VoiceRecorderPanel from './VoiceRecorderPanel'
import toast from 'react-hot-toast'
import { uploadFile } from '../../api/chat'
import type { FileAttachment } from '../../types/chat'

const MAX_FILES = 5
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ACCEPT = 'image/*,.pdf,.docx,.xlsx,.xls,.md,.txt,.text,.csv,.json,.yaml,.yml,.mp3,.wav,.m4a,.ogg,.webm'

interface Props {
  /** @deprecated agents prop is no longer used in V7 workstation mode */
  agents?: unknown[]
  onSend: (content: string, targetAgent?: string, attachments?: FileAttachment[], webSearch?: boolean) => void
  disabled?: boolean
  /** Placeholder text override (position-aware) */
  placeholder?: string
  /** Pre-fill the textarea (from workstation AI quick actions) */
  prefillPrompt?: string | null
  onPrefillConsumed?: () => void
}

export default function ChatInput({ onSend, disabled, placeholder, prefillPrompt, onPrefillConsumed }: Props) {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const [showVoicePanel, setShowVoicePanel] = useState(false)
  const [activeSmartTool, setActiveSmartTool] = useState<string | null>(null)
  const [webSearch, setWebSearch] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Prefill from workstation AI quick actions
  useEffect(() => {
    if (!prefillPrompt) return
    setText(prefillPrompt)
    textareaRef.current?.focus()
    onPrefillConsumed?.()
  }, [prefillPrompt])

  const readyAttachments = attachments.filter(a => !a.uploading && !a.error)
  const canSend = (text.trim() || readyAttachments.length > 0) && !disabled

  const handleSend = useCallback((content?: string, extraAttachments?: FileAttachment[]) => {
    const finalContent = content ?? text.trim()
    const finalAttachments = extraAttachments ?? (readyAttachments.length > 0 ? readyAttachments : undefined)
    if (!finalContent && !finalAttachments) return
    onSend(finalContent, undefined, finalAttachments, webSearch)
    if (!content) {
      setText('')
      setAttachments([])
      textareaRef.current?.focus()
    }
  }, [text, readyAttachments, onSend, webSearch])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canSend) handleSend()
    }
  }

  // Smart tool buttons: toggle structured panel
  const handleSmartToolSelect = (toolId: string) => {
    setActiveSmartTool(prev => (prev === toolId ? null : toolId))
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const remaining = MAX_FILES - attachments.length
    const toUpload = Array.from(files).slice(0, remaining)

    for (const file of toUpload) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`文件 "${file.name}" 超过 ${MAX_FILE_SIZE / (1024 * 1024)}MB 限制`)
        continue
      }

      const tempId = `uploading-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const placeholder: FileAttachment = {
        file_id: tempId,
        filename: file.name,
        file_type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'document',
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        parsed_text_preview: '',
        uploading: true,
      }

      setAttachments(prev => [...prev, placeholder])

      try {
        const result = await uploadFile(file)
        setAttachments(prev =>
          prev.map(a => a.file_id === tempId ? { ...result, uploading: false } : a)
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : '上传失败'
        setAttachments(prev =>
          prev.map(a => a.file_id === tempId ? { ...a, uploading: false, error: message } : a)
        )
      }
    }

    e.target.value = ''
  }

  const removeAttachment = (fileId: string) => {
    setAttachments(prev => prev.filter(a => a.file_id !== fileId))
  }

  const [showTools, setShowTools] = useState(false)
  const [showSkills, setShowSkills] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)
  const [skills, setSkills] = useState<{ id: string; display_name: string; name: string }[]>([])
  const skillRef = useRef<HTMLDivElement>(null)
  const toolRef = useRef<HTMLDivElement>(null)  // 保留 ref 用于按钮样式

  // 点击外部关闭 Skill 弹出层（实用工具不用外部点击检测，只通过按钮切换）
  useEffect(() => {
    if (!showSkills) return
    const handler = (e: MouseEvent) => {
      if (skillRef.current && !skillRef.current.contains(e.target as Node)) {
        setShowSkills(false)
        setSelectedSkill(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSkills])

  const loadSkills = useCallback(async () => {
    if (skills.length > 0) { setShowSkills(v => !v); return }
    try {
      const res = await fetch('/api/v1/skills/my', {
        headers: { Authorization: `Bearer ${localStorage.getItem('agentforge_token') || ''}` },
      })
      const data = await res.json()
      setSkills((data.skills || data || []).map((s: any) => ({
        id: s.id, display_name: s.display_name || s.name, name: s.name,
      })))
      setShowSkills(true)
    } catch { setShowSkills(v => !v) }
  }, [skills.length])

  const quickBtnClass = `flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
    border border-border text-text-muted
    hover:text-primary hover:border-primary/40 hover:bg-primary/5
    disabled:opacity-40 disabled:cursor-not-allowed transition-colors`

  return (
    <div className="border-t border-border bg-surface py-3">
      {/* 快捷入口 — 4 个按钮 */}
      <div className="flex items-center gap-2 px-4 mb-2">
        {/* 1. 今日概况 */}
        <button
          onClick={() => { if (!disabled) onSend('查看我今天的工作概况') }}
          disabled={disabled}
          className={quickBtnClass}
        >
          <LayoutDashboard size={12} />
          今日概况
        </button>

        {/* 2. 风险检查 */}
        <button
          onClick={() => { if (!disabled) onSend('检查当前有哪些风险和预警') }}
          disabled={disabled}
          className={quickBtnClass}
        >
          <ShieldAlert size={12} />
          风险检查
        </button>

        {/* 3. 我的 Skill — 弹出列表，选中后确认执行 */}
        <div ref={skillRef} className="relative">
          <button
            onClick={loadSkills}
            disabled={disabled}
            className={quickBtnClass}
          >
            <Sparkles size={12} />
            我的 Skill
          </button>
          {showSkills && (
            <div className="absolute bottom-full left-0 mb-1 w-64 max-h-60 overflow-y-auto
                            bg-surface border border-border rounded-lg shadow-lg z-50">
              {skills.length === 0 ? (
                <div className="px-3 py-3 text-xs text-text-muted text-center">暂无已安装的 Skill</div>
              ) : (<>
                <div className="px-3 py-1.5 text-[10px] text-text-muted border-b border-border">
                  点击选择要执行的 Skill
                </div>
                {skills.map(sk => {
                  const selected = selectedSkill === sk.id
                  return (
                    <div
                      key={sk.id}
                      onClick={() => setSelectedSkill(selected ? null : sk.id)}
                      className={`flex items-center justify-between px-3 py-2.5 text-xs cursor-pointer transition-colors ${
                        selected
                          ? 'bg-primary/10 border-l-2 border-primary'
                          : 'hover:bg-surface-hover border-l-2 border-transparent'
                      }`}
                    >
                      <span className={`font-medium ${selected ? 'text-primary' : 'text-text'}`}>{sk.display_name}</span>
                      {selected && <span className="text-[10px] text-primary">已选中</span>}
                    </div>
                  )
                })}
                <div className="flex items-center gap-2 px-3 py-2 border-t border-border">
                  <button
                    onClick={() => {
                      const sk = skills.find(s => s.id === selectedSkill)
                      if (sk) onSend(`使用技能「${sk.display_name}」`)
                      setShowSkills(false)
                      setSelectedSkill(null)
                    }}
                    disabled={!selectedSkill}
                    className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      selectedSkill
                        ? 'text-white bg-primary hover:bg-primary/90'
                        : 'text-text-muted bg-border/50 cursor-not-allowed'
                    }`}
                  >
                    确认执行
                  </button>
                  <button
                    onClick={() => { setSelectedSkill(null); setShowSkills(false) }}
                    className="px-2 py-1.5 text-xs text-text-muted border border-border rounded-md hover:bg-surface-hover transition-colors"
                  >
                    取消
                  </button>
                </div>
              </>)}
            </div>
          )}
        </div>

        {/* 4. 实用工具 — 点击展开 SmartToolBar */}
        <div ref={toolRef} className="relative">
          <button
            onClick={() => setShowTools(v => !v)}
            className={`${quickBtnClass} ${showTools ? '!text-accent !border-accent/40 !bg-accent/5' : ''}`}
          >
            <Wrench size={12} />
            实用工具
            <ChevronRight size={10} className={`transition-transform ${showTools ? 'rotate-90' : ''}`} />
          </button>
        </div>

      </div>

      {/* 实用工具展开区 — 两种状态：未选工具→显示工具列表，已选工具→显示输入面板 */}
      {showTools && (
        activeSmartTool ? (
          <ToolInputPanel
            toolId={activeSmartTool}
            onClose={() => setActiveSmartTool(null)}
            onSend={(content, attachments) => {
              handleSend(content, attachments)
              setActiveSmartTool(null)
              setShowTools(false)
            }}
          />
        ) : (
          <SmartToolBar activeTool={null} onSelect={(id) => setActiveSmartTool(id)} />
        )
      )}

      {/* Attachment chips */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2 px-4">
          {attachments.map(att => (
            <AttachmentChip
              key={att.file_id}
              attachment={att}
              onRemove={() => removeAttachment(att.file_id)}
            />
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 relative px-4">
        {/* Voice recorder floating panel */}
        {showVoicePanel && (
          <VoiceRecorderPanel
            onConfirm={(text) => {
              setText(prev => prev ? prev + text : text)
              setShowVoicePanel(false)
              textareaRef.current?.focus()
            }}
            onClose={() => setShowVoicePanel(false)}
          />
        )}
        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || '和AI助手对话... (Shift+Enter 换行)'}
          rows={1}
          className="flex-1 min-h-[40px] max-h-[120px] px-3 py-2.5 text-sm border border-border rounded-sm
                     bg-surface resize-none focus:outline-none focus:border-primary transition-colors
                     placeholder:text-text-muted"
        />

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT}
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Web search toggle */}
        <button
          onClick={() => setWebSearch(v => !v)}
          className={`flex items-center gap-1.5 px-2.5 h-10 rounded-sm transition-colors shrink-0 text-xs font-medium ${
            webSearch
              ? 'text-accent bg-accent/15 border border-accent/40'
              : 'text-text-muted hover:text-text hover:bg-surface-hover border border-transparent'
          }`}
          title={webSearch ? '网络搜索已开启（点击关闭）' : '开启网络搜索'}
        >
          <Globe size={14} />
          <span>{webSearch ? '联网' : '联网'}</span>
        </button>

        {/* Attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={attachments.length >= MAX_FILES}
          className={`h-10 w-10 flex items-center justify-center rounded-sm transition-colors shrink-0 ${
            attachments.length >= MAX_FILES
              ? 'text-text-muted/40 cursor-not-allowed'
              : 'text-text-muted hover:text-text hover:bg-surface-hover'
          }`}
          title={attachments.length >= MAX_FILES ? `最多 ${MAX_FILES} 个文件` : '附加文件'}
        >
          <Paperclip size={18} />
        </button>

        {/* Voice input */}
        <button
          onClick={() => setShowVoicePanel(v => !v)}
          className={`h-10 w-10 flex items-center justify-center rounded-sm transition-colors shrink-0 ${
            showVoicePanel
              ? 'text-red-500 bg-red-500/10'
              : 'text-text-muted hover:text-text hover:bg-surface-hover'
          }`}
          title={showVoicePanel ? '关闭录音' : '语音输入'}
        >
          <Mic size={18} />
        </button>

        {/* Send */}
        <button
          onClick={() => handleSend()}
          disabled={!canSend}
          className={`h-10 w-10 flex items-center justify-center rounded-sm transition-all shrink-0 ${
            canSend
              ? 'bg-accent text-white hover:opacity-90'
              : 'bg-border text-text-muted cursor-not-allowed'
          }`}
          title={disabled ? '等待回复中...' : '发送 (Enter)'}
        >
          {disabled ? (
            <span className="w-4 h-4 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
          ) : (
            <SendHorizontal size={18} />
          )}
        </button>
      </div>

    </div>
  )
}
