import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff } from 'lucide-react'

const SR = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null

export default function VoiceInputButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [on, setOn] = useState(false)
  const [interim, setInterim] = useState('')
  const ref = useRef<any>(null)

  if (!SR) return null

  const start = () => {
    if (ref.current) { ref.current.stop(); ref.current = null }
    const r = new SR()
    r.lang = 'zh-CN'; r.continuous = true; r.interimResults = true
    r.onresult = (e: any) => {
      let fin = '', tmp = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) fin += e.results[i][0].transcript
        else tmp += e.results[i][0].transcript
      }
      if (fin) { onTranscript(fin); setInterim('') } else setInterim(tmp)
    }
    r.onerror = () => { setOn(false); setInterim('') }
    r.onend = () => { setOn(false); setInterim(''); ref.current = null }
    r.start(); ref.current = r; setOn(true)
  }

  const stop = () => { ref.current?.stop(); ref.current = null; setOn(false); setInterim('') }

  useEffect(() => () => { ref.current?.stop() }, [])

  return (
    <div className="relative flex items-center">
      {interim && (
        <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 rounded-lg text-xs max-w-[250px] truncate"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          🎤 {interim}
        </div>
      )}
      <button onClick={() => on ? stop() : start()}
        className={`p-2 rounded-xl transition-all ${on ? 'animate-pulse' : ''}`}
        style={{ color: on ? 'white' : 'var(--text-muted)', background: on ? '#ef4444' : 'transparent' }}
        title={on ? '点击停止' : '语音输入'}>
        {on ? <MicOff size={16} /> : <Mic size={16} />}
      </button>
    </div>
  )
}
