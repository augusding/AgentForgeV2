import { useState, useCallback } from 'react'
import { X, Upload, Send, type LucideIcon, Network, GitFork, BarChart3, FileText, ListChecks, Grid2x2, PenLine, Mail } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { uploadFile } from '../../api/chat'
import type { FileAttachment } from '../../types/chat'

// ── 每个工具的面板配置 ────────────────────────────────────────────

type FieldType = 'text' | 'textarea'

interface FieldConfig {
  key: string
  label: string
  type: FieldType
  placeholder: string
  required?: boolean
}

interface ToolPanelConfig {
  id: string
  title: string
  icon: LucideIcon
  fields: FieldConfig[]
  acceptFiles?: string   // file input accept 属性
  fileHint?: string      // 文件区域提示文字
  buildPrompt: (values: Record<string, string>, fileNames: string[]) => string
}

const TOOL_PANEL_CONFIGS: ToolPanelConfig[] = [
  {
    id: 'mindmap',
    title: '思维导图',
    icon: Network,
    fields: [
      { key: 'content', label: '内容或主题', type: 'textarea', placeholder: '输入要整理的内容、大纲或主题…', required: true },
    ],
    acceptFiles: '.txt,.md,.pdf,.docx',
    fileHint: '可拖入 TXT / Word / PDF 文件',
    buildPrompt: (v, files) => {
      const fileNote = files.length > 0 ? `\n\n（已附加文件：${files.join('、')}，请提取其中内容进行整理）` : ''
      return `请将以下内容整理成思维导图格式（用 Markdown 嵌套列表或 Mindmap 代码块输出）：\n\n${v.content}${fileNote}`
    },
  },
  {
    id: 'flowchart',
    title: '流程图',
    icon: GitFork,
    fields: [
      { key: 'content', label: '流程描述', type: 'textarea', placeholder: '描述要绘制的流程，如：用户注册→验证邮箱→激活账号…' },
    ],
    acceptFiles: '.txt,.md,.pdf,.docx',
    fileHint: '可上传流程说明文档',
    buildPrompt: (v, files) => {
      const fileNote = files.length > 0 ? `\n\n（已附加文件：${files.join('、')}，请从中提取流程）` : ''
      return `请将以下流程用 Mermaid 流程图（flowchart TD）表示，输出完整的 mermaid 代码块：\n\n${v.content || '见附件'}${fileNote}`
    },
  },
  {
    id: 'chart',
    title: '数据图表',
    icon: BarChart3,
    fields: [
      { key: 'content', label: '数据或描述', type: 'textarea', placeholder: '粘贴数据，或描述图表需求（如：近12个月销售额对比）…' },
    ],
    acceptFiles: '.xlsx,.xls,.csv',
    fileHint: '可拖入 Excel / CSV 文件',
    buildPrompt: (v, files) => {
      const fileNote = files.length > 0 ? `\n\n（已附加文件：${files.join('、')}，请读取其中数据）` : ''
      return `请根据以下数据生成可视化图表（使用 ECharts 代码块输出，图表类型自动选择最合适的）：\n\n${v.content || '见附件'}${fileNote}`
    },
  },
  {
    id: 'document',
    title: '写文档',
    icon: FileText,
    fields: [
      { key: 'title', label: '文档标题', type: 'text', placeholder: '如：季度复盘报告、产品需求说明书…', required: true },
      { key: 'requirements', label: '内容要求', type: 'textarea', placeholder: '说明文档结构、字数、重点内容、受众等要求…' },
    ],
    acceptFiles: '.txt,.md,.pdf,.docx,.xlsx',
    fileHint: '可上传参考资料或模板文档',
    buildPrompt: (v, files) => {
      const fileNote = files.length > 0 ? `\n参考文件：${files.join('、')}` : ''
      return `请帮我撰写一份完整的文档：\n标题：${v.title}\n要求：${v.requirements || '结构清晰，内容完整'}${fileNote}`
    },
  },
  {
    id: 'tasklist',
    title: '任务拆解',
    icon: ListChecks,
    fields: [
      { key: 'content', label: '目标 / 任务描述', type: 'textarea', placeholder: '输入要拆解的目标或任务，如：完成Q2版本发布…' },
    ],
    acceptFiles: '.txt,.md,.pdf,.docx',
    fileHint: '可上传项目文档、需求文档',
    buildPrompt: (v, files) => {
      const fileNote = files.length > 0 ? `\n\n（已附加文件：${files.join('、')}，请从中提取任务信息）` : ''
      return `请将以下目标拆解为具体可执行的任务清单，按优先级排序，每项任务包含负责人、预期产出、截止时间建议：\n\n${v.content || '见附件'}${fileNote}`
    },
  },
  {
    id: 'swot',
    title: 'SWOT分析',
    icon: Grid2x2,
    fields: [
      { key: 'content', label: '项目 / 方案描述', type: 'textarea', placeholder: '描述要分析的项目、产品或战略方案…' },
    ],
    acceptFiles: '.txt,.md,.pdf,.docx',
    fileHint: '可上传方案文档、调研报告',
    buildPrompt: (v, files) => {
      const fileNote = files.length > 0 ? `\n\n（已附加文件：${files.join('、')}，请从中提取分析内容）` : ''
      return `请对以下项目/方案进行 SWOT 分析，用表格输出优势、劣势、机会、威胁，并给出综合建议：\n\n${v.content || '见附件'}${fileNote}`
    },
  },
  {
    id: 'polish',
    title: '文案润色',
    icon: PenLine,
    fields: [
      { key: 'content', label: '原始文案', type: 'textarea', placeholder: '粘贴需要润色的文案，或上传文档…' },
      { key: 'style', label: '风格要求（选填）', type: 'text', placeholder: '如：正式、简洁、有说服力、面向 C 端用户…' },
    ],
    acceptFiles: '.txt,.md,.pdf,.docx',
    fileHint: '可上传需要润色的文档',
    buildPrompt: (v, files) => {
      const styleNote = v.style ? `\n风格要求：${v.style}` : ''
      const fileNote = files.length > 0 ? `\n\n（已附加文件：${files.join('、')}，请对文件内容进行润色）` : ''
      return `请帮我润色以下文案，要求更加专业、简洁、有感染力${styleNote}：\n\n${v.content || '见附件'}${fileNote}`
    },
  },
  {
    id: 'email',
    title: '写邮件',
    icon: Mail,
    fields: [
      { key: 'recipient', label: '收件人角色', type: 'text', placeholder: '如：客户、上级领导、合作伙伴…' },
      { key: 'purpose', label: '邮件目的', type: 'text', placeholder: '如：跟进合同签署、汇报项目进展…', required: true },
      { key: 'points', label: '主要内容要点', type: 'textarea', placeholder: '列出需要传达的关键信息…' },
    ],
    acceptFiles: '.txt,.md,.pdf,.docx',
    fileHint: '可上传背景资料或往来邮件',
    buildPrompt: (v, files) => {
      const fileNote = files.length > 0 ? `\n背景文件：${files.join('、')}` : ''
      return `请帮我撰写一封专业邮件：\n收件人：${v.recipient || '对方'}\n目的：${v.purpose}\n要点：\n${v.points || '见附件'}${fileNote}`
    },
  },
]

