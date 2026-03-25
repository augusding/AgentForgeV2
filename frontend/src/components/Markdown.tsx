import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export default function Markdown({ content }: { content: string }) {
  return (
    <div className="markdown-body text-sm leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
        code({ className, children, ...props }) {
          const isInline = !className
          if (isInline) return <code className="inline-code" {...props}>{children}</code>
          return <CodeBlock language={className?.replace('language-', '') || ''} code={String(children).replace(/\n$/, '')} />
        },
      }}>{content}</ReactMarkdown>
    </div>
  )
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  return (
    <div className="relative group rounded-lg overflow-hidden my-2" style={{ background: 'var(--bg)' }}>
      <div className="flex items-center justify-between px-3 py-1 text-[10px]"
        style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
        <span>{language || 'code'}</span>
        <button onClick={copy} className="flex items-center gap-1 hover:text-[var(--accent)] transition-colors">
          {copied ? <><Check size={10} /> 已复制</> : <><Copy size={10} /> 复制</>}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs leading-relaxed" style={{ color: 'var(--text)' }}><code>{code}</code></pre>
    </div>
  )
}
