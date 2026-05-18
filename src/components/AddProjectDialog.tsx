import { useEffect, useId, useState } from 'react'
import { createProject } from '../lib/productApi'

type IntegrationPreset = 'website' | 'spa'

interface AddProjectDialogProps {
  isOpen: boolean
  onClose: () => void
  onProjectCreated: () => void
}

interface ProjectSetupForm {
  name: string
  domain: string
  projectId: string
  integrationPreset: IntegrationPreset
}

interface SnippetCardProps {
  title: string
  description: string
  code: string
  copied: boolean
  onCopy: () => void
}

const integrationOptions = [
  {
    value: 'website' as const,
    label: 'Regular website',
    description: 'For standard page loads where each page reloads normally.',
  },
  {
    value: 'spa' as const,
    label: 'SPA / app shell',
    description: 'For React, Vue, or other apps that change routes without a full page reload.',
  },
]

const initialForm: ProjectSetupForm = {
  name: '',
  domain: '',
  projectId: '',
  integrationPreset: 'website',
}

const slugifyProjectId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 48)

const parseDomain = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  try {
    return new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
}

const resolveSiteHost = (value: string, fallbackProjectId: string) => {
  const parsed = parseDomain(value)
  if (parsed) {
    return parsed.host
  }

  const trimmed = value.trim().replace(/^\/+|\/+$/g, '')
  return trimmed || fallbackProjectId
}

const toJsStringLiteral = (value: string) => JSON.stringify(value)

const toHtmlAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const buildInstallSnippet = (projectId: string, siteHost: string, integrationPreset: IntegrationPreset) => {
  const routeTrackingSnippet =
    integrationPreset === 'spa'
      ? `

  const sendPulsePageView = () => {
    pulse.page({
      path: window.location.pathname + window.location.search,
      title: document.title,
      referrer: document.referrer || undefined,
    });
  };

  const wrapHistoryMethod = (type) => {
    const original = history[type];

    return function wrappedHistoryState(...args) {
      const result = original.apply(this, args);
      queueMicrotask(sendPulsePageView);
      return result;
    };
  };

  history.pushState = wrapHistoryMethod('pushState');
  history.replaceState = wrapHistoryMethod('replaceState');
  window.addEventListener('popstate', sendPulsePageView);`
      : ''

  return `<script
  defer
  src="https://cdn.pulse.continental.com/pulse.js"
  data-site="${toHtmlAttribute(siteHost)}"
  data-collect="https://api.pulse.continental.com"
></script>
<script>
  window.pulse = window.pulse || [];

  pulse.init({
    projectId: ${toJsStringLiteral(projectId)},
    debug: false,
    consentDefault: 'strict',
  });

  pulse.page({
    path: window.location.pathname + window.location.search,
    title: document.title,
    referrer: document.referrer || undefined,
  });${routeTrackingSnippet}
</script>`
}

async function copyToClipboard(value: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textArea = document.createElement('textarea')
  textArea.value = value
  textArea.setAttribute('readonly', 'true')
  textArea.style.position = 'absolute'
  textArea.style.left = '-9999px'
  document.body.append(textArea)
  textArea.select()
  document.execCommand('copy')
  textArea.remove()
}

