import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'

const NAV_LINKS = [
  { label: '功能', href: '#features' },
  { label: '方案', href: '#how-it-works' },
  { label: '定价', href: '#pricing' },
  { label: '联系我们', href: '#contact' },
]

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (href: string) => {
    setMobileOpen(false)
    const el = document.querySelector(href)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-[#0A0F14]/90 backdrop-blur-md shadow-lg shadow-black/20' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#4ECDC4] flex items-center justify-center">
              <span className="text-[#0A0F14] font-bold text-sm">AF</span>
            </div>
            <span className="text-white font-bold text-lg">AgentForge</span>
          </button>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className="text-[#A0AEC0] hover:text-white text-sm transition-colors"
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-sm text-[#A0AEC0] border border-white/10 rounded-lg hover:border-white/30 hover:text-white transition-all"
            >
              登录
            </button>
            <button
              onClick={() => navigate('/register')}
              className="px-4 py-2 text-sm font-medium bg-[#4ECDC4] text-[#0A0F14] rounded-lg hover:bg-[#45b8b0] transition-colors"
            >
              免费试用
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-[#A0AEC0] hover:text-white"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden bg-[#0A0F14]/95 backdrop-blur-md border-t border-white/5">
          <div className="px-4 py-4 space-y-3">
            {NAV_LINKS.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className="block w-full text-left px-3 py-2 text-[#A0AEC0] hover:text-white text-sm rounded-md hover:bg-white/5 transition-colors"
              >
                {link.label}
              </button>
            ))}
            <div className="flex gap-3 pt-3 border-t border-white/5">
              <button
                onClick={() => navigate('/login')}
                className="flex-1 py-2 text-sm text-[#A0AEC0] border border-white/10 rounded-lg hover:border-white/30 hover:text-white transition-all"
              >
                登录
              </button>
              <button
                onClick={() => navigate('/register')}
                className="flex-1 py-2 text-sm font-medium bg-[#4ECDC4] text-[#0A0F14] rounded-lg hover:bg-[#45b8b0] transition-colors"
              >
                免费试用
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
