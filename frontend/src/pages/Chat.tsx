import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Send, Plus, MessageSquare, ChevronRight, Search, RefreshCw, Square,
         Paperclip, X, Sparkles, BookOpen, Zap, Wrench, RotateCcw } from 'lucide-react'
import { useChatStore } from '../stores/useChatStore'
import { useAuthStore } from '../stores/useAuthStore'
import { uploadChatFile, getQuickCommands } from '../api/chat'
import { SessionItem, ToolCalls, Collapsible, CopyBtn, FeedbackBtn, timeAgo } from '../components/ChatWidgets'
import ActionCard, { parseCard } from '../components/ActionCards'
import FilePreviewPanel from '../components/FilePreviewPanel'
import client from '../api/client'
import Markdown from '../components/Markdown'
import SlashCommandMenu, { type SlashCommand, type SlashMenuHandle } from '../components/SlashCommandMenu'
import Toolbox, { type ToolDef } from '../components/Toolbox'
import ToolPanel from '../components/ToolPanel'
import VoiceInputButton from '../components/VoiceInputButton'
import toast from 'react-hot-toast'

export default function Chat() {
  const store = useChatStore()
  const { user } = useAuthStore()
  const [input, setInput] = useState(''); const [positionId, setPositionId] = useState('')
  const [uploading, setUploading] = useState(false); const [webSearch] = useState(true)
  const [attachments, setAttachments] = useState<Array<{ file_id: string; filename: string }>>([])
  const [quickCmds, setQuickCmds] = useState<string[]>([])
  const [posInfo, setPosInfo] = useState<any>(null); const [searchQ, setSearchQ] = useState('')
  const [hasKB, setHasKB] = useState(false)
  const [personality, setPersonality] = useState('')
  const [showSlash, setShowSlash] = useState(false); const [slashQ, setSlashQ] = useState('')
  const [previewFile, setPreviewFile] = useState<{ path: string; filename: string; format?: string; size?: number } | null>(null)
  const [activeTool, setActiveTool] = useState<ToolDef | null>(null)
  const [toolboxOpen, setToolboxOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null); const taRef = useRef<HTMLTextAreaElement>(null); const fileRef = useRef<HTMLInputElement>(null)
  const lastEventTime = useRef(0); const idleTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const slashRef = useRef<SlashMenuHandle>(null)
  const isFirstMsg = useRef(true); const pendingToolHint = useRef('')
  const [searchParams, setSearchParams] = useSearchParams()

  const filtered = searchQ.trim() ? store.sessions.filter(s => s.title.toLowerCase().includes(searchQ.toLowerCase())) : store.sessions

  useEffect(() => { store.loadSessions() }, [])

  // URL ?prompt=xxx 自动发送
  useEffect(() => {
    const p = searchParams.get('prompt')
    if (p) { setSearchParams({}, { replace: true }); setTimeout(() => send(p), 600) }
  }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [store.messages])
  useEffect(() => {
    if (user?.active_position) setPositionId(user.active_position)
    else client.get('/workstation/home').then((d: any) => { if (d.position?.position_id) setPositionId(d.position.position_id); setPosInfo(d.position) }).catch(() => {})
  }, [user?.active_position])
  useEffect(() => {
    if (!positionId) return
    client.get(`/positions/${positionId}`).then((d: any) => { setPosInfo(d); setPersonality(d.role || d.description || '') }).catch(() => {})
    client.get('/knowledge/stats').then((d: any) => setHasKB((d.count || d.total_chunks || 0) > 0)).catch(() => {})
    getQuickCommands(positionId).then(c => setQuickCmds((c || []).map((x: any) => x.text))).catch(() => {})
  }, [positionId])

  const adjustH = useCallback(() => { const el = taRef.current; if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 200) + 'px' } }, [])
  const handleUpload = async (files: FileList | null) => {
    if (!files) return; setUploading(true)
    for (const f of Array.from(files).slice(0, 3)) { try { const r = await uploadChatFile(f); setAttachments(p => [...p, { file_id: r.file_id, filename: r.filename }]) } catch { toast.error(`${f.name} 失败`) } }
    setUploading(false)
  }

  const send = async (ov?: string, extraFiles?: Array<{ file_id: string; filename: string }>) => {
    const text = (ov || input).trim(); if (!text || store.streaming) return
    if (!ov) setInput(''); isFirstMsg.current = !store.currentSessionId
    const ca = [...attachments, ...(extraFiles || [])]; setAttachments([])
    store.addUserMessage(text, ca.length ? ca : undefined); store.startAssistant(); store.setStreaming(true); store.setThinking('正在思考...')
    lastEventTime.current = Date.now()
    if (idleTimer.current) clearInterval(idleTimer.current)
    idleTimer.current = setInterval(() => {
      if (Date.now() - lastEventTime.current > 1500) {
        const msgs = useChatStore.getState().messages; const last = msgs[msgs.length - 1]
        if (last?.role === 'assistant' && !last.thinking) store.setThinking('正在思考...')
      }
    }, 500)
    const ctrl = new AbortController(); store.setAbortController(ctrl)
    const token = localStorage.getItem('agentforge_token') || ''; let evt = ''
    try {
      const resp = await fetch('/api/v1/chat/stream', { method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: text, position_id: positionId || '', session_id: store.currentSessionId || undefined, file_ids: ca.map(a => a.file_id), web_search: webSearch || undefined,
          ...(pendingToolHint.current ? { command_metadata: { tool_hint: pendingToolHint.current } } : {}) }) })
      pendingToolHint.current = ''
      const reader = resp.body?.getReader(); const dec = new TextDecoder(); let buf = ''
      while (reader) { const { done, value } = await reader.read(); if (done) break
        buf += dec.decode(value, { stream: true }); const lines = buf.split('\n'); buf = lines.pop() || ''
        for (const l of lines) { if (l.startsWith('event: ')) { evt = l.slice(7).trim(); continue }
          if (!l.startsWith('data: ')) continue
          try { const d = JSON.parse(l.slice(6)); lastEventTime.current = Date.now()
            if (evt === 'thinking') { store.setThinking(d.content || ((d.agent_name || '') + ' 正在思考...')) }
            else if (evt === 'delta') { store.setThinking(''); store.appendDelta(d.content || '') }
            else if (evt === 'tool_start') {
              const tl: Record<string, string> = { document_converter: '🔄 转换文档', web_search: '🌐 搜索中', search_knowledge: '📚 搜索知识库',
                manage_priority: '✅ 管理待办', manage_schedule: '📅 查看日程', calculator: '🔢 计算中', excel_processor: '📗 处理 Excel',
                word_processor: '📄 生成文档', datetime: '🕐 获取时间', code_executor: '💻 执行代码', email_sender: '✉️ 发送邮件' }
              store.addToolCall({ type: 'tool_start', name: d.tool || '', input: d.input })
              store.setThinking(tl[d.tool] || `🔧 ${d.tool}...`)
            }
            else if (evt === 'tool_result') { store.addToolCall({ type: 'tool_result', name: d.tool || '', result: d.result }); store.setThinking('继续生成中...') }
            else if (evt === 'done') { store.setThinking(''); store.finishAssistant({ model: d.model, tokens_used: d.tokens_used, duration_ms: d.duration_ms }); if (d.session_id) { store.setSessionId(d.session_id); if (isFirstMsg.current) setTimeout(() => store.generateTitle(), 500) } }
            else if (evt === 'error') { store.setThinking(''); store.appendDelta(`\n\n⚠️ ${d.content || '未知错误'}`) }
          } catch {}; evt = '' } }
    } catch (e: any) { if (e.name !== 'AbortError') { store.appendDelta('\n\n⚠️ 请求出错，请重试。'); toast.error('对话请求失败') } }
    finally { store.setThinking(''); store.setStreaming(false); store.setAbortController(null); if (idleTimer.current) { clearInterval(idleTimer.current); idleTimer.current = null } }
  }

  const stopGen = () => { store.abortController?.abort(); store.setStreaming(false); store.setAbortController(null) }
  const regen = () => { const c = store.regenerate(); if (c) send(c) }
  const clearChat = () => { if (confirm('确认清空当前对话？')) store.newSession() }
  const clr = posInfo?.color || 'var(--accent)'

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <div className="w-[240px] flex flex-col border-r" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
        <div className="p-3"><button onClick={store.newSession} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-[var(--bg-hover)]"
          style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}><Plus size={14} /> 新对话</button></div>
        <div className="px-3 pb-2"><div className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <Search size={12} style={{ color: 'var(--text-muted)' }} />
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="搜索对话..." className="flex-1 bg-transparent outline-none text-xs" style={{ color: 'var(--text)' }} />
          {searchQ && <button onClick={() => setSearchQ('')}><X size={10} style={{ color: 'var(--text-muted)' }} /></button>}
        </div></div>
        <div className="flex-1 overflow-auto px-2 space-y-0.5">
          {filtered.map(s => <SessionItem key={s.id} sess={s} isActive={store.currentSessionId === s.id}
            onSelect={() => store.selectSession(s.id)} onDelete={() => store.removeSession(s.id)} />)}
        </div>
      </div>

      {/* Chat — narrows when preview open */}
      <div className={`flex-1 flex flex-col min-w-0 ${previewFile ? 'max-w-[55%]' : ''} transition-all`}>
        {/* Top bar (#10 + #11) */}
        <div className="flex items-center justify-between px-4 py-2 border-b shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
          <div className="flex items-center gap-2">
            {posInfo && <><div className="w-6 h-6 rounded-md flex items-center justify-center text-xs" style={{ background: `${clr}20`, color: clr }}>✦</div>
              <span className="text-sm font-medium">{posInfo.display_name}</span>
              {posInfo.department && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{posInfo.department}</span>}</>}
          </div>
          {store.messages.length > 0 && <button onClick={clearChat} className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}>
            <RotateCcw size={12} /> 清空</button>}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Welcome (#1 #2 #3) */}
          {store.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full max-w-[650px] mx-auto px-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: `${clr}15` }}>
                <Sparkles size={26} style={{ color: clr }} /></div>
              <h2 className="text-xl font-bold mb-1">{posInfo?.display_name || 'AI'} 助手</h2>
              {personality && <p className="text-xs mb-4 max-w-md text-center" style={{ color: clr }}>{personality.slice(0, 80)}</p>}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full mb-5">
                {[{ icon: MessageSquare, t: '智能对话', d: '专业问答', ok: true },
                  { icon: BookOpen, t: '知识检索', d: hasKB ? '已就绪' : '上传激活', ok: hasKB },
                  { icon: Wrench, t: '工具调用', d: '数据分析', ok: true },
                  { icon: Zap, t: '工作流', d: '自动执行', ok: true }].map((c, i) => (
                  <button key={i} onClick={() => send(c.t === '智能对话' ? quickCmds[0] || '你好' : `帮我${c.t}`)}
                    className="flex flex-col items-center gap-1.5 px-3 py-3.5 rounded-xl text-center hover:border-[var(--accent)]"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', opacity: c.ok ? 1 : 0.6 }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: c.ok ? `${clr}15` : 'var(--bg)', color: c.ok ? clr : 'var(--text-muted)' }}>
                      <c.icon size={18} /></div>
                    <span className="text-xs font-medium">{c.t}</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{c.d}</span></button>))}
              </div>
              {quickCmds.length > 0 && <div className="w-full">
                <p className="text-xs text-center mb-2 flex items-center justify-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <Sparkles size={12} style={{ color: clr }} /> 推荐试试</p>
                <div className="space-y-1.5">{quickCmds.slice(0, 4).map((cmd, i) => (
                  <button key={i} onClick={() => send(cmd)} className="w-full text-left px-4 py-2.5 rounded-xl text-sm hover:border-[var(--accent)] flex items-center gap-2"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                    <ChevronRight size={14} style={{ color: clr }} /><span style={{ color: 'var(--text-muted)' }}>{cmd}</span></button>))}</div>
              </div>}
            </div>)}

          {store.messages.map((msg, i) => <MsgRow key={i} msg={msg} idx={i} isLast={i === store.messages.length - 1} streaming={store.streaming} onRegen={regen} pos={posInfo} onFileClick={setPreviewFile} />)}
          {store.streaming && store.messages.length > 0 && store.messages[store.messages.length - 1]?.thinking && (
            <div className="flex items-center gap-2 px-4 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <div className="flex gap-0.5">
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: '300ms' }} />
              </div>
              <span>{store.messages[store.messages.length - 1]?.thinking}</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="px-4 pb-4 pt-2">
          <div className="max-w-[900px] mx-auto">
            {attachments.length > 0 && <div className="flex gap-2 mb-2 flex-wrap">
              {attachments.map(a => <div key={a.file_id} className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg text-xs"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <Paperclip size={10} style={{ color: 'var(--accent)' }} />
                <span className="max-w-[120px] truncate" style={{ color: 'var(--text)' }}>{a.filename}</span>
                <button onClick={() => setAttachments(p => p.filter(x => x.file_id !== a.file_id))} className="p-0.5 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}><X size={10} /></button>
              </div>)}</div>}
            {activeTool && (
              <ToolPanel tool={activeTool}
                onSubmit={(prompt, toolFiles, toolHint) => {
                  if (toolHint) pendingToolHint.current = toolHint
                  setActiveTool(null); setToolboxOpen(false)
                  send(prompt, toolFiles)
                }}
                onClose={() => setActiveTool(null)} />
            )}
            {!activeTool && (
              <Toolbox onSelectTool={tool => setActiveTool(tool)} expanded={toolboxOpen} onToggle={() => setToolboxOpen(!toolboxOpen)} />
            )}
            <div className="relative">
              <SlashCommandMenu ref={slashRef} query={slashQ} visible={showSlash}
                onSelect={(cmd: SlashCommand) => { setShowSlash(false); setSlashQ('')
                  if (cmd.toolHint) pendingToolHint.current = cmd.toolHint
                  if (cmd.mode === 'direct') { setInput(''); send(cmd.prompt) }
                  else { setInput(cmd.prompt); setTimeout(() => { taRef.current?.focus(); const len = cmd.prompt.length; taRef.current?.setSelectionRange(len, len) }, 50) }
                }} onClose={() => setShowSlash(false)} />
            <div className="rounded-2xl overflow-hidden transition-shadow" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: input.trim() ? '0 2px 12px rgba(0,0,0,0.08)' : 'none' }}>
              <textarea ref={taRef} value={input}
                onChange={e => { const v = e.target.value; setInput(v); adjustH()
                  if (v === '/' || (v.startsWith('/') && v.length <= 20 && !v.includes(' '))) { setSlashQ(v.slice(1)); setShowSlash(true) } else setShowSlash(false) }}
                onKeyDown={e => { if (showSlash && slashRef.current?.handleKey(e)) return; if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="输入消息，/ 快捷命令，Shift+Enter 换行" disabled={store.streaming} rows={1}
                className="w-full px-4 pt-3 pb-2 text-sm outline-none resize-none bg-transparent" style={{ color: 'var(--text)', maxHeight: 200 }} />
              <div className="flex items-center gap-1 px-3 pb-2 pt-0.5">
                <input ref={fileRef} type="file" multiple hidden accept=".pdf,.docx,.txt,.md,.csv,.json,.xlsx,.pptx,.png,.jpg" onChange={e => { handleUpload(e.target.files); e.target.value = '' }} />
                <button onClick={() => fileRef.current?.click()} disabled={uploading} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }} title="上传附件"><Paperclip size={16} /></button>
                <div className="flex-1" />
                <VoiceInputButton onTranscript={t => { setInput(p => p + t); setTimeout(adjustH, 50) }} />
                {store.streaming
                  ? <button onClick={stopGen} className="p-2 rounded-xl" style={{ background: 'var(--error)' }}><Square size={16} className="text-white" /></button>
                  : <button onClick={() => send()} disabled={!input.trim() && !attachments.length} className="p-2 rounded-xl"
                      style={{ background: input.trim() || attachments.length ? 'var(--accent)' : 'var(--border)' }}><Send size={16} className="text-white" /></button>}
              </div>
            </div>
            </div>
            <div className="text-center mt-1.5"><span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>AI 回复仅供参考</span></div>
          </div>
        </div>
      </div>
      {/* Right preview panel */}
      {previewFile && <div className="w-[45%] shrink-0 h-full"><FilePreviewPanel file={previewFile} onClose={() => setPreviewFile(null)} /></div>}
    </div>
  )
}

