import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProjectInstallVerificationPanel } from './ProjectInstallVerificationPanel'
import { copyToClipboard } from '../lib/clipboard'
import { createProject } from '../lib/productApi'

type IntegrationPreset = 'website' | 'spa'
type FrameworkKey = 'html' | 'nextjs' | 'react' | 'nuxt'

interface AddProjectDialogProps {
  isOpen: boolean
  onClose: () => void
  onProjectCreated: () => void
}

interface ProjectSetupForm {
  name: string
  domain: string
  integrationPreset: IntegrationPreset
}

interface FrameworkSnippet {
  key: FrameworkKey
  label: string
  filePath: string
  placement: string
  summary: string
  code: string
}

const integrationOptions = [
  {
    value: 'website' as const,
    label: 'Standard site',
    description: 'Use this if you want regular verification hints for full page loads.',
  },
  {
    value: 'spa' as const,
    label: 'SPA / app shell',
    description: 'Use this if you want verification hints that expect route changes after the first page view.',
  },
]

const frameworkOptions: Array<Pick<FrameworkSnippet, 'key' | 'label'>> = [
  { key: 'html', label: 'HTML' },
  { key: 'nextjs', label: 'Next.js' },
  { key: 'react', label: 'React / Vite' },
  { key: 'nuxt', label: 'Nuxt' },
]

const initialForm: ProjectSetupForm = {
  name: '',
  domain: '',
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

const toTemplateLiteral = (value: string) => `\`\n${value.replace(/`/g, '\\`').replace(/\$\{/g, '\\${')}\n\``

const buildPulseRuntimeSnippet = (projectId: string) =>
  [
    'window.pulse = window.pulse || [];',
    '',
    'pulse.init({',
    `  projectId: ${toJsStringLiteral(projectId)},`,
    '  debug: false,',
    "  consentDefault: 'strict',",
    '});',
    '',
    'window.__pulseRouteState = window.__pulseRouteState || {',
    '  installed: false,',
    "  lastPath: '',",
    '};',
    '',
    'const pulseRouteState = window.__pulseRouteState;',
    '',
    'const sendPulsePageView = () => {',
    '  const nextPath = window.location.pathname + window.location.search;',
    '  if (pulseRouteState.lastPath === nextPath) {',
    '    return;',
    '  }',
    '',
    '  pulseRouteState.lastPath = nextPath;',
    '  pulse.page({',
    '    path: nextPath,',
    '    title: document.title,',
    '    referrer: document.referrer || undefined,',
    '  });',
    '};',
    '',
    'if (!pulseRouteState.installed) {',
    '  const wrapHistoryMethod = (type) => {',
    '    const original = history[type];',
    '',
    '    return function wrappedHistoryState(...args) {',
    '      const result = original.apply(this, args);',
    '      queueMicrotask(sendPulsePageView);',
    '      return result;',
    '    };',
    '  };',
    '',
    "  history.pushState = wrapHistoryMethod('pushState');",
    "  history.replaceState = wrapHistoryMethod('replaceState');",
    "  window.addEventListener('popstate', sendPulsePageView);",
    '  pulseRouteState.installed = true;',
    '}',
    '',
    'sendPulsePageView();',
  ].join('\n')

const buildHtmlInstallSnippet = (projectId: string, siteHost: string) => {
  const runtimeSnippet = buildPulseRuntimeSnippet(projectId)

  return `<script
  defer
  src="https://cdn.pulse.continental.com/pulse.js"
  data-site="${toHtmlAttribute(siteHost)}"
  data-collect="https://api.pulse.continental.com"
></script>
<script>
${runtimeSnippet}
</script>`
}

