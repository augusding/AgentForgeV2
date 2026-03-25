import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, Square, RotateCcw, Check, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  onConfirm: (text: string) => void
  onClose: () => void
}

type Stage = 'recording' | 'transcribing' | 'result'

export default function VoiceRecorderPanel({ onConfirm, onClose }: Props) {
  const [stage, setStage] = useState<Stage>('recording')
  const [elapsed, setElapsed] = useState(0)
  const [resultText, setResultText] = useState('')
  const [rawText, setRawText] = useState('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number>(0)
  const barsRef = useRef<HTMLDivElement>(null)

  // Start recording on mount
  useEffect(() => {
    startRecording()
    return () => cleanup()
  }, [])

  // Timer
  useEffect(() => {
    if (stage === 'recording') {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
      return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }
  }, [stage])

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    cancelAnimationFrame(animFrameRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    mediaRecorderRef.current = null
    streamRef.current = null
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Audio analyser for waveform visualization
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64
      source.connect(analyser)
      analyserRef.current = analyser
      animateWaveform()

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      })
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => handleRecordingDone()
      recorder.onerror = () => {
        toast.error('录音出错')
        onClose()
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setStage('recording')
      setElapsed(0)
    } catch {
      toast.error('无法访问麦克风，请检查浏览器权限')
      onClose()
    }
  }

  const animateWaveform = () => {
    const analyser = analyserRef.current
    const container = barsRef.current
    if (!analyser || !container) {
      animFrameRef.current = requestAnimationFrame(animateWaveform)
      return
    }
    const data = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(data)

    const bars = container.children
    const barCount = bars.length
    for (let i = 0; i < barCount; i++) {
      const idx = Math.floor((i / barCount) * data.length)
      const val = data[idx] / 255
      const height = Math.max(4, val * 40)
      ;(bars[i] as HTMLElement).style.height = `${height}px`
    }
    animFrameRef.current = requestAnimationFrame(animateWaveform)
  }

  const handleStop = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  const handleRecordingDone = async () => {
    cancelAnimationFrame(animFrameRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    if (blob.size < 1000) {
      toast.error('录音太短，请重试')
      setStage('recording')
      startRecording()
      return
    }

    setStage('transcribing')

    try {
      const formData = new FormData()
      formData.append('audio', blob, 'recording.webm')
      const token = localStorage.getItem('agentforge_token') || ''
      const resp = await fetch('/api/v1/voice/transcribe', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ message: '语音识别失败' }))
        throw new Error(err.message || err.error || '语音识别失败')
      }
      const data = await resp.json()
      const cleaned = data.cleaned_text || data.raw_text || ''
      setRawText(data.raw_text || '')
      setResultText(cleaned)

      if (!cleaned) {
        toast.error('未识别到语音内容')
        setStage('recording')
        startRecording()
        return
      }
      setStage('result')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '语音识别失败')
      setStage('recording')
      startRecording()
    }
  }

  const handleRetry = () => {
    setResultText('')
    setRawText('')
    startRecording()
  }

  const handleConfirm = () => {
    onConfirm(resultText)
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 mx-4 z-50">
      <div className="bg-surface border border-border rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Mic size={14} className={stage === 'recording' ? 'text-red-500' : 'text-accent'} />
            <span className="text-xs font-medium text-text">
              {stage === 'recording' ? '正在录音...' : stage === 'transcribing' ? '识别中...' : '识别结果'}
            </span>
          </div>
          <button
            onClick={() => { cleanup(); onClose() }}
            className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4">
          {stage === 'recording' && (
            <div className="flex flex-col items-center gap-4">
              {/* Waveform bars */}
              <div ref={barsRef} className="flex items-center justify-center gap-[3px] h-12">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-[3px] rounded-full bg-red-500/80 transition-[height] duration-75"
                    style={{ height: '4px' }}
                  />
                ))}
              </div>

              {/* Timer */}
              <div className="text-2xl font-mono text-text tabular-nums">
                {formatTime(elapsed)}
              </div>

              {/* Stop button */}
              <button
                onClick={handleStop}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white text-sm font-medium
                           rounded-full hover:bg-red-600 transition-colors"
              >
                <Square size={14} fill="currentColor" />
                完成录音
              </button>
            </div>
          )}

          {stage === 'transcribing' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 size={28} className="text-accent animate-spin" />
              <span className="text-sm text-text-muted">AI 正在识别语音内容...</span>
            </div>
          )}

          {stage === 'result' && (
            <div className="flex flex-col gap-3">
              {/* Result text (editable) */}
              <textarea
                value={resultText}
                onChange={(e) => setResultText(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm text-text bg-bg border border-border rounded-lg
                           resize-none focus:outline-none focus:border-accent transition-colors"
              />
              {rawText && rawText !== resultText && (
                <p className="text-[10px] text-text-muted">
                  原始识别: {rawText}
                </p>
              )}
              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleConfirm}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-accent text-white
                             text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
                >
                  <Check size={14} />
                  确认使用
                </button>
                <button
                  onClick={handleRetry}
                  className="flex items-center gap-1.5 px-4 py-2 border border-border text-text-muted
                             text-sm rounded-lg hover:bg-surface-hover transition-colors"
                >
                  <RotateCcw size={14} />
                  重新录音
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