export const SMART_TOOL_IDS = TOOL_PANEL_CONFIGS.map(c => c.id)

// ── 组件 ────────────────────────────────────────────────────────

interface Props {
  toolId: string | null
  onClose: () => void
  onSend: (content: string, attachments?: FileAttachment[]) => void
}

export default function ToolInputPanel({ toolId, onClose, onSend }: Props) {
  const config = TOOL_PANEL_CONFIGS.find(c => c.id === toolId) ?? null

  const [values, setValues] = useState<Record<string, string>>({})
  const [files, setFiles] = useState<FileAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)

  const handleClose = () => {
    setValues({})
    setFiles([])
    onClose()
  }

  const handleChange = (key: string, val: string) => {
    setValues(prev => ({ ...prev, [key]: val }))
  }

  const isValid = () => {
    if (!config) return false
    // If files uploaded, only truly required fields (no file fallback) must be filled
    const hasFiles = files.length > 0
    return config.fields
      .filter(f => f.required)
      .every(f => (values[f.key] ?? '').trim().length > 0 || hasFiles)
  }

  const processFiles = useCallback(async (rawFiles: File[]) => {
    setUploading(true)
    const results: FileAttachment[] = []
    for (const file of rawFiles) {
      try {
        const result = await uploadFile(file)
        results.push(result)
      } catch {
        // ignore individual failures
      }
    }
    setFiles(prev => [...prev, ...results])
    setUploading(false)
  }, [])

  const openFileDialog = useCallback(() => {
    if (!config?.acceptFiles) return
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = config.acceptFiles
    input.onchange = () => {
      const picked = Array.from(input.files ?? [])
      if (picked.length) processFiles(picked)
    }
    // Clean up after dialog closes (whether file selected or cancelled)
    window.addEventListener('focus', function cleanup() {
      setTimeout(() => { input.remove() }, 300)
      window.removeEventListener('focus', cleanup)
    }, { once: true, capture: true })
    document.body.appendChild(input)
    input.click()
  }, [config, processFiles])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const dropped = Array.from(e.dataTransfer.files)
    if (dropped.length) processFiles(dropped)
  }

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.file_id !== fileId))
  }

  const handleSubmit = () => {
    if (!config || !isValid()) return
    const fileNames = files.map(f => f.filename)
    const prompt = config.buildPrompt(values, fileNames)
    const attachments = files.length > 0 ? files : undefined
    onSend(prompt, attachments)
    handleClose()
  }

  return (
    <AnimatePresence>
      {config && (
        <motion.div
          key={config.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.18 }}
          className="mx-4 mb-2 rounded-xl border border-border bg-surface shadow-lg overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-hover">
            <div className="flex items-center gap-2">
              <config.icon size={15} className="text-accent" />
              <span className="text-sm font-medium text-text">{config.title}</span>
            </div>
            <button
              onClick={handleClose}
              className="text-text-muted hover:text-text transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3">
            {/* Fields */}
            {config.fields.map(field => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-0.5">*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    value={values[field.key] ?? ''}
                    onChange={e => handleChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    rows={4}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg
                               resize-none focus:outline-none focus:border-accent transition-colors
                               placeholder:text-text-muted"
                  />
                ) : (
                  <input
                    type="text"
                    value={values[field.key] ?? ''}
                    onChange={e => handleChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg
                               focus:outline-none focus:border-accent transition-colors
                               placeholder:text-text-muted"
                  />
                )}
              </div>
            ))}

            {/* File drop zone */}
            {config.acceptFiles && (
              <div>
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={openFileDialog}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                    dragging
                      ? 'border-accent bg-accent/5 text-accent'
                      : 'border-border hover:border-accent/50 hover:bg-accent/3 text-text-muted'
                  }`}
                >
                  <Upload size={16} />
                  <span className="text-xs">{config.fileHint ?? '拖入文件或点击上传'}</span>
                </div>

                {/* Uploaded file chips */}
                {(files.length > 0 || uploading) && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {files.map(f => (
                      <span
                        key={f.file_id}
                        className="flex items-center gap-1 px-2 py-0.5 text-xs bg-accent/10 text-accent rounded-full"
                      >
                        {f.filename}
                        <button onClick={() => removeFile(f.file_id)} className="hover:text-red-400">
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                    {uploading && (
                      <span className="flex items-center gap-1 px-2 py-0.5 text-xs text-text-muted rounded-full border border-border">
                        <span className="w-3 h-3 border border-text-muted border-t-transparent rounded-full animate-spin" />
                        上传中…
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end px-4 py-2.5 border-t border-border bg-surface-hover">
            <button
              onClick={handleSubmit}
              disabled={!isValid() || uploading}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg font-medium transition-all ${
                isValid() && !uploading
                  ? 'bg-accent text-white hover:opacity-90'
                  : 'bg-border text-text-muted cursor-not-allowed'
              }`}
            >
              <Send size={13} />
              生成
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
