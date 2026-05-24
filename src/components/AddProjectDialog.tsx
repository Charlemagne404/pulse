import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProjectInstallVerificationPanel } from './ProjectInstallVerificationPanel'
import { copyToClipboard } from '../lib/clipboard'
import { createProject } from '../lib/productApi'

type IntegrationPreset = 'website' | 'spa'
type SetupStep = 'details' | 'save' | 'install' | 'verify'

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

const setupSteps: Array<{
  key: SetupStep
  title: string
  detail: string
}> = [
  {
    key: 'details',
    title: 'Describe the site',
    detail: 'Name it, add the URL, and choose regular pages or SPA routing.',
  },
  {
    key: 'save',
    title: 'Create the project',
    detail: 'Save the project to this workspace before Pulse accepts traffic.',
  },
  {
    key: 'install',
    title: 'Copy the script',
    detail: 'Use one snippet that already matches this project and install mode.',
  },
  {
    key: 'verify',
    title: 'Publish and verify',
    detail: 'Deploy once, open the site, then confirm page views in the project.',
  },
]

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

export function AddProjectDialog({ isOpen, onClose, onProjectCreated }: AddProjectDialogProps) {
  const navigate = useNavigate()
  const [form, setForm] = useState<ProjectSetupForm>(initialForm)
  const [copiedKey, setCopiedKey] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [activeStep, setActiveStep] = useState<SetupStep>('details')
  const [createdProjectId, setCreatedProjectId] = useState('')
  const [createdFingerprint, setCreatedFingerprint] = useState('')
  const [hasCopiedInstall, setHasCopiedInstall] = useState(false)
  const titleId = useId()
  const backdropPointerDownRef = useRef(false)

  const resetDialog = () => {
    setForm(initialForm)
    setCopiedKey('')
    setIsSubmitting(false)
    setErrorMessage('')
    setActiveStep('details')
    setCreatedProjectId('')
    setCreatedFingerprint('')
    setHasCopiedInstall(false)
  }

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
  const creationFingerprint = JSON.stringify({
    projectName,
    domain: form.domain.trim(),
    projectId,
    integrationPreset: form.integrationPreset,
  })
  const isCreated = createdProjectId === projectId && createdFingerprint === creationFingerprint
  const currentStepIndex = setupSteps.findIndex((step) => step.key === activeStep)
  const canContinueFromDetails = projectName.trim().length > 0

  const setField = <K extends keyof ProjectSetupForm>(key: K, value: ProjectSetupForm[K]) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
    setErrorMessage('')

    if (createdProjectId || createdFingerprint) {
      setCreatedProjectId('')
      setCreatedFingerprint('')
      setHasCopiedInstall(false)
      setCopiedKey('')

      if (activeStep === 'install' || activeStep === 'verify') {
        setActiveStep('save')
      }
    }
  }

  const handleCopy = async (key: string, value: string) => {
    try {
      await copyToClipboard(value)
      setCopiedKey(key)
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? '' : current))
      }, 1800)
      return true
    } catch {
      setCopiedKey('')
      return false
    }
  }

  const handleCopyInstall = async () => {
    const copied = await handleCopy('install', installSnippet)
    if (!copied) {
      return
    }

    setHasCopiedInstall(true)
    setActiveStep('verify')
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
      setCreatedFingerprint(creationFingerprint)
      setHasCopiedInstall(false)
      onProjectCreated()
      setActiveStep('install')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not create the project.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBackdropPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    backdropPointerDownRef.current = event.target === event.currentTarget
  }

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (backdropPointerDownRef.current && event.target === event.currentTarget) {
      onClose()
    }
    backdropPointerDownRef.current = false
  }

  const openCreatedProject = () => {
    onClose()
    navigate(`/projects/${encodeURIComponent(projectId)}`)
  }

  return (
    <div
      className="setup-dialog-backdrop"
      onPointerDown={handleBackdropPointerDown}
      onClick={handleBackdropClick}
    >
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
            <h2 id={titleId}>Create the project, copy the script, then verify one page view.</h2>
            <p>
              This flow stays strict on purpose. Pulse saves the project first, then unlocks the exact script that
              should be pasted into the site.
            </p>
          </div>

          <button type="button" className="secondary-button setup-close-button" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="setup-dialog-grid">
          <section className="setup-dialog-panel setup-dialog-form-panel">
            <article className="data-panel setup-preview-card">
              <div className="setup-section-head">
                <div>
                  <span className="country-pill">{currentStepIndex + 1}</span>
                  <h3>Quick install checklist</h3>
                </div>
                <p>Move straight through the setup in order. Each step unlocks the next one.</p>
              </div>

              <div className="setup-step-list" role="list" aria-label="Quick install steps">
                {setupSteps.map((step, index) => {
                  const isActive = step.key === activeStep
                  const isComplete =
                    step.key === 'details'
                      ? currentStepIndex > index
                      : step.key === 'save'
                        ? isCreated
                        : step.key === 'install'
                          ? hasCopiedInstall
                          : false

                  return (
                    <div
                      key={step.key}
                      className={`setup-step-item${isActive ? ' active' : ''}${isComplete ? ' complete' : ''}`}
                      role="listitem"
                    >
                      <span className="setup-step-index">{isComplete ? 'Done' : index + 1}</span>
                      <div>
                        <strong>{step.title}</strong>
                        <p>{step.detail}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="setup-preview-meta">
                <div>
                  <span>Project ID</span>
                  <strong>{projectId}</strong>
                </div>
                <div>
                  <span>Install mode</span>
                  <strong>{form.integrationPreset === 'spa' ? 'SPA route tracking included' : 'Regular page tracking'}</strong>
                </div>
                <div>
                  <span>Site host</span>
                  <strong>{siteHost}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>{isCreated ? 'Project saved' : 'Not saved yet'}</strong>
                </div>
              </div>
            </article>
          </section>

          <section className="setup-dialog-panel setup-dialog-output-panel">
            {activeStep === 'details' ? (
              <article className="data-panel setup-section-card setup-stage-card">
                <div className="setup-section-head">
                  <div>
                    <span className="country-pill">1</span>
                    <h3>Describe the site</h3>
                  </div>
                  <p>Start with the few details needed to generate a reliable project ID and script.</p>
                </div>

                <div className="setup-form-stack">
                  <label className="setup-field">
                    <span>Website name</span>
                    <input
                      type="text"
                      value={form.name}
                      placeholder="Pulse marketing site"
                      onChange={(event) => setField('name', event.target.value)}
                    />
                    <small>This becomes the project label and default project ID.</small>
                  </label>

                  <label className="setup-field">
                    <span>Website URL</span>
                    <input
                      type="text"
                      value={form.domain}
                      placeholder="https://pulse.continental.com"
                      onChange={(event) => setField('domain', event.target.value)}
                    />
                    <small>Optional, but recommended so the generated host value already matches the site.</small>
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

                <div className="setup-footer-actions">
                  <button type="button" className="secondary-button" onClick={onClose}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="primary-button gold"
                    disabled={!canContinueFromDetails}
                    onClick={() => setActiveStep('save')}
                  >
                    Continue
                  </button>
                </div>
              </article>
            ) : null}

            {activeStep === 'save' ? (
              <article className="data-panel setup-section-card setup-stage-card">
                <div className="setup-output-hero">
                  <div>
                    <span className="status-chip">{isCreated ? 'Saved' : 'Ready to save'}</span>
                    <h3>Create this project in the workspace</h3>
                    <p>Pulse will only accept analytics after this project exists under your signed-in account.</p>
                  </div>
                </div>

                <div className="setup-preview-meta">
                  <div>
                    <span>Name</span>
                    <strong>{projectName}</strong>
                  </div>
                  <div>
                    <span>Project ID</span>
                    <strong>{projectId}</strong>
                  </div>
                  <div>
                    <span>Host</span>
                    <strong>{siteHost}</strong>
                  </div>
                  <div>
                    <span>Tracking</span>
                    <strong>{form.integrationPreset === 'spa' ? 'SPA route tracking' : 'Regular page loads'}</strong>
                  </div>
                </div>

                <ol className="setup-checklist">
                  <li>Save the project to this workspace.</li>
                  <li>Copy the generated install snippet.</li>
                  <li>Paste it into the site layout so it loads on every page.</li>
                  <li>Publish and open the site once to confirm a `page_view` reaches Pulse.</li>
                </ol>

                {errorMessage ? <p className="empty-list-copy">{errorMessage}</p> : null}
                {isCreated ? <p className="empty-list-copy">Project saved. The install step is now unlocked.</p> : null}

                <div className="setup-footer-actions">
                  <button type="button" className="secondary-button" onClick={() => setActiveStep('details')}>
                    Back
                  </button>
                  <button
                    type="button"
                    className="primary-button gold"
                    disabled={isSubmitting || isCreated}
                    onClick={() => void handleCreateProject()}
                  >
                    {isSubmitting ? 'Creating project…' : isCreated ? 'Project created' : 'Create project'}
                  </button>
                </div>
              </article>
            ) : null}

            {activeStep === 'install' ? (
              <article className="data-panel setup-stage-card">
                <div className="setup-output-hero">
                  <div>
                    <span className="status-chip">Ready to paste</span>
                    <h3>Copy the install script</h3>
                    <p>Add this before <code>&lt;/head&gt;</code> or in the main app layout where it loads on every page.</p>
                  </div>

                  <button type="button" className="primary-button gold" onClick={() => void handleCopyInstall()}>
                    {copiedKey === 'install' ? 'Copied script' : 'Copy script'}
                  </button>
                </div>

                <div className="setup-chip-row">
                  <span className="status-chip">{projectId}</span>
                  <span className="status-chip">{form.integrationPreset === 'spa' ? 'SPA ready' : 'Website ready'}</span>
                </div>

                <section className="data-panel setup-snippet-card">
                  <div className="setup-snippet-card-head">
                    <div>
                      <h3>Install snippet</h3>
                      <p>This snippet already includes the project ID and the matching route tracking mode.</p>
                    </div>
                    <button
                      type="button"
                      className="secondary-button setup-copy-button"
                      onClick={() => void handleCopy('install-card', installSnippet)}
                    >
                      {copiedKey === 'install-card' ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  <pre className="setup-snippet-code">
                    <code>{installSnippet}</code>
                  </pre>
                </section>

                <div className="setup-footer-actions">
                  <button type="button" className="secondary-button" onClick={() => setActiveStep('save')}>
                    Back
                  </button>
                </div>
              </article>
            ) : null}

            {activeStep === 'verify' ? (
              <article className="data-panel setup-stage-card">
                <div className="setup-output-hero">
                  <div>
                    <span className="status-chip">{hasCopiedInstall ? 'Copied' : 'Ready'}</span>
                    <h3>Publish and verify the first page view</h3>
                    <p>Keep this focused: install once, deploy, open the site, then confirm the project starts receiving data.</p>
                  </div>
                </div>

                <ol className="setup-checklist">
                  <li>Paste the script into `index.html` or the main app layout.</li>
                  <li>Deploy the site so the snippet is live.</li>
                  <li>Open the site in a browser and load one page.</li>
                  <li>Check the verification panel below until the first `page_view` appears.</li>
                </ol>

                {isCreated ? (
                  <ProjectInstallVerificationPanel
                    projectId={projectId}
                    title="Live verification"
                    description="Refresh this panel after deployment to confirm the first page view, consent signal, and any recent collector issues."
                    compact
                    autoRefresh
                  />
                ) : null}

                <section className="data-panel setup-checklist-card">
                  <div className="panel-head">
                    <h3>Need the snippet again?</h3>
                  </div>

                  <div className="setup-footer-actions">
                    <button type="button" className="secondary-button" onClick={() => void handleCopy('verify-install', installSnippet)}>
                      {copiedKey === 'verify-install' ? 'Copied script' : 'Copy script again'}
                    </button>
                    <button type="button" className="secondary-button" onClick={() => setActiveStep('install')}>
                      View snippet
                    </button>
                  </div>
                </section>

                <div className="setup-footer-actions">
                  <button type="button" className="secondary-button" onClick={onClose}>
                    Finish later
                  </button>
                  <button type="button" className="secondary-button" onClick={resetDialog}>
                    Start another
                  </button>
                  <button type="button" className="primary-button gold" onClick={openCreatedProject}>
                    Open project
                  </button>
                </div>
              </article>
            ) : null}
            <article className="data-panel setup-checklist-card">
              <div className="panel-head">
                <h3>Keep it simple</h3>
              </div>

              <ul className="content-bullet-list">
                <li>The project ID is generated from the website name unless you override it.</li>
                <li>The script only becomes part of the flow after the project exists in this workspace.</li>
                <li>SPA mode includes route tracking in the same snippet so there is no extra SDK setup.</li>
              </ul>
            </article>
          </section>
        </div>
      </div>
    </div>
  )
}
