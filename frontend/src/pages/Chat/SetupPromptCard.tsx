import { motion } from 'framer-motion'
import { Users, ArrowRight, Settings, PlayCircle, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/useAuthStore'

interface Props {
  onOpenDemo: () => void
}

export default function SetupPromptCard({ onOpenDemo }: Props) {
  const nav = useNavigate()
  const user = useAuthStore(s => s.user)
  const orgRole = user?.org_role
  const canConfigure = orgRole === 'owner' || orgRole === 'admin' || user?.role === 'superadmin' || user?.role === 'admin'

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center mb-8"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, type: 'spring' }}
          className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center shadow-lg"
        >
          <Users size={36} className="text-primary" />
        </motion.div>
        <h2 className="text-xl font-bold text-text mb-2">
          还没有配置你的 AI 团队
        </h2>
        <p className="text-sm text-text-muted max-w-md leading-relaxed">
          {canConfigure ? (
            <>
              描述您的业务场景，AgentForge 将为您量身打造专属 AI 团队，<br />
              每位 Agent 各司其职，协同完成复杂任务
            </>
          ) : (
            <>
              你的团队尚未配置 AI 团队，<br />
              请联系管理员在 Profile Builder 中完成配置
            </>
          )}
        </p>
      </motion.div>

      {/* Feature highlights */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="grid grid-cols-3 gap-4 max-w-lg mb-8"
      >
        {[
          { icon: '🎯', title: '行业定制', desc: '匹配你的业务场景' },
          { icon: '🤖', title: '智能团队', desc: '多 Agent 协同工作' },
          { icon: '⚡', title: '即刻上手', desc: '3 分钟完成配置' },
        ].map((item, i) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            className="text-center p-3 rounded-xl bg-surface-hover/50"
          >
            <span className="text-2xl block mb-1.5">{item.icon}</span>
            <p className="text-xs font-semibold text-text mb-0.5">{item.title}</p>
            <p className="text-[11px] text-text-muted">{item.desc}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        {canConfigure ? (
          <button
            onClick={() => nav('/builder')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white
                       font-medium rounded-xl hover:bg-accent/90 transition-all shadow-glow
                       hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
          >
            <Settings size={18} />
            配置我的 AI 团队
            <ArrowRight size={16} />
          </button>
        ) : (
          <button
            disabled
            className="inline-flex items-center gap-2 px-6 py-3 bg-surface-hover text-text-muted
                       font-medium rounded-xl cursor-not-allowed opacity-60"
          >
            <Lock size={18} />
            请联系管理员配置
          </button>
        )}

        <button
          onClick={onOpenDemo}
          className="inline-flex items-center gap-2 px-6 py-3 border border-border text-text
                     font-medium rounded-xl hover:bg-surface-hover transition-all
                     hover:border-primary/30"
        >
          <PlayCircle size={18} className="text-accent" />
          观看演示
        </button>
      </motion.div>
    </div>
  )
}