const buildNextJsInstallSnippet = (projectId: string, siteHost: string) => {
  const runtimeSnippet = toTemplateLiteral(buildPulseRuntimeSnippet(projectId))

  return [
    "import Script from 'next/script'",
    '',
    `const pulseInlineScript = ${runtimeSnippet}`,
    '',
    'export default function RootLayout({ children }: { children: React.ReactNode }) {',
    '  return (',
    '    <html lang="en">',
    '      <body>',
    '        {children}',
    '        <Script',
    '          src="https://cdn.pulse.continental.com/pulse.js"',
    '          strategy="afterInteractive"',
    `          data-site="${siteHost}"`,
    '          data-collect="https://api.pulse.continental.com"',
    '        />',
    '        <Script id="pulse-init" strategy="afterInteractive">',
    '          {pulseInlineScript}',
    '        </Script>',
    '      </body>',
    '    </html>',
    '  )',
    '}',
  ].join('\n')
}

const buildReactViteInstallSnippet = (projectId: string, siteHost: string) => {
  const htmlSnippet = buildHtmlInstallSnippet(projectId, siteHost)
  return `<!-- /index.html -->\n${htmlSnippet}`
}

const buildNuxtInstallSnippet = (projectId: string, siteHost: string) => {
  const runtimeSnippet = toTemplateLiteral(buildPulseRuntimeSnippet(projectId))

  return [
    '<script setup lang="ts">',
    'useHead({',
    '  script: [',
    '    {',
    "      src: 'https://cdn.pulse.continental.com/pulse.js',",
    '      defer: true,',
    `      'data-site': '${siteHost}',`,
    "      'data-collect': 'https://api.pulse.continental.com',",
    "      tagPosition: 'head',",
    '    },',
    '    {',
    '      innerHTML: ' + runtimeSnippet + ',',
    "      tagPosition: 'head',",
    '    },',
    '  ],',
    '})',
    '</script>',
  ].join('\n')
}

const buildFrameworkSnippets = (projectId: string, siteHost: string): FrameworkSnippet[] => [
  {
    key: 'html',
    label: 'HTML',
    filePath: 'Shared document head',
    placement: 'Paste both script tags before </head> so Pulse loads on every page.',
    summary: 'Best for plain websites, static exports, and server-rendered HTML templates.',
    code: buildHtmlInstallSnippet(projectId, siteHost),
  },
  {
    key: 'nextjs',
    label: 'Next.js',
    filePath: 'app/layout.tsx',
    placement: 'Add the scripts once in the root layout so they stay active across route changes.',
    summary: 'Best for App Router projects that need one install point and client-side navigation tracking.',
    code: buildNextJsInstallSnippet(projectId, siteHost),
  },
  {
    key: 'react',
    label: 'React / Vite',
    filePath: '/index.html',
    placement: 'Paste the snippet in the app shell HTML file so it loads before the React bundle.',
    summary: 'Best for React, Vite, and other SPA builds that still ship a shared index.html.',
    code: buildReactViteInstallSnippet(projectId, siteHost),
  },
  {
    key: 'nuxt',
    label: 'Nuxt',
    filePath: 'app.vue',
    placement: 'Install once with useHead so Nuxt injects the scripts into the shared head.',
    summary: 'Best for Nuxt apps that want one shared install path without touching raw HTML.',
    code: buildNuxtInstallSnippet(projectId, siteHost),
  },
]

