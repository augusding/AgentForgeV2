/**
 * AI 工作流生成器弹窗 — 从自然语言或业务流程图生成工作流。
 *
 * 支持多轮对话细化，生成后可保存到工作流列表。
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, Zap, Send, Loader2, GitBranch, MessageSquare,
  Save, ExternalLink, ChevronDown, ChevronUp,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { generateWorkflow, createWorkflow, type WFGenerateResult } from '../../api/workflow'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  open: boolean
  onClose: () => void
}

export default function WorkflowGeneratorModal({ open, onClose }: Props) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'text' | 'flowchart'>('text')
  const [prompt, setPrompt] = useState('')
  const [flowchart, setFlowchart] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<WFGenerateResult | null>(null)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  const handleGenerate = useCallback(async () => {
    const userInput = prompt.trim()
    const flowchartInput = flowchart.trim()
    if (!userInput && !flowchartInput) return

    setLoading(true)

    const userMsg: ChatMessage = {
      role: 'user',
      content: mode === 'flowchart'
        ? `[业务流程图]\n${flowchartInput}${userInput ? `\n\n${userInput}` : ''}`
        : userInput,
    }
    const newHistory = [...chatHistory, userMsg]
    setChatHistory(newHistory)
    setPrompt('')

    try {
      const res = await generateWorkflow({
        prompt: userInput,
        mindmap: mode === 'flowchart' ? flowchartInput : undefined,
        history: newHistory.slice(0, -1).map(m => ({
          role: m.role,
          content: m.content,
        })),
      })

      setResult(res)
      setChatHistory([
        ...newHistory,
        { role: 'assistant', content: res.explanation || '工作流已生成。' },
      ])
    } catch (e: any) {
      const errMsg = e?.message || '生成失败'
      setChatHistory([
        ...newHistory,
        { role: 'assistant', content: `生成失败: ${errMsg}` },
      ])
      toast.error(errMsg)
    }
    setLoading(false)
  }, [prompt, flowchart, mode, chatHistory])

  const handleSave = useCallback(async () => {
    if (!result?.workflow) return
    setSaving(true)
    try {
      const saved = await createWorkflow(result.workflow)
      toast.success('工作流已保存')
      onClose()
      navigate(`/workflows/visual/${saved.id}`)
    } catch (e: any) {
      toast.error(`保存失败: ${e.message}`)
    }
    setSaving(false)
  }, [result, onClose, navigate])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!loading && prompt.trim()) handleGenerate()
    }
  }

  const handleReset = () => {
    setChatHistory([])
    setResult(null)
    setPrompt('')
    setFlowchart('')
    setShowPreview(false)
  }

  if (!open) return null

  const nodeCount = result?.workflow?.nodes?.length ?? 0
  const connCount = (result?.workflow as any)?.connections?.length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-xl shadow-2xl w-[680px] max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-accent/10">
              <Zap size={16} className="text-accent" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text">AI 创建工作流</h3>
              <p className="text-[10px] text-text-muted">用自然语言或业务流程图生成工作流</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text rounded transition-colors">
            <X size={16} />
          </button>
        </div>

        <>

        {/* Mode toggle (create tab) */}
        <div className="flex items-center gap-2 px-5 pt-3 shrink-0">
          <button
            onClick={() => setMode('text')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
              mode === 'text'
                ? 'bg-accent/10 text-accent border border-accent/30'
                : 'text-text-muted hover:text-text border border-border hover:border-primary/30'
            }`}
          >
            <MessageSquare size={12} /> 自然语言
          </button>
          <button
            onClick={() => setMode('flowchart')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
              mode === 'flowchart'
                ? 'bg-accent/10 text-accent border border-accent/30'
                : 'text-text-muted hover:text-text border border-border hover:border-primary/30'
            }`}
          >
            <GitBranch size={12} /> 业务流程图
          </button>

          {chatHistory.length > 0 && (
            <button
              onClick={handleReset}
              className="ml-auto text-[10px] text-text-muted hover:text-error transition-colors"
            >
              重置
            </button>
          )}
        </div>

        {/* Chat history */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3 min-h-[200px]">
          {chatHistory.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-text-muted py-8">
              <Zap size={32} className="mb-3 opacity-30" />
              {mode === 'text' ? (
                <>
                  <p className="text-xs font-medium mb-1">描述你的业务场景，AI 帮你设计工作流</p>
                  <p className="text-[10px] text-text-muted/60 mb-4">
                    说清楚「谁 → 做什么 → 什么条件 → 走哪条路」，效果最好
                  </p>
                  <div className="w-full max-w-[480px] space-y-2 text-[10px]">
                    <div className="px-3 py-2 rounded-lg bg-bg border border-border/50 hover:border-accent/30 cursor-default transition-colors">
                      <span className="text-accent/80 font-medium">素材审核</span>
                      <span className="text-text-muted ml-1.5">— "AI 自动评估素材质量分，70 分以上自动通过发布，70 分以下转人工审核，审核不通过则通知创作者修改"</span>
                    </div>
                    <div className="px-3 py-2 rounded-lg bg-bg border border-border/50 hover:border-accent/30 cursor-default transition-colors">
                      <span className="text-accent/80 font-medium">客服工单</span>
                      <span className="text-text-muted ml-1.5">— "客户提交问题后 AI 自动分类，技术问题转技术组，退款问题转财务，投诉升级主管处理"</span>
                    </div>
                    <div className="px-3 py-2 rounded-lg bg-bg border border-border/50 hover:border-accent/30 cursor-default transition-colors">
                      <span className="text-accent/80 font-medium">数据报表</span>
                      <span className="text-text-muted ml-1.5">— "每天定时拉取销售数据，AI 生成分析摘要，异常指标自动预警通知"</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs font-medium mb-1">粘贴业务流程图，AI 将其转为可执行工作流</p>
                  <p className="text-[10px] text-text-muted/60 mb-3">
                    用文字描述每个步骤及流转条件，按顺序写清「步骤 → 判断 → 分支」即可
                  </p>
                </>
              )}
            </div>
          )}

          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-accent/10 text-text'
                  : 'bg-bg border border-border text-text'
              }`}>
                <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg border border-border">
                <Loader2 size={14} className="animate-spin text-accent" />
                <span className="text-[10px] text-text-muted">AI 正在分析业务逻辑并生成工作流...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Generated workflow preview */}
        {result && (
          <div className="mx-5 mb-2 border border-accent/30 rounded-lg bg-accent/5 shrink-0">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs"
            >
              <span className="flex items-center gap-2 text-accent font-medium">
                <Zap size={12} />
                已生成: {result.workflow.name} ({nodeCount} 个节点, {connCount} 个连接)
              </span>
              {showPreview ? <ChevronUp size={12} className="text-text-muted" /> : <ChevronDown size={12} className="text-text-muted" />}
            </button>
            {showPreview && (
              <div className="px-3 pb-2">
                <pre className="text-[10px] text-text-muted bg-bg rounded p-2 max-h-[150px] overflow-auto">
                  {JSON.stringify(result.workflow, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Flowchart input (when in flowchart mode) */}
        {mode === 'flowchart' && !chatHistory.length && (
          <div className="px-5 pb-2 shrink-0">
            <textarea
              value={flowchart}
              onChange={e => setFlowchart(e.target.value)}
              placeholder={`在此描述业务流程（按步骤写即可）：

