import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import LoadingSpinner from './components/LoadingSpinner'
import ErrorBoundary from './components/ErrorBoundary'
import { useAuthStore } from './stores/useAuthStore'

// Lazy-loaded pages for code splitting
const Landing = lazy(() => import('./pages/Landing'))
const Login = lazy(() => import('./pages/Login'))
// Onboarding removed — new users go directly to /builder
const Chat = lazy(() => import('./pages/Chat'))
// Team pages removed in V7 — routes redirect to /workstation
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Knowledge = lazy(() => import('./pages/Knowledge'))
const Workflows = lazy(() => import('./pages/Workflows'))
const WorkflowEditor = lazy(() => import('./pages/Workflows/WorkflowEditor'))
const WorkflowRun = lazy(() => import('./pages/Workflows/WorkflowRun'))
const VisualEditor = lazy(() => import('./pages/Workflows/VisualEditor'))
// Heartbeats merged into Workflows page as sub-tab
const Approvals = lazy(() => import('./pages/Approvals'))
const SettingsPage = lazy(() => import('./pages/Settings'))
const Builder = lazy(() => import('./pages/Builder'))
const Marketplace = lazy(() => import('./pages/Marketplace'))
const Workstation = lazy(() => import('./pages/Workstation'))

const Register = lazy(() => import('./pages/Register'))

const AdminLayout = lazy(() => import('./layouts/AdminLayout'))
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard'))
const AdminLeads = lazy(() => import('./pages/Admin/AdminLeads'))
const AdminOrgs = lazy(() => import('./pages/Admin/AdminOrgs'))
const AdminUsers = lazy(() => import('./pages/Admin/AdminUsers'))
const AdminIndustries = lazy(() => import('./pages/Admin/AdminIndustries'))
const AdminSkills = lazy(() => import('./pages/Admin/AdminSkills'))

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, user } = useAuthStore()

  if (loading) {
    return <LoadingSpinner fullPage label="验证登录状态..." />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function RequireAuthOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuthStore()

  if (loading) {
    return <LoadingSpinner fullPage label="验证登录状态..." />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, loading } = useAuthStore()
  if (loading) return <LoadingSpinner fullPage label="验证权限..." />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'admin' && user?.role !== 'superadmin') return <Navigate to="/workstation" replace />
  return <>{children}</>
}

/** 根路由智能分流：未登录展示 Landing，已登录跳转 /workstation */
function PublicOrApp() {
  const { isAuthenticated, loading, user } = useAuthStore()

  if (loading) {
    return <LoadingSpinner fullPage />
  }

  if (isAuthenticated) {
    return <Navigate to="/workstation" replace />
  }

  return <Landing />
}

function AppInit({ children }: { children: React.ReactNode }) {
  const checkAuth = useAuthStore((s) => s.checkAuth)

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <AppInit>
      <Suspense fallback={<LoadingSpinner fullPage />}>
        <ErrorBoundary>
        <Routes>
          {/* Landing — public marketing page */}
          <Route path="/" element={<PublicOrApp />} />

          {/* Login — full-screen, no layout */}
          <Route path="/login" element={<Login />} />

          {/* Register — enterprise registration, full-screen */}
          <Route path="/register" element={<Register />} />

          {/* Onboarding — full-screen, requires auth but not onboarding */}
          <Route path="/onboarding" element={<RequireAuthOnly><Navigate to="/builder" replace /></RequireAuthOnly>} />

          {/* Admin panel — requires admin role */}
          <Route element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/leads" element={<AdminLeads />} />
            <Route path="/admin/orgs" element={<AdminOrgs />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/industries" element={<AdminIndustries />} />
            <Route path="/admin/skills" element={<AdminSkills />} />
          </Route>

          {/* Main app with layout — requires auth + onboarding */}
          <Route element={<RequireAuth><MainLayout /></RequireAuth>}>
            {/* Workstation — 智能工位首页 */}
            <Route path="/workstation" element={<Workstation />} />

            {/* Chat */}
            <Route path="/chat" element={<Chat />} />
            <Route path="/chat/:mission_id" element={<Chat />} />

            {/* Team — V7: redirect to workstation (agent team concept removed) */}
            <Route path="/team" element={<Navigate to="/workstation" replace />} />
            <Route path="/team/:agent_id" element={<Navigate to="/workstation" replace />} />

            {/* Missions — redirect to chat */}
            <Route path="/missions" element={<Navigate to="/chat" replace />} />
            <Route path="/missions/:mission_id" element={<Navigate to="/chat" replace />} />

            {/* Dashboard */}
            <Route path="/dashboard" element={<Dashboard />} />

            {/* Knowledge */}
            <Route path="/knowledge" element={<Knowledge />} />

            {/* Workflows */}
            <Route path="/workflows" element={<Workflows />} />
            <Route path="/workflows/new" element={<WorkflowEditor />} />
            <Route path="/workflows/edit/:workflowId" element={<WorkflowEditor />} />
            <Route path="/workflows/visual/new" element={<VisualEditor />} />
            <Route path="/workflows/visual/:id" element={<VisualEditor />} />
            <Route path="/workflows/run/:missionId" element={<WorkflowRun />} />

            {/* Heartbeats — merged into Workflows as sub-tab, redirect old URL */}
            <Route path="/heartbeats" element={<Navigate to="/workflows" replace />} />

            {/* Approvals — accessible from workstation activity hub */}
            <Route path="/approvals" element={<Approvals />} />
            <Route path="/workstation/approvals" element={<Approvals />} />

            {/* Builder */}
            <Route path="/builder" element={<Builder />} />

            {/* Skills — V7: merged into settings */}
            <Route path="/skills" element={<Navigate to="/settings" replace />} />

            {/* Learning — V7: removed (soul evolution removed) */}
            <Route path="/learning" element={<Navigate to="/workstation" replace />} />

            {/* Marketplace — V7: merged into settings */}
            <Route path="/marketplace" element={<Navigate to="/settings" replace />} />

            {/* Settings */}
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/:tab" element={<SettingsPage />} />
          </Route>

          {/* Catch-all: send to landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ErrorBoundary>
      </Suspense>
      </AppInit>
    </BrowserRouter>
  )
}

export default App
