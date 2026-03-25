const COLUMNS = [
  {
    title: '产品',
    links: [
      { label: '功能介绍', href: '#features' },
      { label: '方案定价', href: '#pricing' },
      { label: '使用流程', href: '#how-it-works' },
    ],
  },
  {
    title: '资源',
    links: [
      { label: '使用文档', href: '#' },
      { label: 'API 参考', href: '#' },
      { label: '技术博客', href: '#' },
    ],
  },
  {
    title: '联系我们',
    links: [
      { label: 'contact@agentforge.ai', href: 'mailto:contact@agentforge.ai' },
      { label: '微信公众号: AgentForge', href: '#' },
    ],
  },
]

export default function LandingFooter() {
  const scrollTo = (href: string) => {
    if (href.startsWith('#') && href.length > 1) {
      const el = document.querySelector(href)
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <footer className="bg-[#0A0F14] border-t border-white/5">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[#4ECDC4] flex items-center justify-center">
                <span className="text-[#0A0F14] font-bold text-sm">AF</span>
              </div>
              <span className="text-white font-bold">AgentForge</span>
            </div>
            <p className="text-[#718096] text-sm leading-relaxed">
              AI 智能体驱动的智能工位平台
              <br />
              每个岗位一个 AI 搭档，越用越懂你
            </p>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-white text-sm font-semibold mb-4">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith('#') ? (
                      <button
                        onClick={() => scrollTo(link.href)}
                        className="text-[#718096] hover:text-[#A0AEC0] text-sm transition-colors"
                      >
                        {link.label}
                      </button>
                    ) : (
                      <a
                        href={link.href}
                        className="text-[#718096] hover:text-[#A0AEC0] text-sm transition-colors"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-white/5 text-center">
          <p className="text-[#4A5568] text-xs">
            &copy; 2024-2026 AgentForge. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
