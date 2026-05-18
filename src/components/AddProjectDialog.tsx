import { useEffect, useId, useState } from 'react'
import { AppIcon } from './Icon'

type ProjectIcon = 'shield' | 'chart' | 'bolt' | 'globe'
type IntegrationPreset = 'website' | 'spa'
type ConsentDefault = 'strict' | 'standard'
type LaunchEvent = 'none' | 'button_click' | 'form_submit' | 'file_download' | 'video_play'
type RetentionMonths = 6 | 12 | 13

interface AddProjectDialogProps {
  isOpen: boolean
  onClose: () => void
}

interface ProjectSetupForm {
  name: string
  projectId: string
  domain: string
  owner: string
  region: string
  retentionMonths: RetentionMonths
  icon: ProjectIcon
  integrationPreset: IntegrationPreset
  consentDefault: ConsentDefault
  firstEvent: LaunchEvent
}

interface ChoiceOption<T extends string | number> {
  value: T
  label: string
  description: string
  icon?: ProjectIcon
}

interface SnippetCardProps {
  title: string
  description: string
  code: string
  copied: boolean
  onCopy: () => void
}

const DEFAULT_PROJECT_IDS = ['aegis', 'contitech', 'vdo-fleet', 'contitrade']

const regionOptions = ['Global', 'EMEA', 'Europe', 'North America', 'APAC'] as const

const iconOptions: ChoiceOption<ProjectIcon>[] = [
  { value: 'globe', label: 'Public site', description: 'Best for multi-region websites and launch hubs.', icon: 'globe' },
  { value: 'chart', label: 'Growth app', description: 'A good fit for product funnels and reporting surfaces.', icon: 'chart' },
  { value: 'bolt', label: 'High-touch flow', description: 'Ideal for lead-gen journeys and conversion-heavy apps.', icon: 'bolt' },
  { value: 'shield', label: 'Governed property', description: 'Use this for trust, privacy, or compliance-oriented products.', icon: 'shield' },
]

const retentionOptions: ChoiceOption<RetentionMonths>[] = [
  { value: 6, label: '6 months', description: 'Short retention for lean launches or controlled pilots.' },
  { value: 12, label: '12 months', description: 'Balanced year-over-year reporting without the longest tail.' },
  { value: 13, label: '13 months', description: 'Matches the current workspace default and most production setups.' },
]

const integrationOptions: ChoiceOption<IntegrationPreset>[] = [
  { value: 'website', label: 'Website', description: 'For normal page loads in a classic multi-page site shell.' },
  { value: 'spa', label: 'SPA / app shell', description: 'Adds route tracking for client-side navigation changes.' },
]

const consentOptions: ChoiceOption<ConsentDefault>[] = [
  { value: 'strict', label: 'Strict first', description: 'Starts with minimal collection until analytics consent is granted.' },
  { value: 'standard', label: 'Standard', description: 'Starts in normal anonymous analytics mode from the first load.' },
]

const eventOptions: ChoiceOption<LaunchEvent>[] = [
  { value: 'none', label: 'Page views only', description: 'Keep launch scope minimal and validate traffic first.' },
  { value: 'button_click', label: 'CTA click', description: 'Track the primary button that moves a visitor deeper.' },
  { value: 'form_submit', label: 'Form submit', description: 'Use this for contact, lead, or request completions.' },
  { value: 'file_download', label: 'File download', description: 'Best for brochures, specs, and resource hubs.' },
  { value: 'video_play', label: 'Video play', description: 'Capture product demo and explainer engagement.' },
]

const integrationLabels: Record<IntegrationPreset, string> = {
  website: 'Website',
  spa: 'SPA / app shell',
}

const consentLabels: Record<ConsentDefault, string> = {
  strict: 'Strict',
  standard: 'Standard',
}

const launchEventDetails: Record<Exclude<LaunchEvent, 'none'>, { label: string; properties: string }> = {
  button_click: {
    label: 'Primary CTA click',
    properties: String.raw`  button: 'primary_cta',
  location: 'hero',`,
  },
  form_submit: {
    label: 'Lead or contact submit',
    properties: String.raw`  form: 'contact_request',
  step: 'completed',`,
  },
  file_download: {
    label: 'Brochure or spec download',
    properties: String.raw`  asset: 'product_sheet',
  location: 'resources',`,
  },
  video_play: {
    label: 'Video engagement',
    properties: String.raw`  video: 'overview_demo',
  location: 'hero',`,
  },
}

