import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AlertsPage } from './pages/AlertsPage'
import { DashboardPage } from './pages/DashboardPage'
import { DocsPage } from './pages/DocsPage'
import { DocsSearchPage } from './pages/DocsSearchPage'
import { EventsPage } from './pages/EventsPage'
import { HomePage } from './pages/HomePage'
import { ProjectPage } from './pages/ProjectPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ProjectSectionPage } from './pages/ProjectSectionPage'
import { ReportDetailPage } from './pages/ReportDetailPage'
import { ReportsPage } from './pages/ReportsPage'
import { SettingsPage } from './pages/SettingsPage'
import { StaticPage } from './pages/StaticPage'
import { staticPages } from './data/content'

function ScrollManager() {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollManager />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/pricing" element={<StaticPage content={staticPages.pricing} />} />
          <Route path="/security" element={<StaticPage content={staticPages.security} />} />
          <Route path="/status" element={<StaticPage content={staticPages.status} />} />
          <Route path="/support" element={<StaticPage content={staticPages.support} />} />
          <Route path="/legal/privacy" element={<StaticPage content={staticPages.privacy} />} />
          <Route path="/legal/imprint" element={<StaticPage content={staticPages.imprint} />} />
          <Route path="/legal/terms" element={<StaticPage content={staticPages.terms} />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects"
            element={
              <ProtectedRoute>
                <ProjectsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:projectSlug"
            element={
              <ProtectedRoute>
                <ProjectPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:projectSlug/pages"
            element={
              <ProtectedRoute>
                <ProjectSectionPage sectionKey="pages" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:projectSlug/events"
            element={
              <ProtectedRoute>
                <ProjectSectionPage sectionKey="events" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:projectSlug/conversions"
            element={
              <ProtectedRoute>
                <ProjectSectionPage sectionKey="conversions" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:projectSlug/settings"
            element={
              <ProtectedRoute>
                <ProjectSectionPage sectionKey="settings" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/events"
            element={
              <ProtectedRoute>
                <EventsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/pages"
            element={
              <ProtectedRoute>
                <ReportDetailPage reportKey="pages" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/referrers"
            element={
              <ProtectedRoute>
                <ReportDetailPage reportKey="referrers" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/alerts"
            element={
              <ProtectedRoute>
                <AlertsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/docs/search" element={<DocsSearchPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
