import { Link } from 'react-router-dom'
import { AppIcon } from '../components/Icon'
import { ProductShell } from '../components/ProductShell'
import { projectDirectory } from '../data/content'

export function ProjectsPage() {
  return (
    <ProductShell activeItem="projects" pageTitle={<h1>Projects</h1>}>
      <section className="data-panel page-intro-panel">
        <div>
          <h2>Workspace portfolio</h2>
          <p>Open an individual project to review traffic, event coverage, and project-specific reporting and settings.</p>
        </div>
        <Link to="/docs" className="secondary-button">
          Setup Docs
        </Link>
      </section>

      <section className="project-card-grid">
        {projectDirectory.map((project) => (
          <article key={project.slug} className="data-panel project-directory-card">
            <div className="project-directory-head">
              <div className="project-avatar">
                <AppIcon name={project.icon} />
              </div>
              <div>
                <h2>{project.name}</h2>
                <p>{project.domain}</p>
              </div>
              <span className="project-status">{project.status}</span>
            </div>

            <div className="project-directory-meta">
              <div>
                <span>Team</span>
                <strong>{project.team}</strong>
              </div>
              <div>
                <span>Region</span>
                <strong>{project.region}</strong>
              </div>
              <div>
                <span>Page views</span>
                <strong>{project.pageViews}</strong>
              </div>
              <div>
                <span>Visitors</span>
                <strong>{project.uniqueVisitors}</strong>
              </div>
              <div>
                <span>Events</span>
                <strong>{project.eventVolume}</strong>
              </div>
            </div>

            <p>{project.note}</p>

            <div className="project-directory-actions">
              <Link to={`/projects/${project.slug}`} className="primary-button gold">
                Open Project
              </Link>
              <Link to={`/projects/${project.slug}/settings`} className="secondary-button">
                Project Settings
              </Link>
            </div>
          </article>
        ))}
      </section>
    </ProductShell>
  )
}