const initialForm: ProjectSetupForm = {
  name: '',
  projectId: '',
  domain: '',
  owner: 'Digital team',
  region: 'Global',
  retentionMonths: 13,
  icon: 'globe',
  integrationPreset: 'website',
  consentDefault: 'strict',
  firstEvent: 'button_click',
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

const resolveProjectDomain = (value: string, fallbackSiteHost: string) => {
  const parsed = parseDomain(value)
  if (parsed) {
    return `${parsed.protocol}//${parsed.host}`
  }

  return `https://${fallbackSiteHost}`
}

const buildProjectNote = (
  integrationPreset: IntegrationPreset,
  firstEvent: LaunchEvent,
  siteHost: string,
  consentDefault: ConsentDefault,
) => {
  const baseFocus =
    firstEvent === 'none'
      ? integrationPreset === 'spa'
        ? 'route transitions and baseline product usage'
        : 'page-view validation and baseline landing performance'
      : launchEventDetails[firstEvent].label.toLowerCase()

  const consentSuffix =
    consentDefault === 'strict'
      ? 'with strict consent-aware defaults for the first rollout'
      : 'with a standard anonymous analytics launch profile'

  return `Initial rollout focused on ${baseFocus} across ${siteHost} ${consentSuffix}.`
}

const toJsStringLiteral = (value: string) => JSON.stringify(value)

const toHtmlAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const buildCollectorConfigSnippet = (projectId: string, retentionMonths: RetentionMonths) => String.raw`# /etc/pulse/pulse-collector.env
# If these keys already exist, merge this project into the current comma-separated values.
PULSE_PROJECT_IDS=${[...DEFAULT_PROJECT_IDS, projectId].join(',')}
PULSE_PROJECT_RETENTION_MONTHS=${projectId}:${retentionMonths}`

const buildServerProjectSnippet = (projectId: string, projectName: string) =>
  `// Add to PROJECTS in server/src/projects.ts\n{ id: ${toJsStringLiteral(projectId)}, name: ${toJsStringLiteral(projectName)} },`

const buildProjectDirectorySnippet = (
  projectId: string,
  projectName: string,
  projectDomain: string,
  owner: string,
  region: string,
  icon: ProjectIcon,
  note: string,
) =>
  `// Add to projectDirectory in src/data/content.ts
{
  slug: ${toJsStringLiteral(projectId)},
  name: ${toJsStringLiteral(projectName)},
  domain: ${toJsStringLiteral(projectDomain)},
  owner: ${toJsStringLiteral(owner)},
  region: ${toJsStringLiteral(region)},
  status: 'Pilot',
  icon: '${icon}',
  note: ${toJsStringLiteral(note)},
},`

const buildInstallSnippet = (
  projectId: string,
  siteHost: string,
  consentDefault: ConsentDefault,
) => `<script
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
    consentDefault: ${toJsStringLiteral(consentDefault)},
  });

  pulse.page({
    path: window.location.pathname + window.location.search,
    title: document.title,
    referrer: document.referrer || undefined,
  });
</script>`

const buildSpaRouteSnippet = () => String.raw`const sendPulsePageView = () => {
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

const buildEventSnippet = (eventName: Exclude<LaunchEvent, 'none'>) => `pulse.track(${toJsStringLiteral(eventName)}, {
${launchEventDetails[eventName].properties}
});`

const buildFullSetupSnippet = (
  collectorConfig: string,
  serverProject: string,
  projectDirectory: string,
  installSnippet: string,
  spaRouteSnippet: string | null,
  eventSnippet: string | null,
) =>
  [
    collectorConfig,
    '',
    serverProject,
    '',
    projectDirectory,
    '',
    installSnippet,
    spaRouteSnippet ? `\n${spaRouteSnippet}` : '',
    eventSnippet ? `\n${eventSnippet}` : '',
  ]
    .filter(Boolean)
    .join('\n')

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

function ChoiceGrid<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: ChoiceOption<T>[]
  onChange: (nextValue: T) => void
}) {
  return (
    <div className="setup-option-group" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          className={`setup-option-card${value === option.value ? ' active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          <div className="setup-option-card-head">
            {option.icon ? (
              <span className="setup-option-icon">
                <AppIcon name={option.icon} />
              </span>
            ) : null}
            <strong>{option.label}</strong>
          </div>
          <span>{option.description}</span>
        </button>
      ))}
    </div>
  )
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

