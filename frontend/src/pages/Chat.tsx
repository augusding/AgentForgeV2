import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import { useChatStore } from '../stores/useChatStore'
import Markdown from '../components/Markdown'

export default function Chat() {
  const { messages, streaming, addUserMessage, startAssistant, appendDelta, setStreaming } = useChatStore()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    addUserMessage(text)
    startAssistant()
    setStreaming(true)

    const token = localStorage.getItem('agentforge_token') || ''
    let currentEvent = ''

    try {
      const resp = await fetch('/api/v1/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: text, position_id: 'strategy-pm' }),
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
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (currentEvent === 'delta') appendDelta(data.content || '')
            } catch {}
            currentEvent = ''
          }
        }
      }
    } catch {
      appendDelta('\n\n*请求失败，请重试。*')
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-muted)' }}>
            输入消息开始对话
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] px-4 py-2.5 rounded-xl text-sm ${
              msg.role === 'user' ? 'bg-[var(--accent)] text-white' : ''
            }`} style={msg.role === 'assistant' ? { background: 'var(--bg-surface)', border: '1px solid var(--border)' } : {}}>
              {msg.role === 'assistant' ? <Markdown content={msg.content || '思考中...'} /> : msg.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex gap-2 max-w-[800px] mx-auto">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="输入消息..." disabled={streaming}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          <button onClick={send} disabled={streaming || !input.trim()}
            className="px-4 py-2.5 rounded-lg transition-colors"
            style={{ background: streaming ? 'var(--border)' : 'var(--accent)' }}>
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