1. 接收客户提交的售后申请
2. AI 自动判断问题类型（退款/换货/维修）
3. 退款类 → 检查金额是否超过 500 元
   - 超过 500 → 转主管审批
   - 未超过 → 自动处理退款
4. 换货类 → 检查库存后创建换货单
5. 维修类 → 生成维修工单，通知售后团队
6. 处理完成后发送通知给客户`}
              rows={7}
              className="w-full px-3 py-2 text-xs border border-border rounded-lg bg-bg resize-none focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        )}

        {/* Input + Actions */}
        <div className="px-5 py-3 border-t border-border shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                result
                  ? '继续优化... (如 "在审批不通过后增加一个邮件通知"、"把 AI 评分阈值改为 80 分")'
                  : mode === 'flowchart'
                    ? '对流程图的补充说明... (如 "退款超时未处理自动升级")'
                    : '描述你的业务场景和流转逻辑...'
              }
              rows={2}
              className="flex-1 px-3 py-2 text-xs border border-border rounded-lg bg-surface resize-none focus:outline-none focus:border-accent transition-colors"
            />
            <button
              onClick={handleGenerate}
              disabled={loading || (!prompt.trim() && !flowchart.trim())}
              className="h-[52px] px-4 flex items-center gap-1.5 text-xs font-medium text-white bg-accent rounded-lg hover:bg-accent/90 disabled:opacity-40 transition-colors shrink-0"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              {result ? '优化' : '生成'}
            </button>
          </div>

          {/* Save / Open actions */}
          {result && (
            <div className="flex items-center gap-2 mt-2.5">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-success rounded-lg hover:bg-success/90 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                保存到工作流
              </button>
              <button
                onClick={async () => {
                  if (!result.workflow) return
                  setSaving(true)
                  try {
                    const saved = await createWorkflow(result.workflow)
                    onClose()
                    navigate(`/workflows/visual/${saved.id}`)
                  } catch (e: any) {
                    toast.error(e.message)
                  }
                  setSaving(false)
                }}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary border border-border rounded-lg hover:bg-surface-hover disabled:opacity-50 transition-colors"
              >
                <ExternalLink size={12} />
                保存并打开编辑器
              </button>
            </div>
          )}
        </div>
        </>
      </div>
    </div>
  )
}
