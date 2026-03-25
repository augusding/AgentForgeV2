import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Plus, Trash2, MessageSquare, Wrench, ChevronDown, ChevronRight, Search,
         Copy, Check, RefreshCw, Square, Paperclip, X, Sparkles } from 'lucide-react'
import { useChatStore } from '../stores/useChatStore'
import { useAuthStore } from '../stores/useAuthStore'
import { uploadChatFile, getQuickCommands } from '../api/chat'
import client from '../api/client'
import Markdown from '../components/Markdown'
import toast from 'react-hot-toast'

export default function Chat() {
  const store = useChatStore()
  const { user } = useAuthStore()
  const [input, setInput] = useState('')
  const [positionId, setPositionId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [attachments, setAttachments] = useState<Array<{ file_id: string; filename: string; extracted_text?: string }>>([])
  const [quickCmds, setQuickCmds] = useState<string[]>([])
  const [posInfo, setPosInfo] = useState<any>(null)
  const [searchQ, setSearchQ] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const isFirstMsg = useRef(true)

  const filteredSessions = searchQ.trim()
    ? store.sessions.filter(s => s.title.toLowerCase().includes(searchQ.toLowerCase()))
    : store.sessions

  useEffect(() => { store.loadSessions() }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [store.messages])
  useEffect(() => {
    if (user?.active_position) setPositionId(user.active_position)
    else client.get('/workstation/home').then((d: any) => { if (d.position?.position_id) setPositionId(d.position.position_id); setPosInfo(d.position) }).catch(() => {})
    getQuickCommands().then(c => setQuickCmds((c || []).map((x: any) => x.text))).catch(() => {})
  }, [user?.active_position])
  useEffect(() => { if (positionId && !posInfo) client.get(`/positions/${positionId}`).then((d: any) => setPosInfo(d)).catch(() => {}) }, [positionId])

  const adjustHeight = useCallback(() => { const el = taRef.current; if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 200) + 'px' } }, [])

  const handleUpload = async (files: FileList | null) => {
    if (!files) return; setUploading(true)
    for (const f of Array.from(files).slice(0, 3)) {
      try { const r = await uploadChatFile(f); setAttachments(p => [...p, { file_id: r.file_id, filename: r.filename, extracted_text: r.extracted_text }]) }
      catch { toast.error(`${f.name} 上传失败`) }
    }; setUploading(false)
  }

  const send = async (overrideContent?: string) => {
    const text = (overrideContent || input).trim(); if (!text || store.streaming) return
    if (!overrideContent) setInput(''); isFirstMsg.current = !store.currentSessionId
    const curAtt = [...attachments]; setAttachments([])
    store.addUserMessage(text, curAtt.length ? curAtt : undefined); store.startAssistant(); store.setStreaming(true)
    const ctrl = new AbortController(); store.setAbortController(ctrl)
    const token = localStorage.getItem('agentforge_token') || ''; let evt = ''
    try {
      const resp = await fetch('/api/v1/chat/stream', { method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: text, position_id: positionId || '', session_id: store.currentSessionId || undefined, file_ids: curAtt.map(a => a.file_id) }),
      })
      const reader = resp.body?.getReader(); const dec = new TextDecoder(); let buf = ''
      while (reader) {
        const { done, value } = await reader.read(); if (done) break
        buf += dec.decode(value, { stream: true }); const lines = buf.split('\n'); buf = lines.pop() || ''
        for (const l of lines) {
          if (l.startsWith('event: ')) { evt = l.slice(7).trim(); continue }
          if (!l.startsWith('data: ')) continue
          try { const d = JSON.parse(l.slice(6))
            if (evt === 'thinking') store.setThinking(d.agent_name || d.model || '思考中')
            else if (evt === 'delta') store.appendDelta(d.content || '')
            else if (evt === 'tool_start') store.addToolCall({ type: 'tool_start', name: d.tool || '', input: d.input })
            else if (evt === 'tool_result') store.addToolCall({ type: 'tool_result', name: d.tool || '', result: d.result })
            else if (evt === 'done') { store.finishAssistant({ model: d.model, tokens_used: d.tokens_used, duration_ms: d.duration_ms }); if (d.session_id) { store.setSessionId(d.session_id); if (isFirstMsg.current) setTimeout(() => store.generateTitle(), 500) } }
            else if (evt === 'error') store.appendDelta(`\n\n*错误: ${d.content || ''}*`)
          } catch {}; evt = ''
        }
      }
    } catch (e: any) { if (e.name !== 'AbortError') store.appendDelta('\n\n*请求失败，请重试。*') }
    finally { store.setStreaming(false); store.setAbortController(null) }
  }

  const stopGen = () => { store.abortController?.abort(); store.setStreaming(false); store.setAbortController(null) }
  const regen = () => { const c = store.regenerate(); if (c) send(c) }

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <div className="w-[240px] flex flex-col border-r" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
        <div className="p-3">
          <button onClick={store.newSession} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--bg-hover)]"
            style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}><Plus size={14} /> 新对话</button>
        </div>
        <div className="px-3 pb-2">
          <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <Search size={12} style={{ color: 'var(--text-muted)' }} />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="搜索对话..."
              className="flex-1 bg-transparent outline-none text-xs" style={{ color: 'var(--text)' }} />
            {searchQ && <button onClick={() => setSearchQ('')}><X size={10} style={{ color: 'var(--text-muted)' }} /></button>}
          </div>
        </div>
        <div className="flex-1 overflow-auto px-2 space-y-0.5">
          {filteredSessions.map(s => (
            <SessionItem key={s.id} sess={s} isActive={store.currentSessionId === s.id}
              onSelect={() => store.selectSession(s.id)} onDelete={() => store.removeSession(s.id)} />
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {store.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full max-w-[600px] mx-auto text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: `${posInfo?.color || 'var(--accent)'}20` }}>
                <Sparkles size={24} style={{ color: posInfo?.color || 'var(--accent)' }} /></div>
              <h2 className="text-lg font-bold mb-1">{posInfo?.display_name || 'AI 助手'}</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>{posInfo?.description || '有什么可以帮您？'}</p>
              {quickCmds.length > 0 && <div className="grid grid-cols-2 gap-2 w-full max-w-[500px]">
                {quickCmds.slice(0, 4).map((c, i) => (
                  <button key={i} onClick={() => send(c)} className="text-left px-4 py-3 rounded-xl text-sm hover:border-[var(--accent)]"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                    <span className="line-clamp-2" style={{ color: 'var(--text-muted)' }}>{c}</span></button>))}
              </div>}
            </div>
          )}
          {store.messages.map((msg, i) => <MsgRow key={i} msg={msg} isLast={i === store.messages.length - 1} streaming={store.streaming} onRegen={regen} />)}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
          {attachments.length > 0 && <div className="flex gap-2 mb-2 max-w-[800px] mx-auto">
            {attachments.map(a => (<div key={a.file_id} className="flex items-center gap-1 px-2 py-1 rounded text-xs" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <Paperclip size={10} /><span className="max-w-[120px] truncate">{a.filename}</span>
              <button onClick={() => setAttachments(p => p.filter(x => x.file_id !== a.file_id))} className="hover:text-[var(--error)]"><X size={10} /></button></div>))}
          </div>}
          <div className="flex gap-2 max-w-[800px] mx-auto items-end">
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="p-2.5 rounded-lg hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}><Paperclip size={18} /></button>
            <input ref={fileRef} type="file" multiple hidden accept=".pdf,.docx,.txt,.md,.csv,.json,.png,.jpg" onChange={e => { handleUpload(e.target.files); e.target.value = '' }} />
            <textarea ref={taRef} value={input} onChange={e => { setInput(e.target.value); adjustHeight() }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="输入消息... (Shift+Enter 换行)" disabled={store.streaming} rows={1}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none resize-none"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)', maxHeight: 200 }} />
            {store.streaming
              ? <button onClick={stopGen} className="p-2.5 rounded-lg" style={{ background: 'var(--error)' }}><Square size={16} className="text-white" /></button>
              : <button onClick={() => send()} disabled={!input.trim() && !attachments.length} className="p-2.5 rounded-lg transition-colors"
                  style={{ background: input.trim() || attachments.length ? 'var(--accent)' : 'var(--border)' }}><Send size={16} className="text-white" /></button>}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── SessionItem with rename ── */
function SessionItem({ sess, isActive, onSelect, onDelete }: { sess: { id: string; title: string }; isActive: boolean; onSelect: () => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(sess.title)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (editing) ref.current?.focus() }, [editing])
  useEffect(() => { setTitle(sess.title) }, [sess.title])
  const save = async () => { setEditing(false); if (title.trim() && title !== sess.title) { try { await client.patch(`/chat/sessions/${sess.id}/title`, { title: title.trim() }) } catch { setTitle(sess.title) } } else setTitle(sess.title) }

  return (
    <div onClick={onSelect} className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${isActive ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-hover)]'}`}
      style={{ color: isActive ? 'var(--text)' : 'var(--text-muted)' }}>
      <MessageSquare size={14} className="shrink-0" />
      {editing
        ? <input ref={ref} value={title} onChange={e => setTitle(e.target.value)} onBlur={save} onKeyDown={e => e.key === 'Enter' && save()}
            className="flex-1 bg-transparent outline-none text-sm min-w-0" style={{ color: 'var(--text)' }} onClick={e => e.stopPropagation()} />
        : <span className="flex-1 truncate" onDoubleClick={e => { e.stopPropagation(); setEditing(true) }}>{sess.title || '新对话'}</span>}
      <button onClick={e => { e.stopPropagation(); onDelete() }} className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-[var(--error)]"><Trash2 size={12} /></button>
    </div>
  )
}

