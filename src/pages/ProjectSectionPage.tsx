import { Link, NavLink, Navigate, useParams } from 'react-router-dom'
import { AppIcon } from '../components/Icon'
import { ProductShell } from '../components/ProductShell'
import { ProgressList } from '../components/ProgressList'
import {
  projectConversionBySlug,
  projectDirectory,
  projectOverviewBySlug,
  projectSettingsBySlug,
} from '../data/content'

interface ProjectSectionPageProps {
  sectionKey: 'pages' | 'events' | 'conversions' | 'settings'
}

const sectionLabels = {
  pages: 'Pages',
  events: 'Events',
  conversions: 'Conversions',
  settings: 'Settings',
} as const

export function ProjectSectionPage({ sectionKey }: ProjectSectionPageProps) {
  const { projectSlug = 'aegis' } = useParams()
  const project = projectDirectory.find((item) => item.slug === projectSlug)
  const projectOverview = projectOverviewBySlug[projectSlug]

  if (!project || !projectOverview) {
    return <Navigate to="/projects" replace />
  }

  return (
    <ProductShell
      activeItem="projects"
      pageTitle={<div className="page-breadcrumbs">Projects &gt; {project.name}</div>}
      toolbar={
        <div className="toolbar-cluster">
          <Link to="/docs" className="secondary-button">
            Project Docs
          </Link>
          <Link to="/support" className="secondary-button">
            Help
          </Link>
        </div>
      }
      header={
        <>
          <section className="project-hero-panel">
            <div className="project-hero-title">
              <div className="project-avatar">
                <AppIcon name={project.icon} />
              </div>
              <div>
                <h1>{project.name}</h1>
                <p>{project.domain}</p>
              </div>
              <span className="project-status">{project.status}</span>
            </div>
            <Link to={`/projects/${project.slug}/settings`} className="secondary-button">
              Project Settings
            </Link>
          </section>

          <nav className="project-tabs" aria-label="Project tabs">
            <NavLink to={`/projects/${project.slug}`} end>
              Overview
            </NavLink>
            <NavLink to={`/projects/${project.slug}/pages`}>Pages</NavLink>
            <NavLink to={`/projects/${project.slug}/events`}>Events</NavLink>
            <NavLink to={`/projects/${project.slug}/conversions`}>Conversions</NavLink>
            <NavLink to={`/projects/${project.slug}/settings`}>Settings</NavLink>
          </nav>
        </>
      }
    >
      <section className="data-panel page-intro-panel">
        <div>
          <h2>{sectionLabels[sectionKey]}</h2>
          <p>{buildSectionIntro(sectionKey, project.name)}</p>
        </div>
        <Link to="/reports" className="secondary-button">
          Workspace Reports
        </Link>
      </section>

      {sectionKey === 'pages' ? (
        <section className="data-panel">
          <div className="panel-head">
            <h2>Top pages</h2>
            <Link to="/reports/pages" className="panel-link">
              Content report
            </Link>
          </div>
          <div className="mini-table-list">
            {projectOverview.topPages.map((row) => (
              <div key={row.label} className="mini-table-row">
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {sectionKey === 'events' ? (
        <section className="data-panel">
          <div className="panel-head">
            <h2>Tracked events</h2>
            <Link to="/events" className="panel-link">
              Event catalog
            </Link>
          </div>
          <div className="mini-table-list">
            {projectOverview.eventTable.map((row) => (
              <div key={row.event} className="mini-table-row">
                <span>{row.event}</span>
                <strong>{row.count}</strong>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {sectionKey === 'conversions' ? (
        <section className="data-panel">
          <div className="panel-head">
            <h2>Primary conversion paths</h2>
            <Link to="/support" className="panel-link">
              Review guidance
            </Link>
          </div>
          <ProgressList items={projectConversionBySlug[project.slug]} />
        </section>
      ) : null}

      {sectionKey === 'settings' ? (
        <section className="content-section-grid">
          {projectSettingsBySlug[project.slug].map((section) => (
            <article key={section.title} className="data-panel content-section-card">
              <h2>{section.title}</h2>
              <p>{section.body}</p>
              <ul className="content-bullet-list">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      ) : null}
    </ProductShell>
  )
}

function buildSectionIntro(sectionKey: ProjectSectionPageProps['sectionKey'], projectName: string) {
  if (sectionKey === 'pages') {
    return `Review the strongest landing and help content for ${projectName}, then compare the results with the workspace-level content report.`
  }

  if (sectionKey === 'events') {
    return `See the current event mix for ${projectName}, including the interactions most useful for setup validation and conversion review.`
  }

  if (sectionKey === 'conversions') {
    return `Track the primary conversion moments defined for ${projectName} and compare which journeys are producing the strongest follow-through.`
  }

  return `Check the configuration and reporting defaults that control how ${projectName} is measured and reviewed.`
}
