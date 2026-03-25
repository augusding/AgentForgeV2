import { useState, useEffect, type FormEvent } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/useAuthStore'
import toast from 'react-hot-toast'

export default function RegisterForm() {
  const navigate = useNavigate()
  const register = useAuthStore((s) => s.register)
  const sendCode = useAuthStore((s) => s.sendCode)

  const [form, setForm] = useState({
    username: '',
    phone: '',
    code: '',
    password: '',
    confirmPassword: '',
  })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const handleSendCode = async () => {
    if (!form.phone.trim() || countdown > 0) return
    if (!/^\d{11}$/.test(form.phone.trim())) {
      toast.error('请输入有效的 11 位手机号')
      return
    }
    setSendingCode(true)
    try {
      await sendCode(form.phone.trim(), 'register')
      setCountdown(60)
      toast.success('验证码已发送')
    } catch (err: any) {
      toast.error(err?.message || '发送失败')
    } finally {
      setSendingCode(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (form.password !== form.confirmPassword) {
      toast.error('两次输入的密码不一致')
      return
    }

    setLoading(true)
    try {
      await register({
        username: form.username.trim(),
        phone: form.phone.trim(),
        code: form.code.trim(),
        password: form.password,
      })
      toast.success('注册成功！')
      navigate('/', { replace: true })
    } catch (err: any) {
      toast.error(err?.message || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const canSubmit =
    form.username.trim().length >= 3 &&
    /^\d{11}$/.test(form.phone.trim()) &&
    form.code.trim().length === 6 &&
    form.password.length >= 8 &&
    form.password === form.confirmPassword

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Username */}
      <div>
        <label className="block text-sm text-[#A0AEC0] mb-1.5">
          用户名 <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={form.username}
          onChange={(e) => updateField('username', e.target.value)}
          placeholder="3-32 位字母、数字或下划线"
          autoComplete="username"
          className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm placeholder:text-[#4A5568] focus:outline-none focus:border-[#4ECDC4]/40 transition-colors"
        />
      </div>

      {/* Phone + Code */}
      <div>
        <label className="block text-sm text-[#A0AEC0] mb-1.5">
          手机号 <span className="text-red-400">*</span>
        </label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => updateField('phone', e.target.value)}
          placeholder="请输入 11 位手机号"
          className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm placeholder:text-[#4A5568] focus:outline-none focus:border-[#4ECDC4]/40 transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm text-[#A0AEC0] mb-1.5">
          验证码 <span className="text-red-400">*</span>
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={form.code}
            onChange={(e) => updateField('code', e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6 位验证码"
            maxLength={6}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm placeholder:text-[#4A5568] focus:outline-none focus:border-[#4ECDC4]/40 transition-colors"
          />
          <button
            type="button"
            onClick={handleSendCode}
            disabled={sendingCode || countdown > 0 || !/^\d{11}$/.test(form.phone.trim())}
            className="px-4 py-2.5 rounded-xl border border-[#4ECDC4]/30 text-[#4ECDC4] text-sm font-medium hover:bg-[#4ECDC4]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {sendingCode ? (
              <Loader2 size={14} className="animate-spin" />
            ) : countdown > 0 ? (
              `${countdown}s`
            ) : (
              '获取验证码'
            )}
          </button>
        </div>
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm text-[#A0AEC0] mb-1.5">
          密码 <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            value={form.password}
            onChange={(e) => updateField('password', e.target.value)}
            placeholder="至少 8 位，含字母和数字"
            autoComplete="new-password"
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

      {/* Confirm Password */}
      <div>
        <label className="block text-sm text-[#A0AEC0] mb-1.5">
          确认密码 <span className="text-red-400">*</span>
        </label>
        <input
          type="password"
          value={form.confirmPassword}
          onChange={(e) => updateField('confirmPassword', e.target.value)}
          placeholder="再次输入密码"
          autoComplete="new-password"
          className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm placeholder:text-[#4A5568] focus:outline-none focus:border-[#4ECDC4]/40 transition-colors"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !canSubmit}
        className="w-full py-3 rounded-xl bg-[#4ECDC4] text-[#0A0F14] font-bold text-sm hover:bg-[#45b8b0] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            注册中...
          </>
        ) : (
          '注册'
        )}
      </button>

      {/* Terms */}
      <p className="text-[#4A5568] text-xs text-center">
        注册即表示同意《服务协议》和《隐私政策》
      </p>
    </form>
  )
}