export function AddProjectDialog({ isOpen, onClose }: AddProjectDialogProps) {
  const [form, setForm] = useState<ProjectSetupForm>(initialForm)
  const [copiedKey, setCopiedKey] = useState('')
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

  const autoProjectId = slugifyProjectId(form.name)
  const projectId = form.projectId || autoProjectId || 'new-project'
  const projectName = form.name.trim() || 'New Project'
  const owner = form.owner.trim() || 'Digital team'
  const siteHost = resolveSiteHost(form.domain, projectId)
  const projectDomain = resolveProjectDomain(form.domain, siteHost)
  const note = buildProjectNote(form.integrationPreset, form.firstEvent, siteHost, form.consentDefault)

  const collectorConfigSnippet = buildCollectorConfigSnippet(projectId, form.retentionMonths)
  const serverProjectSnippet = buildServerProjectSnippet(projectId, projectName)
  const projectDirectorySnippet = buildProjectDirectorySnippet(
    projectId,
    projectName,
    projectDomain,
    owner,
    form.region,
    form.icon,
    note,
  )
  const installSnippet = buildInstallSnippet(projectId, siteHost, form.consentDefault)
  const spaRouteSnippet = form.integrationPreset === 'spa' ? buildSpaRouteSnippet() : null
  const eventSnippet = form.firstEvent === 'none' ? null : buildEventSnippet(form.firstEvent)
  const fullSetupSnippet = buildFullSetupSnippet(
    collectorConfigSnippet,
    serverProjectSnippet,
    projectDirectorySnippet,
    installSnippet,
    spaRouteSnippet,
    eventSnippet,
  )

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
            <span className="status-chip">Guided setup</span>
            <h2 id={titleId}>Add a project and get the exact Pulse code you need.</h2>
            <p>
              Fill in a few project details and Pulse will generate the collector config, project registry entries, and
              paste-ready installation snippet for you.
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
                  <h3>Project basics</h3>
                </div>
                <p>Keep this tight. The generated output updates live as you type.</p>
              </div>

              <div className="setup-field-grid">
                <label className="setup-field">
                  <span>Project name</span>
                  <input
                    type="text"
                    value={form.name}
                    placeholder="Continental Careers"
                    onChange={(event) => setField('name', event.target.value)}
                  />
                </label>

                <label className="setup-field">
                  <span>Primary domain</span>
                  <input
                    type="text"
                    value={form.domain}
                    placeholder="careers.continental.com"
                    onChange={(event) => setField('domain', event.target.value)}
                  />
                </label>

                <label className="setup-field">
                  <span>Owner or team</span>
                  <input
                    type="text"
                    value={form.owner}
                    placeholder="Growth marketing"
                    onChange={(event) => setField('owner', event.target.value)}
                  />
                </label>

                <label className="setup-field">
                  <span>Region</span>
                  <select value={form.region} onChange={(event) => setField('region', event.target.value)}>
                    {regionOptions.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="setup-field">
                <div className="setup-field-row">
                  <span>Project ID</span>
                  {form.projectId ? (
                    <button type="button" className="text-link-button setup-inline-button" onClick={() => setField('projectId', '')}>
                      Use generated
                    </button>
                  ) : (
                    <small>Auto-generated from the project name.</small>
                  )}
                </div>
                <input
                  type="text"
                  value={form.projectId || autoProjectId}
                  placeholder="continental-careers"
                  onChange={(event) => setField('projectId', slugifyProjectId(event.target.value))}
                />
              </label>
            </article>

            <article className="data-panel setup-section-card">
              <div className="setup-section-head">
                <div>
                  <span className="country-pill">2</span>
                  <h3>Launch profile</h3>
                </div>
                <p>Choose the install shape Pulse should optimize for.</p>
              </div>

              <div className="setup-form-stack">
                <div className="setup-field">
                  <span>Project card style</span>
                  <ChoiceGrid label="Project card style" value={form.icon} options={iconOptions} onChange={(value) => setField('icon', value)} />
                </div>

                <div className="setup-field">
                  <span>Retention</span>
                  <ChoiceGrid
                    label="Retention"
                    value={form.retentionMonths}
                    options={retentionOptions}
                    onChange={(value) => setField('retentionMonths', value)}
                  />
                </div>

                <div className="setup-field">
                  <span>Integration type</span>
                  <ChoiceGrid
                    label="Integration type"
                    value={form.integrationPreset}
                    options={integrationOptions}
                    onChange={(value) => setField('integrationPreset', value)}
                  />
                </div>

                <div className="setup-field">
                  <span>Consent default</span>
                  <ChoiceGrid
                    label="Consent default"
                    value={form.consentDefault}
                    options={consentOptions}
                    onChange={(value) => setField('consentDefault', value)}
                  />
                </div>
              </div>
            </article>

            <article className="data-panel setup-section-card">
              <div className="setup-section-head">
                <div>
                  <span className="country-pill">3</span>
                  <h3>First event</h3>
                </div>
                <p>Pick the first non-page interaction you want the generated example to cover.</p>
              </div>

              <ChoiceGrid label="First event" value={form.firstEvent} options={eventOptions} onChange={(value) => setField('firstEvent', value)} />
            </article>

            <article className="data-panel setup-preview-card">
              <div className="setup-preview-head">
                <div className="project-avatar">
                  <AppIcon name={form.icon} />
                </div>
                <div>
                  <strong>{projectName}</strong>
                  <p>
                    {projectId} · {siteHost}
                  </p>
                </div>
              </div>

              <div className="setup-preview-meta">
                <div>
                  <span>Launch shape</span>
                  <strong>{integrationLabels[form.integrationPreset]}</strong>
                </div>
                <div>
                  <span>Consent</span>
                  <strong>{consentLabels[form.consentDefault]}</strong>
                </div>
                <div>
                  <span>Retention</span>
                  <strong>{form.retentionMonths} months</strong>
                </div>
                <div>
                  <span>Owner</span>
                  <strong>{owner}</strong>
                </div>
              </div>

              <p>{note}</p>
            </article>
          </section>

          <section className="setup-dialog-panel setup-dialog-output-panel">
            <article className="data-panel setup-output-hero">
              <div>
                <span className="status-chip">Ready to paste</span>
                <h3>Your setup pack is generated.</h3>
                <p>
                  This output is aligned to the current Pulse collector rules, project registry shape, and browser SDK
                  contract in this repo.
                </p>
              </div>

              <button type="button" className="primary-button gold" onClick={() => void handleCopy('full-setup', fullSetupSnippet)}>
                {copiedKey === 'full-setup' ? 'Copied full setup' : 'Copy full setup'}
              </button>
            </article>

            <div className="setup-chip-row">
              <span className="status-chip">{projectId}</span>
              <span className="status-chip">{integrationLabels[form.integrationPreset]}</span>
              <span className="status-chip">{consentLabels[form.consentDefault]} consent</span>
              <span className="status-chip">{form.retentionMonths} month retention</span>
            </div>

            <SnippetCard
              title="Collector config"
              description="Register the project with the Pulse collector so the backend accepts events from it."
              code={collectorConfigSnippet}
              copied={copiedKey === 'collector'}
              onCopy={() => void handleCopy('collector', collectorConfigSnippet)}
            />

            <SnippetCard
              title="Backend registry entry"
              description="Add the new project metadata so the API and analytics layer know how to label it."
              code={serverProjectSnippet}
              copied={copiedKey === 'server-project'}
              onCopy={() => void handleCopy('server-project', serverProjectSnippet)}
            />

            <SnippetCard
              title="Project directory entry"
              description="Drop this into the frontend project directory so the card looks complete in the dashboard."
              code={projectDirectorySnippet}
              copied={copiedKey === 'project-directory'}
              onCopy={() => void handleCopy('project-directory', projectDirectorySnippet)}
            />

            <SnippetCard
              title="Site install snippet"
              description="Paste this into the target site's shell to initialize Pulse and capture the first page view."
              code={installSnippet}
              copied={copiedKey === 'install'}
              onCopy={() => void handleCopy('install', installSnippet)}
            />

            {spaRouteSnippet ? (
              <SnippetCard
                title="SPA route tracking"
                description="Add this once in the app shell so client-side navigation still emits page views."
                code={spaRouteSnippet}
                copied={copiedKey === 'spa'}
                onCopy={() => void handleCopy('spa', spaRouteSnippet)}
              />
            ) : null}

            {eventSnippet ? (
              <SnippetCard
                title="First event example"
                description="Use this as the first interaction example after the install snippet is live."
                code={eventSnippet}
                copied={copiedKey === 'event'}
                onCopy={() => void handleCopy('event', eventSnippet)}
              />
            ) : null}

            <article className="data-panel setup-checklist-card">
              <div className="panel-head">
                <h3>Launch checklist</h3>
              </div>

              <ol className="setup-checklist">
                <li>Update the collector config and restart the Pulse backend if you are using environment overrides.</li>
                <li>Add the backend and frontend project entries so the workspace lists the project with the right labels.</li>
                <li>Paste the install snippet into the target site shell, then validate a page view in the dashboard.</li>
              </ol>
            </article>
          </section>
        </div>
      </div>
    </div>
  )
}
