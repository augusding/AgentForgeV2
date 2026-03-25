import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

export default function WeChatLogin() {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      {/* Divider */}
      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-white/[0.06]" />
        <span className="text-[#4A5568] text-xs">或</span>
        <div className="flex-1 h-px bg-white/[0.06]" />
      </div>

      {/* WeChat button */}
      <button
        onClick={() => setShowModal(true)}
        className="w-full py-2.5 rounded-xl border border-white/[0.08] text-[#A0AEC0] text-sm hover:border-white/[0.15] hover:text-white transition-colors flex items-center justify-center gap-2"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#07C160]">
          <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.986c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.166c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm3.68 4.025c-2.203 0-4.446.818-5.891 2.63-1.51 1.891-1.862 4.545-.35 6.597 1.445 1.962 4.07 2.86 6.553 2.86.596 0 1.178-.075 1.75-.229a.654.654 0 0 1 .54.072l1.43.839a.25.25 0 0 0 .126.041c.122 0 .218-.099.218-.222 0-.054-.022-.107-.036-.16l-.293-1.112a.443.443 0 0 1 .161-.5C23.123 19.77 24 18.076 24 16.233c0-3.154-3.309-6.222-8.722-6.222zm-2.348 3.104c.484 0 .877.399.877.89a.884.884 0 0 1-.877.89.884.884 0 0 1-.877-.89c0-.491.393-.89.877-.89zm4.697 0c.484 0 .877.399.877.89a.884.884 0 0 1-.877.89.884.884 0 0 1-.877-.89c0-.491.393-.89.877-.89z" />
        </svg>
        微信扫码登录
      </button>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50"
              onClick={() => setShowModal(false)}
            />
            {/* Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-80 p-6 rounded-2xl bg-[#1A2332] border border-white/[0.08] text-center"
            >
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-3 right-3 text-[#4A5568] hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
              <div className="w-16 h-16 rounded-2xl bg-[#07C160]/10 flex items-center justify-center mx-auto mb-4">
                <svg viewBox="0 0 24 24" className="w-8 h-8 fill-[#07C160]">
                  <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.986c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.166c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm3.68 4.025c-2.203 0-4.446.818-5.891 2.63-1.51 1.891-1.862 4.545-.35 6.597 1.445 1.962 4.07 2.86 6.553 2.86.596 0 1.178-.075 1.75-.229a.654.654 0 0 1 .54.072l1.43.839a.25.25 0 0 0 .126.041c.122 0 .218-.099.218-.222 0-.054-.022-.107-.036-.16l-.293-1.112a.443.443 0 0 1 .161-.5C23.123 19.77 24 18.076 24 16.233c0-3.154-3.309-6.222-8.722-6.222zm-2.348 3.104c.484 0 .877.399.877.89a.884.884 0 0 1-.877.89.884.884 0 0 1-.877-.89c0-.491.393-.89.877-.89zm4.697 0c.484 0 .877.399.877.89a.884.884 0 0 1-.877.89.884.884 0 0 1-.877-.89c0-.491.393-.89.877-.89z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">微信登录即将开放</h3>
              <p className="text-[#718096] text-sm">
                微信扫码登录功能正在开发中，敬请期待！
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
