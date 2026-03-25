import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import BrandingSide from './BrandingSide'
import LoginForm from './LoginForm'

export default function Login() {
  return (
    <div className="min-h-screen flex bg-[#0F1419]">
      {/* Left: Branding (hidden on mobile) */}
      <BrandingSide />

      {/* Right: Auth Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo (shown only on mobile) */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-lg bg-[#4ECDC4] flex items-center justify-center">
              <span className="text-[#0A0F14] font-bold text-base">AF</span>
            </div>
            <span className="text-white font-bold text-lg">AgentForge</span>
          </div>

          {/* Glass card */}
          <div className="p-8 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
            {/* Title */}
            <h2 className="text-xl font-bold text-white mb-6 text-center">
              登录
            </h2>

            {/* Login form */}
            <LoginForm />

            {/* Register link */}
            <p className="text-center text-sm text-[#718096] mt-6">
              还没有账号？
              <Link
                to="/register"
                className="text-[#4ECDC4] hover:underline ml-1"
              >
                免费试用
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
