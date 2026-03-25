import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/useAuthStore'
import toast from 'react-hot-toast'

export default function LoginForm() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return

    setLoading(true)
    try {
      await login(username.trim(), password)
      if (remember) {
        localStorage.setItem('agentforge_remember', username.trim())
      } else {
        localStorage.removeItem('agentforge_remember')
      }
      toast.success('登录成功')
      navigate('/', { replace: true })
    } catch (err: any) {
      if (err?.status === 429) {
        toast.error('登录尝试过多，请 5 分钟后重试')
      } else {
        toast.error(err?.message || '登录失败，请检查用户名和密码')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Username */}
      <div>
        <label className="block text-sm text-[#A0AEC0] mb-1.5">用户名</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="请输入用户名"
          autoComplete="username"
          autoFocus
          className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm placeholder:text-[#4A5568] focus:outline-none focus:border-[#4ECDC4]/40 transition-colors"
        />
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm text-[#A0AEC0] mb-1.5">密码</label>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码"
            autoComplete="current-password"
            className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm placeholder:text-[#4A5568] focus:outline-none focus:border-[#4ECDC4]/40 transition-colors pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5568] hover:text-[#A0AEC0] transition-colors"
          >
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {/* Remember + Forgot */}
      <div className="flex items-center justify-between text-xs">
        <label className="flex items-center gap-2 text-[#718096] cursor-pointer">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-[#4ECDC4] focus:ring-[#4ECDC4]/30"
          />
          记住我
        </label>
        <button
          type="button"
          onClick={() => toast('请联系管理员重置密码', { icon: 'ℹ️' })}
          className="text-[#4ECDC4]/70 hover:text-[#4ECDC4] transition-colors"
        >
          忘记密码？
        </button>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !username.trim() || !password}
        className="w-full py-3 rounded-xl bg-[#4ECDC4] text-[#0A0F14] font-bold text-sm hover:bg-[#45b8b0] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            登录中...
          </>
        ) : (
          '登录'
        )}
      </button>
    </form>
  )
}