export function AddProjectDialog({ isOpen, onClose, onProjectCreated }: AddProjectDialogProps) {
  const navigate = useNavigate()
  const [form, setForm] = useState<ProjectSetupForm>(initialForm)
  const [copiedKey, setCopiedKey] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [createdProjectId, setCreatedProjectId] = useState('')
  const [createdFingerprint, setCreatedFingerprint] = useState('')
  const [hasCopiedInstall, setHasCopiedInstall] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [activeFramework, setActiveFramework] = useState<FrameworkKey>('react')
  const titleId = useId()
  const backdropPointerDownRef = useRef(false)

  const resetDialog = () => {
    setForm(initialForm)
    setCopiedKey('')
    setIsSubmitting(false)
    setErrorMessage('')
    setCreatedProjectId('')
    setCreatedFingerprint('')
    setHasCopiedInstall(false)
    setShowAdvanced(false)
    setActiveFramework('react')
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
  const projectId = autoProjectId || 'your-website'
  const siteHost = resolveSiteHost(form.domain, projectId)
  const frameworkSnippets = buildFrameworkSnippets(projectId, siteHost)
  const activeSnippet = frameworkSnippets.find((snippet) => snippet.key === activeFramework) ?? frameworkSnippets[0]
  const creationFingerprint = JSON.stringify({
    projectName,
    domain: form.domain.trim(),
    projectId,
    integrationPreset: form.integrationPreset,
  })
  const isCreated = createdProjectId === projectId && createdFingerprint === creationFingerprint
  const canCreateProject = form.name.trim().length > 0 && !isSubmitting && !isCreated

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
    if (!isCreated) {
      return
    }

    const copied = await handleCopy(`install:${activeFramework}`, activeSnippet.code)
    if (!copied) {
      return
    }

    setHasCopiedInstall(true)
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
            <h2 id={titleId}>Create the project, copy the snippet, and verify the first page view from one screen.</h2>
            <p>
              Pulse keeps the install code visible while you create the project, then turns on copying and live
              verification without sending you through separate steps.
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
                  <span className="country-pill">1</span>
                  <h3>Create the project</h3>
                </div>
                <p>Enter the minimum details once. The snippet preview on the right updates immediately.</p>
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
                  <small>This becomes the project label and the generated project ID.</small>
                </label>

                <label className="setup-field">
                  <span>Website URL</span>
                  <input
                    type="text"
                    value={form.domain}
                    placeholder="https://pulse.continental.com"
                    onChange={(event) => setField('domain', event.target.value)}
                  />
                  <small>Recommended so the install snippet already matches the host you plan to track.</small>
                </label>
              </div>

              <div className="setup-preview-meta">
                <div>
                  <span>Project ID</span>
                  <strong>{projectId}</strong>
                </div>
                <div>
                  <span>Site host</span>
                  <strong>{siteHost}</strong>
                </div>
                <div>
                  <span>Tracking mode</span>
                  <strong>Route-aware by default</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>{isCreated ? 'Project saved' : 'Ready to create'}</strong>
                </div>
              </div>

              <div className="setup-checklist-card setup-advanced-card">
                <div className="setup-field-row">
                  <span>Advanced</span>
                  <button
                    type="button"
                    className="secondary-button setup-inline-button"
                    onClick={() => setShowAdvanced((current) => !current)}
                  >
                    {showAdvanced ? 'Hide options' : 'Show options'}
                  </button>
                </div>

                <p className="setup-advanced-copy">
                  The default snippet already tracks first loads and client-side route changes. These options only tune
                  verification hints after install.
                </p>

                {showAdvanced ? (
                  <div className="setup-option-group" role="group" aria-label="Advanced tracking mode">
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
                ) : null}
              </div>

              {errorMessage ? <p className="empty-list-copy">{errorMessage}</p> : null}

              <div className="setup-footer-actions">
                {isCreated ? (
                  <button type="button" className="secondary-button" onClick={openCreatedProject}>
                    Open project
                  </button>
                ) : null}
                <button type="button" className="secondary-button" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-button gold"
                  disabled={!canCreateProject}
                  onClick={() => void handleCreateProject()}
                >
                  {isSubmitting ? 'Creating project…' : isCreated ? 'Project created' : 'Create project'}
                </button>
              </div>
            </article>

            <article className="data-panel setup-checklist-card">
              <div className="panel-head">
                <h3>Keep it simple</h3>
              </div>

              <ul className="content-bullet-list">
                <li>Create the project once, then copy the framework snippet on the right.</li>
                <li>The default install handles page loads and route changes without an upfront SPA decision.</li>
                <li>Wait for the first accepted `page_view` before adding custom events.</li>
              </ul>
            </article>
          </section>

          <section className="setup-dialog-panel setup-dialog-output-panel">
            <article className="data-panel setup-stage-card">
              <div className="setup-output-hero">
                <div>
                  <span className="status-chip">{isCreated ? 'Ready to install' : 'Preview'}</span>
                  <h3>Pick your framework and paste once</h3>
                  <p>
                    {isCreated
                      ? 'The project is saved. Copy the snippet for your stack and add it to the shared app shell.'
                      : 'Choose the stack your site uses. The file path and snippet stay here while you create the project.'}
                  </p>
                </div>

                <button
                  type="button"
                  className="primary-button gold"
                  disabled={!isCreated}
                  onClick={() => void handleCopyInstall()}
                >
                  {!isCreated
                    ? 'Create project to copy'
                    : copiedKey === `install:${activeFramework}`
                      ? 'Copied snippet'
                      : `Copy ${activeSnippet.label} snippet`}
                </button>
              </div>

              <div className="setup-framework-tabs" role="tablist" aria-label="Install snippets by framework">
                {frameworkOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    role="tab"
                    aria-selected={activeFramework === option.key}
                    className={`setup-framework-tab${activeFramework === option.key ? ' active' : ''}`}
                    onClick={() => setActiveFramework(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <section className="setup-framework-panel">
                <div className="setup-framework-meta">
                  <div>
                    <span>Paste in</span>
                    <strong>{activeSnippet.filePath}</strong>
                  </div>
                  <div>
                    <span>Install note</span>
                    <strong>{activeSnippet.placement}</strong>
                  </div>
                </div>
                <p>{activeSnippet.summary}</p>
              </section>

              <section className="data-panel setup-snippet-card">
                <div className="setup-snippet-card-head">
                  <div>
                    <h3>{activeSnippet.label} snippet</h3>
                    <p>The snippet already includes the project ID, site host, and route-aware page tracking.</p>
                  </div>
                  <button
                    type="button"
                    className="secondary-button setup-copy-button"
                    disabled={!isCreated}
                    onClick={() => void handleCopyInstall()}
                  >
                    {!isCreated
                      ? 'Create first'
                      : copiedKey === `install:${activeFramework}`
                        ? 'Copied'
                        : 'Copy'}
                  </button>
                </div>

                <pre className="setup-snippet-code">
                  <code>{activeSnippet.code}</code>
                </pre>
              </section>

              {!isCreated ? (
                <section className="data-panel setup-checklist-card">
                  <div className="panel-head">
                    <h3>What happens next</h3>
                  </div>

                  <ol className="setup-checklist">
                    <li>Click Create project after the name and URL look right.</li>
                    <li>Copy the snippet for your framework without leaving this screen.</li>
                    <li>Deploy once, open the site, and watch for the first accepted `page_view` below.</li>
                  </ol>
                </section>
              ) : null}
            </article>

            {isCreated ? (
              <ProjectInstallVerificationPanel
                projectId={projectId}
                title="Live verification"
                description="Deploy the snippet, open one real page, and keep checking here until Pulse confirms the first accepted page view."
                autoRefresh
              />
            ) : null}

            {isCreated ? (
              <article className="data-panel setup-checklist-card">
                <div className="panel-head">
                  <h3>After install</h3>
                </div>

                <div className="setup-chip-row">
                  <span className="status-chip">{hasCopiedInstall ? 'Snippet copied' : 'Snippet ready'}</span>
                  <span className="status-chip">Project ID {projectId}</span>
                </div>

                <ol className="setup-checklist">
                  <li>Paste the snippet into the shared file shown in the current framework tab.</li>
                  <li>Deploy the site so the script is live in production or staging.</li>
                  <li>Open one page, then wait for the verification panel to confirm the first `page_view`.</li>
                </ol>

                <div className="setup-footer-actions">
                  <button type="button" className="secondary-button" onClick={resetDialog}>
                    Start another
                  </button>
                  <button type="button" className="primary-button gold" onClick={openCreatedProject}>
                    Open project
                  </button>
                </div>
              </article>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  )
}
