import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calculator, Clock, FileText, Globe, Database, Code2,
  Terminal, Mail, GitBranch, Brain, FileSpreadsheet,
  Presentation, FileDown, Table2, Image, QrCode,
  AudioLines, Bug, Archive, Monitor, Search,
  FileJson, Wrench, ChevronDown, ChevronUp,
  type LucideIcon,
} from 'lucide-react'

/** 工具图标 + 中文名 + 预设 prompt 映射 */
const TOOL_META: Record<string, { icon: LucideIcon; label: string; prompt: string }> = {
  calculator:       { icon: Calculator,      label: '计算器',     prompt: '请帮我计算：' },
  datetime:         { icon: Clock,           label: '日期时间',   prompt: '请帮我处理日期时间相关问题：' },
  text_processor:   { icon: FileText,        label: '文本处理',   prompt: '请帮我处理以下文本：' },
  json_parser:      { icon: FileJson,        label: 'JSON解析',   prompt: '请帮我解析以下JSON数据：' },
  web_search:       { icon: Search,          label: '网络搜索',   prompt: '请帮我搜索：' },
  web_scraper:      { icon: Bug,          label: '网页抓取',   prompt: '请帮我抓取以下网页的内容：' },
  http_request:     { icon: Globe,           label: 'HTTP请求',   prompt: '请帮我调用以下API：' },
  data_analysis:    { icon: Database,        label: '数据分析',   prompt: '请帮我分析以下数据：' },
  code_executor:    { icon: Code2,           label: '代码执行',   prompt: '请帮我编写并执行以下代码：' },
  shell_executor:   { icon: Terminal,        label: 'Shell命令',  prompt: '请帮我执行以下命令：' },
  email_sender:     { icon: Mail,            label: '发送邮件',   prompt: '请帮我起草并发送一封邮件：\n收件人：\n主题：\n内容：' },
  workflow_trigger:  { icon: GitBranch,      label: '触发工作流', prompt: '请帮我触发工作流：' },
  memory_write:     { icon: Brain,           label: '记忆存储',   prompt: '请记住以下信息：' },
  word_processor:   { icon: FileText,        label: 'Word文档',   prompt: '请帮我生成一份Word文档：\n标题：\n内容要求：' },
  excel_processor:  { icon: FileSpreadsheet, label: 'Excel表格',  prompt: '请帮我创建一份Excel表格：\n表格内容：' },
  ppt_processor:    { icon: Presentation,    label: 'PPT演示',    prompt: '请帮我生成一份PPT：\n主题：\n页数：\n内容要求：' },
  pdf_processor:    { icon: FileDown,        label: 'PDF处理',    prompt: '请帮我处理PDF文件：' },
  csv_processor:    { icon: Table2,          label: 'CSV数据',    prompt: '请帮我处理CSV数据：' },
  image_processor:  { icon: Image,           label: '图片处理',   prompt: '请帮我处理图片：' },
  qrcode_tool:      { icon: QrCode,          label: '二维码',     prompt: '请帮我生成二维码，内容为：' },
  audio_processor:  { icon: AudioLines,      label: '音频处理',   prompt: '请帮我处理音频文件：' },
  archive_tool:     { icon: Archive,         label: '压缩解压',   prompt: '请帮我处理压缩文件：' },
  browser_tool:     { icon: Monitor,         label: '浏览器',     prompt: '请帮我在浏览器中操作：' },
  file_ops:         { icon: FileText,        label: '文件操作',   prompt: '请帮我处理文件：' },
}

interface Props {
  tools: string[]
  onSelect: (prompt: string) => void
}

export default function ToolBar({ tools, onSelect }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (!tools.length) return null

  // Map tool names to metadata, filter out unknowns
  const items = tools
    .map(name => {
      const meta = TOOL_META[name]
      if (!meta) return null
      return { name, ...meta }
    })
    .filter(Boolean) as { name: string; icon: LucideIcon; label: string; prompt: string }[]

  if (!items.length) return null

  // Show first row (up to 8), rest in expanded
  const VISIBLE_COUNT = 8
  const visible = expanded ? items : items.slice(0, VISIBLE_COUNT)
  const hasMore = items.length > VISIBLE_COUNT

  return (
    <div className="px-4 pt-2">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Wrench size={12} className="text-text-muted" />
        <span className="text-[10px] text-text-muted font-medium">岗位工具</span>
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-accent hover:text-accent/80 flex items-center gap-0.5 ml-auto"
          >
            {expanded ? '收起' : `展开全部 ${items.length}`}
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <AnimatePresence mode="popLayout">
          {visible.map(item => {
            const Icon = item.icon
            return (
              <motion.button
                key={item.name}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                onClick={() => onSelect(item.prompt)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg
                           border border-border bg-bg hover:border-accent/40 hover:bg-accent/5
                           text-text-secondary hover:text-accent transition-all group"
                title={`使用${item.label}工具`}
              >
                <Icon size={13} className="text-text-muted group-hover:text-accent shrink-0" />
                {item.label}
              </motion.button>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