/* ── MsgRow (#6 #7 #8 #9) ── */
function MsgRow({ msg, idx, isLast, streaming, onRegen, pos, onFileClick }: { msg: any; idx: number; isLast: boolean; streaming: boolean; onRegen: () => void; pos?: any; onFileClick?: (f: any) => void }) {
  const msgId = msg.id || `msg-${idx}`; const clr = pos?.color || 'var(--accent)'

  if (msg.role === 'user') return (
    <div className="flex justify-end"><div className="max-w-[70%]">
      {msg.attachments?.length > 0 && <div className="flex gap-1 mb-1 justify-end">{msg.attachments.map((a: any) =>
        <span key={a.file_id} className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>📎 {a.filename}</span>)}</div>}
      <div className="bg-[var(--accent)] text-white px-4 py-2.5 rounded-xl text-sm whitespace-pre-wrap">{msg.content}</div>
      {msg.created_at && <div className="text-[10px] mt-1 text-right" style={{ color: 'var(--text-muted)' }}>{timeAgo(msg.created_at)}</div>}
    </div></div>)

  return (
    <div className="flex gap-3 justify-start group">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-xs" style={{ background: `${clr}15`, color: clr }}>✦</div>
      <div className="max-w-[85%] min-w-0">
        <div className="text-[10px] mb-1 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
          <span className="font-medium">{pos?.display_name || 'AI'}</span>
          {msg.model && <span>· {msg.model}</span>}</div>
        <div className="rounded-xl text-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="px-4 py-2.5">
            {msg.thinking && !msg.content && <div className="flex items-center gap-2 text-xs py-1" style={{ color: 'var(--text-muted)' }}>
              <div className="w-3 h-3 border-2 border-t-[var(--accent)] border-[var(--border)] rounded-full animate-spin" /><span>{msg.thinking}</span></div>}
            {msg.tool_calls?.length > 0 && <ToolCalls tools={msg.tool_calls} />}
            {msg.content && <Collapsible><Markdown content={msg.content} /></Collapsible>}
            {msg.thinking && msg.content && <div className="flex items-center gap-2 text-xs py-2 mt-1 border-t" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
              <div className="w-3 h-3 border-2 border-t-[var(--accent)] border-[var(--border)] rounded-full animate-spin" /><span>{msg.thinking}</span></div>}
            {!msg.content && !msg.thinking && !(msg.tool_calls?.length) && <span style={{ color: 'var(--text-muted)' }}>思考中...</span>}
            {msg.tool_calls?.filter((tc: any) => tc.type === 'tool_result' && tc.result).map((tc: any, i: number) => {
              const card = parseCard(tc.name, tc.result); return card ? <ActionCard key={i} card={card} onFileClick={onFileClick} /> : null
            })}
          </div>
          {msg.content && <div className="flex items-center gap-1 px-3 py-1.5 border-t opacity-0 group-hover:opacity-100 transition-opacity" style={{ borderColor: 'var(--border)' }}>
            <CopyBtn text={msg.content} /><FeedbackBtn msgId={msgId} />
            {isLast && !streaming && <button onClick={onRegen} className="p-1 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}><RefreshCw size={13} /></button>}
            <span className="ml-auto flex items-center gap-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {(msg.duration_ms ?? 0) > 0 && <span>{(msg.duration_ms / 1000).toFixed(1)}s</span>}
              {(msg.tokens_used ?? 0) > 0 && <span>{msg.tokens_used} tok</span>}
              {msg.created_at && <span>{timeAgo(msg.created_at)}</span>}</span>
          </div>}
        </div>
      </div>
    </div>)
}
