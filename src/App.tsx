import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
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
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectSlug" element={<ProjectPage />} />
        <Route path="/projects/:projectSlug/pages" element={<ProjectSectionPage sectionKey="pages" />} />
        <Route path="/projects/:projectSlug/events" element={<ProjectSectionPage sectionKey="events" />} />
        <Route path="/projects/:projectSlug/conversions" element={<ProjectSectionPage sectionKey="conversions" />} />
        <Route path="/projects/:projectSlug/settings" element={<ProjectSectionPage sectionKey="settings" />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/reports/pages" element={<ReportDetailPage reportKey="pages" />} />
        <Route path="/reports/referrers" element={<ReportDetailPage reportKey="referrers" />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/docs/search" element={<DocsSearchPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
