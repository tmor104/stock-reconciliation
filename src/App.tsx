import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'

// Pages (will be created)
import LoginPage from '@/features/auth/components/LoginPage'
import DashboardPage from '@/features/dashboard/components/DashboardPage'
import CountingPage from '@/features/counting/components/CountingPage'
import VariancePage from '@/features/variance/components/VariancePage'
import TemplatesPage from '@/features/templates/components/TemplatesPage'
import BatchesPage from '@/features/batches/components/BatchesPage'
import AdminPage from '@/features/admin/components/AdminPage'
import SettingsPage from '@/features/settings/components/SettingsPage'

// Layout
import Layout from '@/components/layout/Layout'

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isLoading = useAuthStore((state) => state.isLoading)

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth)
  const darkMode = useAppStore((state) => state.darkMode)

  useEffect(() => {
    // Check authentication status on app load
    checkAuth()

    // Apply dark mode class if enabled
    if (darkMode) {
      document.documentElement.classList.add('dark')
    }
  }, [checkAuth, darkMode])

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="counting" element={<CountingPage />} />
          <Route path="variance" element={<VariancePage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="batches" element={<BatchesPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
