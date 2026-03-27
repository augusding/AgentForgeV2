import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/useAuthStore'
import { useEffect } from 'react'
import MainLayout from './layouts/MainLayout'
import Login from './pages/Login'
import Chat from './pages/Chat'
import Workstation from './pages/Workstation'
import Knowledge from './pages/Knowledge'
import Workflows from './pages/Workflows'
import WorkflowEditor from './pages/workflows/WorkflowEditor'
import Connectors from './pages/Connectors'
import Settings from './pages/Settings'
import NotificationBanner from './components/NotificationBanner'

export default function App() {
  const { isAuthenticated, loading, checkAuth } = useAuthStore()

  useEffect(() => { checkAuth() }, [])

  if (loading) return <div className="h-screen flex items-center justify-center text-[var(--text-muted)]">加载中...</div>

  return (
    <>
      {isAuthenticated && <NotificationBanner />}
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
        <Route element={isAuthenticated ? <MainLayout /> : <Navigate to="/login" />}>
          <Route path="/" element={<Workstation />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/knowledge" element={<Knowledge />} />
          <Route path="/connectors" element={<Connectors />} />
          <Route path="/workflows" element={<Workflows />} />
          <Route path="/workflows/:workflowId" element={<WorkflowEditor />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  )
}