function SnippetCard({ title, description, code, copied, onCopy }: SnippetCardProps) {
  return (
    <section className="data-panel setup-snippet-card">
      <div className="setup-snippet-card-head">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <button type="button" className="secondary-button setup-copy-button" onClick={onCopy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <pre className="setup-snippet-code">
        <code>{code}</code>
      </pre>
    </section>
  )
}

export function AddProjectDialog({ isOpen, onClose, onProjectCreated }: AddProjectDialogProps) {
  const [form, setForm] = useState<ProjectSetupForm>(initialForm)
  const [copiedKey, setCopiedKey] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [createdProjectId, setCreatedProjectId] = useState('')
  const titleId = useId()

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  const projectName = form.name.trim() || 'Your Website'
  const autoProjectId = slugifyProjectId(projectName)
  const projectId = form.projectId || autoProjectId || 'your-website'
  const siteHost = resolveSiteHost(form.domain, projectId)
  const installSnippet = buildInstallSnippet(projectId, siteHost, form.integrationPreset)
  const isCreated = createdProjectId === projectId

  const setField = <K extends keyof ProjectSetupForm>(key: K, value: ProjectSetupForm[K]) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const handleCopy = async (key: string, value: string) => {
    try {
      await copyToClipboard(value)
      setCopiedKey(key)
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? '' : current))
      }, 1800)
    } catch {
      setCopiedKey('')
    }
  }

  const handleCreateProject = async () => {
    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const project = await createProject({
        name: projectName,
        domain: form.domain,
        projectId,
        integrationPreset: form.integrationPreset,
      })

      setCreatedProjectId(project.projectId)
      onProjectCreated()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not create the project.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="setup-dialog-backdrop" onClick={onClose}>
      <div
        className="setup-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="setup-dialog-header">
          <div className="setup-dialog-header-copy">
            <span className="status-chip">Quick install</span>
            <h2 id={titleId}>Generate one script and drop it into the site.</h2>
            <p>
              Your users should not need any backend setup. They only enter the site details here, then paste the
              generated script into `index.html` or their main layout.
            </p>
          </div>

          <button type="button" className="secondary-button setup-close-button" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="setup-dialog-grid">
          <section className="setup-dialog-panel setup-dialog-form-panel">
            <article className="data-panel setup-section-card">
              <div className="setup-section-head">
                <div>
                  <span className="country-pill">1</span>
                  <h3>Site details</h3>
                </div>
                <p>Just the basics. The script updates instantly.</p>
              </div>

              <div className="setup-form-stack">
                <label className="setup-field">
                  <span>Website name</span>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) => setField('name', event.target.value)}
                  />
                </label>

                <label className="setup-field">
                  <span>Website URL</span>
                  <input
                    type="text"
                    value={form.domain}
                    onChange={(event) => setField('domain', event.target.value)}
                  />
                </label>

                <div className="setup-field">
                  <span>Website type</span>
                  <div className="setup-option-group" role="group" aria-label="Website type">
                    {integrationOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`setup-option-card${form.integrationPreset === option.value ? ' active' : ''}`}
                        onClick={() => setField('integrationPreset', option.value)}
                      >
                        <div className="setup-option-card-head">
                          <strong>{option.label}</strong>
                        </div>
                        <span>{option.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </article>

            <article className="data-panel setup-preview-card">
              <div className="setup-section-head">
                <div>
                  <span className="country-pill">2</span>
                  <h3>Create the project</h3>
                </div>
                <p>Projects now belong to the signed-in account before the script can send analytics.</p>
              </div>

              <ol className="setup-checklist">
                <li>Save the project to this account.</li>
                <li>Copy the generated script.</li>
                <li>Paste it into `index.html`, the site shell, or the main app layout.</li>
                <li>Publish the site and open it once so Pulse can start receiving page views through your backend.</li>
              </ol>

              <div className="setup-preview-meta">
                <div>
                  <span>Project ID</span>
                  <strong>{projectId}</strong>
                </div>
                <div>
                  <span>Install mode</span>
                  <strong>{form.integrationPreset === 'spa' ? 'SPA route tracking included' : 'Regular page tracking'}</strong>
                </div>
              </div>

              {errorMessage ? <p className="empty-list-copy">{errorMessage}</p> : null}
              {isCreated ? <p className="empty-list-copy">Project saved to your account. This script will now be accepted.</p> : null}

              <button
                type="button"
                className="primary-button gold"
                disabled={isSubmitting || isCreated}
                onClick={() => void handleCreateProject()}
              >
                {isSubmitting ? 'Creating project…' : isCreated ? 'Project created' : 'Create project'}
              </button>
            </article>
          </section>

          <section className="setup-dialog-panel setup-dialog-output-panel">
            <article className="data-panel setup-output-hero">
              <div>
                <span className="status-chip">{isCreated ? 'Ready to paste' : 'Save first'}</span>
                <h3>One script tied to this account-owned project.</h3>
                <p>
                  Pulse only accepts analytics for projects saved in your account. Create the project first, then
                  install this snippet on the site.
                </p>
              </div>

              <button type="button" className="primary-button gold" onClick={() => void handleCopy('install', installSnippet)}>
                {copiedKey === 'install' ? 'Copied script' : 'Copy script'}
              </button>
            </article>

            <div className="setup-chip-row">
              <span className="status-chip">{projectId}</span>
              <span className="status-chip">{form.integrationPreset === 'spa' ? 'SPA ready' : 'Website ready'}</span>
            </div>

            <SnippetCard
              title="Paste into index.html"
              description="Add this before `</head>` or inside the main website layout where the script loads on every page."
              code={installSnippet}
              copied={copiedKey === 'install-card'}
              onCopy={() => void handleCopy('install-card', installSnippet)}
            />

            <article className="data-panel setup-checklist-card">
              <div className="panel-head">
                <h3>Keep it simple</h3>
              </div>

              <ul className="content-bullet-list">
                <li>The project ID is generated automatically from the website name.</li>
                <li>SPA mode includes route tracking in the same script block.</li>
                <li>No collector config, backend access, or server changes are exposed to the user here.</li>
              </ul>
            </article>
          </section>
        </div>
      </div>
    </div>
  )
}
