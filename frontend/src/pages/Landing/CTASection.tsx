import { useState, useMemo } from 'react'
import { Check, Loader2, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { submitLead } from '../../api/leads'
import { INDUSTRY_TREE } from '../../data/industries'
import ScrollReveal from './ScrollReveal'

export default function CTASection() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', company: '', industry: '', sub_industry: '' })
  const subIndustries = useMemo(
    () => INDUSTRY_TREE.find(i => i.id === form.industry)?.children || [],
    [form.industry]
  )
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.name.trim()) { setError('请输入姓名'); return }
    if (!form.phone.trim()) { setError('请输入手机号'); return }
    if (!/^\d{11}$/.test(form.phone.trim())) { setError('请输入 11 位手机号'); return }

    setSubmitting(true)
    try {
      await submitLead({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        company: form.company.trim(),
        industry: form.industry,
        sub_industry: form.sub_industry,
      })
      setSubmitted(true)
    } catch (err: any) {
      setError(err?.response?.data?.message || '提交失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="contact" className="bg-[#0F1419] py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          <ScrollReveal>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">
                准备好让 AI 成为
                <br />
                <span className="text-[#4ECDC4]">你的工作搭档</span>了吗？
              </h2>
              <p className="text-[#A0AEC0] mt-4 text-lg">
                留下联系方式，专属顾问将在 24 小时内为您定制方案
              </p>
              <div className="mt-8 space-y-4">
                {[
                  '7 天免费试用，不满意无条件退',
                  '专属顾问一对一配置岗位和工作流',
                  '支持私有化部署，数据完全自主可控',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-[#A0AEC0]">
                    <div className="w-5 h-5 rounded-full bg-[#4ECDC4]/10 flex items-center justify-center shrink-0">
                      <Check size={12} className="text-[#4ECDC4]" />
                    </div>
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <div className="p-8 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <AnimatePresence mode="wait">
                {submitted ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-10"
                  >
                    <div className="w-16 h-16 rounded-full bg-[#4ECDC4]/20 flex items-center justify-center mx-auto mb-4">
                      <Check size={32} className="text-[#4ECDC4]" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">提交成功！</h3>
                    <p className="text-[#A0AEC0] text-sm">我们将尽快与您联系</p>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    onSubmit={handleSubmit}
                    className="space-y-5"
                    exit={{ opacity: 0 }}
                  >
                    <div>
                      <label className="block text-sm text-[#A0AEC0] mb-1.5">姓名 <span className="text-red-400">*</span></label>
                      <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="请输入您的姓名" className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm placeholder:text-[#4A5568] focus:outline-none focus:border-[#4ECDC4]/40 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm text-[#A0AEC0] mb-1.5">手机号 <span className="text-red-400">*</span></label>
                      <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="请输入 11 位手机号" className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm placeholder:text-[#4A5568] focus:outline-none focus:border-[#4ECDC4]/40 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm text-[#A0AEC0] mb-1.5">邮箱</label>
                      <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="选填" className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm placeholder:text-[#4A5568] focus:outline-none focus:border-[#4ECDC4]/40 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm text-[#A0AEC0] mb-1.5">公司名称</label>
                      <input type="text" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="选填" className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm placeholder:text-[#4A5568] focus:outline-none focus:border-[#4ECDC4]/40 transition-colors" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm text-[#A0AEC0] mb-1.5">行业</label>
                        <div className="relative">
                          <select value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value, sub_industry: '' })} className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#4ECDC4]/40 transition-colors appearance-none cursor-pointer">
                            <option value="" className="bg-[#1A202C]">选填</option>
                            {INDUSTRY_TREE.map((ind) => (
                              <option key={ind.id} value={ind.id} className="bg-[#1A202C]">{ind.label}</option>
                            ))}
                          </select>
                          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5568] pointer-events-none" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-[#A0AEC0] mb-1.5">子行业</label>
                        <div className="relative">
                          <select value={form.sub_industry} onChange={(e) => setForm({ ...form, sub_industry: e.target.value })} disabled={!form.industry} className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#4ECDC4]/40 transition-colors appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                            <option value="" className="bg-[#1A202C]">选填</option>
                            {subIndustries.map((sub) => (
                              <option key={sub.id} value={sub.id} className="bg-[#1A202C]">{sub.label}</option>
                            ))}
                          </select>
                          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5568] pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {error && <p className="text-red-400 text-xs">{error}</p>}

                    <button type="submit" disabled={submitting} className="w-full py-3 rounded-xl bg-[#4ECDC4] text-[#0A0F14] font-bold text-sm hover:bg-[#45b8b0] transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                      {submitting ? (<><Loader2 size={16} className="animate-spin" />提交中...</>) : '立即提交'}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