/* ── Message Row ── */
function MsgRow({ msg, isLast, streaming, onRegen }: { msg: any; isLast: boolean; streaming: boolean; onRegen: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(msg.content); setCopied(true); toast.success('已复制'); setTimeout(() => setCopied(false), 2000) }

  if (msg.role === 'user') return (
    <div className="flex justify-end"><div className="max-w-[70%]">
      {msg.attachments?.length > 0 && <div className="flex gap-1 mb-1 justify-end">{msg.attachments.map((a: any) => (
        <span key={a.file_id} className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>📎 {a.filename}</span>))}</div>}
      <div className="bg-[var(--accent)] text-white px-4 py-2.5 rounded-xl text-sm whitespace-pre-wrap">{msg.content}</div>
    </div></div>)

  return (
    <div className="flex justify-start group"><div className="max-w-[70%] rounded-xl text-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="px-4 py-2.5">
        {msg.thinking && !msg.content && (
          <div className="flex items-center gap-2 text-xs py-1" style={{ color: 'var(--text-muted)' }}>
            <div className="w-3 h-3 border-2 border-t-[var(--accent)] border-[var(--border)] rounded-full animate-spin" />
            <span>{msg.thinking}...</span>
          </div>)}
        {msg.tool_calls?.length > 0 && <ToolCalls tools={msg.tool_calls} />}
        {msg.content && <Markdown content={msg.content} />}
      </div>
      {msg.content && <div className="flex items-center gap-1 px-3 py-1.5 border-t opacity-0 group-hover:opacity-100 transition-opacity" style={{ borderColor: 'var(--border)' }}>
        <button onClick={copy} className="p-1 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}>{copied ? <Check size={13} style={{ color: 'var(--success)' }} /> : <Copy size={13} />}</button>
        {isLast && !streaming && <button onClick={onRegen} className="p-1 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}><RefreshCw size={13} /></button>}
        {(msg.tokens_used ?? 0) > 0 && <span className="text-[10px] ml-auto" style={{ color: 'var(--text-muted)' }}>{msg.tokens_used} tokens</span>}
      </div>}
    </div></div>)
}

/* ── Tool Calls (enhanced) ── */
function ToolCalls({ tools }: { tools: Array<{ type: string; name: string; input?: any; result?: string }> }) {
  const [open, setOpen] = useState(false)
  const starts = tools.filter(t => t.type === 'tool_start')
  const results = tools.filter(t => t.type === 'tool_result')
  const pairs = starts.map((s, i) => ({ name: s.name, input: s.input, result: results[i]?.result, done: !!results[i] }))
  const allDone = pairs.every(p => p.done)
  const Arr = open ? ChevronDown : ChevronRight

  return (
    <div className="mb-3 rounded-lg p-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-xs w-full hover:text-[var(--accent)]" style={{ color: 'var(--text-muted)' }}>
        {allDone ? <Check size={12} style={{ color: 'var(--success)' }} /> : <div className="w-3 h-3 border-2 border-t-[var(--accent)] border-[var(--border)] rounded-full animate-spin" />}
        <span>使用了 {pairs.length} 个工具: {pairs.map(p => p.name).join(', ')}</span><Arr size={12} className="ml-auto" />
      </button>
      {open && <div className="mt-2 space-y-2">{pairs.map((p, i) => (
        <div key={i} className="text-xs pl-5">
          <div className="flex items-center gap-1">
            {p.done ? <Check size={10} style={{ color: 'var(--success)' }} /> : <div className="w-2.5 h-2.5 border border-t-[var(--accent)] border-[var(--border)] rounded-full animate-spin" />}
            <span className="font-medium" style={{ color: 'var(--accent)' }}>{p.name}</span></div>
          {p.input && <pre className="mt-1 p-2 rounded text-[10px] overflow-x-auto" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>{typeof p.input === 'string' ? p.input : JSON.stringify(p.input, null, 2)}</pre>}
          {p.result && <pre className="mt-1 p-2 rounded text-[10px] overflow-x-auto" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>{p.result.slice(0, 500)}</pre>}
        </div>))}</div>}
    </div>)
}
