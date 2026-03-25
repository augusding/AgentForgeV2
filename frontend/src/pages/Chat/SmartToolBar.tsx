import { type LucideIcon, GitFork, BarChart3, FileText, ListChecks, Grid2x2, PenLine, Mail, Network } from 'lucide-react'

interface SmartTool {
  id: string
  icon: LucideIcon
  label: string
}

const SMART_TOOLS: SmartTool[] = [
  { id: 'mindmap',   icon: Network,    label: '思维导图' },
  { id: 'flowchart', icon: GitFork,    label: '流程图'   },
  { id: 'chart',     icon: BarChart3,  label: '数据图表' },
  { id: 'document',  icon: FileText,   label: '写文档'   },
  { id: 'tasklist',  icon: ListChecks, label: '任务拆解' },
  { id: 'swot',      icon: Grid2x2,    label: 'SWOT分析' },
  { id: 'polish',    icon: PenLine,    label: '文案润色' },
  { id: 'email',     icon: Mail,       label: '写邮件'   },
]

interface Props {
  activeTool: string | null
  onSelect: (toolId: string) => void
}

export default function SmartToolBar({ activeTool, onSelect }: Props) {
  return (
    <div className="flex items-center gap-1.5 px-4 pb-2 overflow-x-auto scrollbar-none">
      {SMART_TOOLS.map(tool => {
        const Icon = tool.icon
        const isActive = activeTool === tool.id
        return (
          <button
            key={tool.id}
            onClick={() => onSelect(tool.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg shrink-0 transition-all group ${
              isActive
                ? 'border border-accent bg-accent/10 text-accent'
                : 'border border-border bg-bg hover:border-primary/40 hover:bg-primary/5 text-text-secondary hover:text-primary'
            }`}
            title={tool.label}
          >
            <Icon size={13} className={isActive ? 'text-accent' : 'text-text-muted group-hover:text-primary shrink-0'} />
            {tool.label}
          </button>
        )
      })}
    </div>
  )
}
