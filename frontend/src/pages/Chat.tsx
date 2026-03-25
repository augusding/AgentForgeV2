import { useState, useRef, useEffect } from 'react'
import { Send, Plus, Trash2, MessageSquare, Wrench, ChevronDown, ChevronRight } from 'lucide-react'
import { useChatStore } from '../stores/useChatStore'
import type { ToolCall } from '../stores/useChatStore'
import Markdown from '../components/Markdown'

export default function Chat() {
  const store = useChatStore()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const isFirstMsg = useRef(true)

  useEffect(() => { store.loadSessions() }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [store.messages])

  const send = async () => {
    const text = input.trim()
    if (!text || store.streaming) return
    setInput('')
    store.addUserMessage(text)
    store.startAssistant()
    store.setStreaming(true)
    isFirstMsg.current = !store.currentSessionId

    const token = localStorage.getItem('agentforge_token') || ''
    let currentEvent = ''

    try {
      const resp = await fetch('/api/v1/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: text, position_id: 'strategy-pm', session_id: store.currentSessionId || undefined }),
      })
      const reader = resp.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('event: ')) { currentEvent = line.slice(7).trim(); continue }
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (currentEvent === 'delta') store.appendDelta(data.content || '')
            else if (currentEvent === 'tool_start') store.addToolCall({ type: 'tool_start', name: data.tool || '', input: data.input })
            else if (currentEvent === 'tool_result') store.addToolCall({ type: 'tool_result', name: data.tool || '', result: data.result })
            else if (currentEvent === 'done' && data.session_id) {
              store.setSessionId(data.session_id)
              if (isFirstMsg.current) setTimeout(() => store.generateTitle(), 500)
            }
          } catch {}
          currentEvent = ''
        }
      }
    } catch { store.appendDelta('\n\n*请求失败，请重试。*') }
    finally { store.setStreaming(false) }
  }

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <div className="w-[240px] flex flex-col border-r" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
        <div className="p-3">
          <button onClick={store.newSession}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--bg-hover)]"
            style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <Plus size={14} /> 新对话
          </button>
        </div>
        <div className="flex-1 overflow-auto px-2 space-y-0.5">
          {store.loadingSessions && <p className="text-xs text-center p-4" style={{ color: 'var(--text-muted)' }}>加载中...</p>}
          {store.sessions.map(sess => (
            <div key={sess.id} onClick={() => store.selectSession(sess.id)}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                store.currentSessionId === sess.id ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-hover)]'
              }`} style={{ color: store.currentSessionId === sess.id ? 'var(--text)' : 'var(--text-muted)' }}>
              <MessageSquare size={14} className="shrink-0" />
              <span className="flex-1 truncate">{sess.title}</span>
              <button onClick={e => { e.stopPropagation(); store.removeSession(sess.id) }}
                className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-[var(--error)]">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {store.messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-muted)' }}>输入消息开始对话</div>
          )}
          {store.messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] rounded-xl text-sm ${msg.role === 'user' ? 'bg-[var(--accent)] text-white px-4 py-2.5' : ''}`}
                style={msg.role === 'assistant' ? { background: 'var(--bg-surface)', border: '1px solid var(--border)' } : {}}>
                {msg.role === 'assistant' ? (
                  <div className="px-4 py-2.5">
                    {msg.tool_calls && msg.tool_calls.length > 0 && <ToolCallsDisplay tools={msg.tool_calls} />}
                    <Markdown content={msg.content || '思考中...'} />
                  </div>
                ) : msg.content}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex gap-2 max-w-[800px] mx-auto">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="输入消息..." disabled={store.streaming}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            <button onClick={send} disabled={store.streaming || !input.trim()}
              className="px-4 py-2.5 rounded-lg transition-colors"
              style={{ background: store.streaming ? 'var(--border)' : 'var(--accent)' }}>
              <Send size={16} className="text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ToolCallsDisplay({ tools }: { tools: ToolCall[] }) {
  const [expanded, setExpanded] = useState(false)
  const names = [...new Set(tools.filter(t => t.type === 'tool_start').map(t => t.name))]
  const Arrow = expanded ? ChevronDown : ChevronRight
  return (
    <div className="mb-2 text-xs" style={{ color: 'var(--text-muted)' }}>
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 hover:text-[var(--accent)] transition-colors">
        <Wrench size={12} /> <span>调用了 {names.join(', ')}</span> <Arrow size={12} />
      </button>
      {expanded && (
        <div className="mt-1 pl-4 space-y-1 border-l-2" style={{ borderColor: 'var(--border)' }}>
          {tools.map((tc, i) => (
            <div key={i} className="text-xs">
              {tc.type === 'tool_start' && <div><span className="text-[var(--accent)]">→ {tc.name}</span></div>}
              {tc.type === 'tool_result' && <div className="opacity-70">← {(tc.result || '').slice(0, 200)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
