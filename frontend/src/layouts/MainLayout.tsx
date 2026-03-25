import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import TopBar from './TopBar'
import Sidebar from './Sidebar'
import StatusBar from './StatusBar'
import ChangePasswordDialog from '../components/ChangePasswordDialog'
import { useWebSocket } from '../hooks/useWebSocket'
import { useApprovalNotify } from '../hooks/useApprovalNotify'
import { useAgentStore } from '../stores/useAgentStore'
import { useConfigStore } from '../stores/useConfigStore'
import { useStatsStore } from '../stores/useStatsStore'
import { useApprovalStore } from '../stores/useApprovalStore'
import { useNotificationStore } from '../stores/useNotificationStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useThemeStore } from '../stores/useThemeStore'
import TrialBanner from '../components/TrialBanner'

export default function MainLayout() {
  const { connected } = useWebSocket()
  const { pendingCount } = useApprovalNotify()
  const loadAgents = useAgentStore(s => s.load)
  const loadConfig = useConfigStore(s => s.load)
  const loadStats = useStatsStore(s => s.load)
  const loadApprovals = useApprovalStore(s => s.load)
  const loadNotifications = useNotificationStore(s => s.load)
  const user = useAuthStore(s => s.user)

  const initTheme = useThemeStore(s => s.init)

  // Load initial data
  useEffect(() => {
    initTheme()
    loadAgents()
    loadConfig()
    loadStats()
    loadApprovals()
    loadNotifications()
  }, [])

  const location = useLocation()
  // Use first path segment as transition key so sub-routes don't re-animate
  const pageKey = '/' + (location.pathname.split('/')[1] || '')

  return (
    <div className="h-screen flex flex-col bg-bg overflow-hidden">
      <TrialBanner />
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar approvalCount={pendingCount} />
        <main className="flex-1 overflow-y-auto p-3 md:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={pageKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <StatusBar
        engineRunning={true}
        wsConnected={connected}
      />

      {/* V8: 强制修改默认密码 */}
      {user?.must_change_password && (
        <ChangePasswordDialog forced />
      )}
    </div>
  )
}
