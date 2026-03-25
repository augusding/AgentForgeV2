import { useState, useMemo, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2, ChevronDown } from 'lucide-react'
import BrandingSide from '../Login/BrandingSide'
import { useAuthStore } from '../../stores/useAuthStore'
import { INDUSTRY_TREE } from '../../data/industries'
import toast from 'react-hot-toast'

export default function Register() {
  const navigate = useNavigate()
  const registerOrg = useAuthStore((s) => s.registerOrg)

  const [form, setForm] = useState({
    org_name: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    industry: '',
    sub_industry: '',
    username: '',
    password: '',
    confirmPassword: '',
  })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const subIndustries = useMemo(
    () => INDUSTRY_TREE.find((i) => i.id === form.industry)?.children || [],
    [form.industry],
  )

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const canSubmit =
    form.org_name.trim().length > 0 &&
    form.contact_name.trim().length > 0 &&
    /^\d{11}$/.test(form.contact_phone.trim()) &&
    form.username.trim().length >= 3 &&
    form.password.length >= 8 &&
    form.password === form.confirmPassword

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (form.password !== form.confirmPassword) {
      toast.error('两次输入的密码不一致')
      return
    }

    setLoading(true)
    try {
      await registerOrg({
        org_name: form.org_name.trim(),
        contact_name: form.contact_name.trim(),
        contact_phone: form.contact_phone.trim(),
        contact_email: form.contact_email.trim() || undefined,
        industry: form.industry || undefined,
        sub_industry: form.sub_industry || undefined,
        username: form.username.trim(),
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

  const inputCls =
    'w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm placeholder:text-[#4A5568] focus:outline-none focus:border-[#4ECDC4]/40 transition-colors'

  return (
    <div className="min-h-screen flex bg-[#0F1419]">
      {/* Left: Branding (hidden on mobile) */}
      <BrandingSide />

      {/* Right: Register Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-lg bg-[#4ECDC4] flex items-center justify-center">
              <span className="text-[#0A0F14] font-bold text-base">AF</span>
            </div>
            <span className="text-white font-bold text-lg">AgentForge</span>
          </div>

          {/* Glass card */}
          <div className="p-8 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
            <h2 className="text-xl font-bold text-white mb-1 text-center">
              免费试用
            </h2>
            <p className="text-sm text-[#718096] text-center mb-6">
              填写企业信息，立即体验 AI 团队
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* === 企业信息 === */}
              <div className="space-y-1 mb-2">
                <h3 className="text-xs font-semibold text-[#4ECDC4] uppercase tracking-wider">
                  企业信息
                </h3>
                <div className="h-px bg-white/[0.06]" />
              </div>

              {/* 组织名称 */}
              <div>
                <label className="block text-sm text-[#A0AEC0] mb-1.5">
                  组织名称 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.org_name}
                  onChange={(e) => updateField('org_name', e.target.value)}
                  placeholder="请输入企业/团队名称"
                  className={inputCls}
                />
              </div>

              {/* 负责人姓名 + 手机号 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[#A0AEC0] mb-1.5">
                    负责人姓名 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.contact_name}
                    onChange={(e) => updateField('contact_name', e.target.value)}
                    placeholder="请输入姓名"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#A0AEC0] mb-1.5">
                    负责人手机号 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    value={form.contact_phone}
                    onChange={(e) => updateField('contact_phone', e.target.value)}
                    placeholder="11 位手机号"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* 邮箱 */}
              <div>
                <label className="block text-sm text-[#A0AEC0] mb-1.5">
                  负责人邮箱
                </label>
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => updateField('contact_email', e.target.value)}
                  placeholder="选填"
                  className={inputCls}
                />
              </div>

              {/* 行业 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[#A0AEC0] mb-1.5">行业</label>
                  <div className="relative">
                    <select
                      value={form.industry}
                      onChange={(e) =>
                        setForm({ ...form, industry: e.target.value, sub_industry: '' })
                      }
                      className={`${inputCls} appearance-none cursor-pointer`}
                    >
                      <option value="" className="bg-[#1A202C]">
                        选填
                      </option>
                      {INDUSTRY_TREE.map((ind) => (
                        <option key={ind.id} value={ind.id} className="bg-[#1A202C]">
                          {ind.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5568] pointer-events-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-[#A0AEC0] mb-1.5">子行业</label>
                  <div className="relative">
                    <select
                      value={form.sub_industry}
                      onChange={(e) => updateField('sub_industry', e.target.value)}
                      disabled={!form.industry}
                      className={`${inputCls} appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      <option value="" className="bg-[#1A202C]">
                        选填
                      </option>
                      {subIndustries.map((sub) => (
                        <option key={sub.id} value={sub.id} className="bg-[#1A202C]">
                          {sub.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5568] pointer-events-none"
                    />
                  </div>
                </div>
              </div>

              {/* === 账号信息 === */}
              <div className="space-y-1 mb-2 pt-2">
                <h3 className="text-xs font-semibold text-[#4ECDC4] uppercase tracking-wider">
                  账号信息
                </h3>
                <div className="h-px bg-white/[0.06]" />
              </div>

              {/* 用户名 */}
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
                  className={inputCls}
                />
              </div>

              {/* 密码 */}
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
                    className={`${inputCls} pr-10`}
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

              {/* 确认密码 */}
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
                  className={inputCls}
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
                  '立即注册'
                )}
              </button>

              {/* Terms */}
              <p className="text-[#4A5568] text-xs text-center">
                注册即表示同意《服务协议》和《隐私政策》
              </p>
            </form>

            {/* Login link */}
            <p className="text-center text-sm text-[#718096] mt-4">
              已有账号？
              <Link to="/login" className="text-[#4ECDC4] hover:underline ml-1">
                登录
              </Link>
            </p>
          </div>

          {/* Back to home */}
          <div className="mt-6 text-center">
            <Link
              to="/"
              className="text-[#4A5568] text-xs hover:text-[#A0AEC0] transition-colors"
            >
              &larr; 返回首页
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
