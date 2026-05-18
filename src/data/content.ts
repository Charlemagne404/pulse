import { STATUS_URL } from '../lib/siteLinks'

export interface SeriesPoint {
  label: string
  value: number
}

export interface MetricSnapshot {
  label: string
  value: string
  delta?: string
  note?: string
  trend?: number[]
  live?: boolean
}

export interface RangePreset {
  label: string
  dates: string
  series: SeriesPoint[]
}

export interface StaticPageCard {
  label: string
  value: string
  detail: string
}

export interface StaticPageSection {
  title: string
  body: string
  bullets: string[]
}

export interface StaticPageContent {
  eyebrow: string
  title: string
  description: string
  cards: StaticPageCard[]
  sections: StaticPageSection[]
  primaryAction: {
    label: string
    to: string
  }
  secondaryAction: {
    label: string
    to: string
  }
}

export const staticPages: Record<string, StaticPageContent> = {
  privacy: {
    eyebrow: 'Privacy',
    title: 'Privacy-first analytics with narrow collection by default.',
    description:
      'Pulse is meant to be installed and reviewed by the people using it. The defaults stay intentionally minimal, and the docs show exactly how to keep collection tight.',
    cards: [
      { label: 'Cookies', value: 'Not required', detail: 'Pulse avoids cookie-based analytics by default.' },
      { label: 'Identifiers', value: 'Minimal', detail: 'Collection is centered on events, pages, and aggregate trends.' },
      { label: 'Setup model', value: 'Self-serve', detail: 'You add the script, verify the payloads, and review the dashboard yourself.' },
    ],
    sections: [
      {
        title: 'What gets collected',
        body: 'Pulse captures the page context, event names, and technical dimensions needed to understand site usage without turning the tool into an identity layer.',
        bullets: ['Page and event metadata', 'Device and browser dimensions', 'Country-level location from anonymized IP handling'],
      },
      {
        title: 'What stays out',
        body: 'The product is deliberately opinionated about what it does not do. It is built to measure usage, not to profile people.',
        bullets: ['No third-party ad tracking', 'No fingerprinting', 'No sale of collected analytics data'],
      },
      {
        title: 'How to keep it tight',
        body: 'Start with a short event list, review the dashboard and payloads after installation, and only expand the setup if the extra data is genuinely useful.',
        bullets: ['Project-level event allowlists', 'Consent mode configuration', 'Retention visibility in workspace settings'],
      },
    ],
    primaryAction: { label: 'Read Docs', to: '/docs' },
    secondaryAction: { label: 'Open Dashboard', to: '/dashboard' },
  },
  status: {
    eyebrow: 'Operations',
    title: 'Live service status for collection, dashboarding, and exports.',
    description:
      'Check current service health, maintenance windows, and the latest resolved incidents across the Pulse platform.',
    cards: [
      { label: 'Collection API', value: 'Operational', detail: '99.99% uptime across the last 30 days.' },
      { label: 'Dashboard', value: 'Operational', detail: 'Average render latency below 420ms this week.' },
      { label: 'Exports', value: 'Recently recovered', detail: 'Resolved after a brief queue delay earlier this week.' },
    ],
    sections: [
      {
        title: 'Current health',
        body: 'Core analytics collection and dashboard reads are healthy. Scheduled exports recovered after a queueing issue and are back within their normal delivery window.',
        bullets: ['No active incidents', 'Weekly maintenance window: Sundays 02:00 UTC', 'Status updates posted within 15 minutes'],
      },
      {
        title: 'Resolved incident history',
        body: 'A recent delayed export queue affected a subset of weekly report deliveries. Collection and live dashboards were unaffected.',
        bullets: ['Impacted window: 08:14 to 08:42 UTC', 'Root cause: worker capacity spike', 'Mitigation: queue autoscaling raised'],
      },
      {
        title: 'Maintenance policy',
        body: 'Planned changes are announced ahead of time and scheduled to minimize disruption to normal reporting.',
        bullets: ['Advance notice in help docs and status updates', 'Post-maintenance validation run', 'Rollback plan for every release window'],
      },
    ],
    primaryAction: { label: 'Read Docs', to: '/docs' },
    secondaryAction: { label: 'Open Dashboard', to: '/dashboard' },
  },
  help: {
    eyebrow: 'Help',
    title: 'Self-serve setup, validation, and troubleshooting.',
    description:
      'Pulse is meant to be used directly. Start with the docs, validate what the script sends, and use this page as a short guide for common checks when something looks off.',
    cards: [
      { label: 'Setup path', value: '10 min', detail: 'Install the script, initialize the project, and confirm one event.' },
      { label: 'Primary source', value: 'Docs', detail: 'The docs cover installation, consent mode, routing, and event naming.' },
      { label: 'Best first check', value: 'Dashboard', detail: 'Confirm page views before expanding into more custom events.' },
    ],
    sections: [
      {
        title: 'Install and verify',
        body: 'Use the docs to add the script, initialize Pulse once, and validate page views before adding more instrumentation.',
        bullets: ['Install the script in the site shell', 'Confirm the correct project identifier', 'Validate page views and one custom event'],
      },
      {
        title: 'Privacy checks',
        body: 'Review the privacy page before widening the tracking plan. Keep payloads small and avoid sending anything you would not want to audit later.',
        bullets: ['Avoid personal data in payloads', 'Keep events business-readable', 'Use consent mode when required'],
      },
      {
        title: 'When something looks off',
        body: 'If the data does not match expectations, compare the page and event payloads against the docs, then check the current system status before changing the setup.',
        bullets: ['Review the event reference', 'Compare the live payloads with the docs', 'Check status for collection or export issues'],
      },
    ],
    primaryAction: { label: 'Browse Docs', to: '/docs' },
    secondaryAction: { label: 'Check Status', to: STATUS_URL },
  },
  imprint: {
    eyebrow: 'Legal',
    title: 'Publishing information for Pulse.',
    description: 'This page lists the basic publication and contact details for Pulse.',
    cards: [
      { label: 'Publisher', value: 'Continental', detail: 'Pulse is published and operated by Continental.' },
      { label: 'Primary office', value: 'Hanover', detail: 'Registered publishing location for the product.' },
      { label: 'Contact', value: 'pulse@continental.com', detail: 'General contact route for Pulse questions.' },
    ],
    sections: [
      {
        title: 'Responsible entity',
        body: 'Continental is responsible for operating and publishing Pulse.',
        bullets: ['Registered office: Hanover, Germany', 'Product name: Pulse', 'Website and analytics software operated by Continental'],
      },
      {
        title: 'Contact route',
        body: 'Use the published contact address when you need to reference the product, and include the relevant site or project context in the message.',
        bullets: ['Check the docs before reaching out about setup', 'Use the status page for incident visibility', 'Reference the relevant project or domain when contacting Pulse'],
      },
      {
        title: 'Usage note',
        body: 'This imprint is provided for users and reviewers who need the responsible entity and contact route for Pulse.',
        bullets: ['Use the docs for setup details', 'Use the privacy page for collection boundaries', 'Use the status page for current availability information'],
      },
    ],
    primaryAction: { label: 'Read Docs', to: '/docs' },
    secondaryAction: { label: 'View Status', to: STATUS_URL },
  },
  terms: {
    eyebrow: 'Legal',
    title: 'Terms for using Pulse.',
    description:
      'These terms summarize the basic expectations for using the Pulse workspace, APIs, reporting surfaces, and export capabilities.',
    cards: [
      { label: 'Eligible use', value: 'Your sites and apps', detail: 'Projects should represent sites or apps you are authorized to measure.' },
      { label: 'Access model', value: 'Workspace roles', detail: 'Workspace access should match the reporting and setup work each person needs to do.' },
      { label: 'Exports', value: 'Limited by role', detail: 'Manual exports are CSV and scheduled exports are PDF summaries managed inside the workspace.' },
    ],
    sections: [
      {
        title: 'Workspace use',
        body: 'Use clear project names, keep the install path simple, and review dashboards after setup so the workspace stays easy to understand.',
        bullets: ['Define a short tracking plan before launch', 'Review access on a regular cadence', 'Keep project names and event names readable'],
      },
      {
        title: 'Data handling',
        body: 'Anyone exporting or sharing Pulse data remains responsible for using it in line with the product privacy rules and the policies that apply to their organization.',
        bullets: ['Limit exports to real business need', 'Avoid re-identification attempts', 'Respect retention guidance for downstream files'],
      },
      {
        title: 'Operational expectations',
        body: 'Use the docs and help resources for setup issues, keep tracking aligned with the live product, and review status notices before major launches.',
        bullets: ['Update tracking when journeys change', 'Review payloads before widening collection', 'Review status notices before major launches'],
      },
    ],
    primaryAction: { label: 'Review Docs', to: '/docs' },
    secondaryAction: { label: 'Open Help', to: '/help' },
  },
}

export interface DocsSectionContent {
  title: string
  summary: string
  body: string[]
  bullets?: string[]
  code?: {
    title: string
    code: string
  }
}

export const docsSidebarSections = [
  {
    title: 'Get started',
    items: ['Introduction', 'Quick Start', 'Installation', 'Project Setup'],
  },
  {
    title: 'Guides',
    items: ['Tracking Pages', 'Custom Events', 'E-commerce', 'SPA Support', 'Consent Mode'],
  },
  {
    title: 'Reference',
    items: ['API Reference', 'Event Reference', 'Script API'],
  },
  {
    title: 'Resources',
    items: ['Privacy', 'FAQs', 'Changelog'],
  },
]

export const docsSections: DocsSectionContent[] = [
  {
    title: 'Introduction',
    summary: 'What Pulse is for and how to get it running.',
    body: [
      'Pulse is a privacy-first analytics platform you can install on your own site. It gives you a clear view of visits, engagement, and events without relying on cookie-heavy tracking patterns.',
      'Most setups start with one project, stable page naming, and a short event list. Once the baseline instrumentation is verified, you can expand into reports, alerts, and exports.',
    ],
    bullets: ['Built for self-serve setup', 'Designed for privacy review', 'Works for sites, apps, and campaign landers'],
  },
  {
    title: 'Quick Start',
    summary: 'Get a project online with a minimal setup path.',
    body: [
      'Create the project in Pulse, add the script tag to the site shell, and initialize the client once with the project identifier. After that, validate page views and one custom event in the dashboard.',
      'If the data does not match expectations, compare the payloads against the docs and privacy notes before widening the setup. For most launches, the self-serve docs are enough to get to first data quickly.',
    ],
    bullets: ['Create the project', 'Install the script', 'Validate page views', 'Add one high-signal event'],
  },
  {
    title: 'Installation',
    summary: 'Add the client to the page and configure the collection endpoint.',
    body: [
      'Place the script in the document head so it loads early without blocking the main content. The script can be loaded once and reused across marketing pages and application shells.',
      'Keep environment-specific endpoint configuration in one place so production and staging do not mix events during setup validation.',
    ],
    code: {
      title: 'script tag',
      code: String.raw`<script
  defer
  src="https://cdn.pulse.continental.com/pulse.js"
  data-site="example.com"
  data-collect="https://api.pulse.continental.com"
></script>`,
    },
  },
  {
    title: 'Project Setup',
    summary: 'Initialize a project and confirm the default collection mode.',
    body: [
      'Call init exactly once in the application shell. Set the project identifier, start in strict mode, and disable debug mode in production environments.',
      'Pair setup with a lightweight tracking plan that documents the primary KPIs and the events that matter for launch readiness.',
    ],
    code: {
      title: 'project config',
      code: String.raw`window.pulse = window.pulse || [];

pulse.init({
  projectId: 'marketing-site',
  debug: false,
  consentDefault: 'strict',
});`,
    },
  },
  {
    title: 'Tracking Pages',
    summary: 'Capture page views consistently across templates and route changes.',
    body: [
      'For multi-template websites, confirm that page titles and canonical route labels stay stable even when modules render different content blocks.',
      'For apps, treat meaningful route transitions as page views and keep naming aligned with the product journey rather than internal route implementation details.',
    ],
    bullets: ['Normalize route labels', 'Track route transitions explicitly for apps', 'Keep titles readable in reports'],
  },
  {
    title: 'Custom Events',
    summary: 'Track product interactions that explain intent and adoption.',
    body: [
      'Use custom events sparingly and prefer clear verbs tied to business meaning. The best events describe actions like signup_started, quote_requested, or demo_opened.',
      'Keep payloads small, use stable property names, and avoid including freeform values that are difficult to analyze or review later.',
    ],
    code: {
      title: 'custom event',
      code: String.raw`pulse.track('button_click', {
  button: 'learn_more',
  location: 'hero',
});`,
    },
  },
  {
    title: 'E-commerce',
    summary: 'Model commerce and quote-request flows with clear purchase stages.',
    body: [
      'Pulse works well for cart, quote, and lead-generation flows when events are structured around the step the user completed rather than the UI widget they clicked.',
      'Track the product or offer context, the commercial step reached, and the completion result so reporting can distinguish interest from completed conversion.',
    ],
    bullets: ['Track view_item and begin_checkout equivalents', 'Record commercial step progression', 'Keep order or quote identifiers out of public payloads'],
  },
  {
    title: 'SPA Support',
    summary: 'Handle single-page application route changes cleanly.',
    body: [
      'In single-page applications, fire a page view when the route meaningfully changes and do not rely on the initial bootstrap event alone.',
      'If the app loads content lazily after navigation, trigger the page view when the route and the primary content state are both ready.',
    ],
    code: {
      title: 'route tracking',
      code: String.raw`router.afterEach((to) => {
  pulse.page({
    path: to.fullPath,
    title: document.title,
  });
});`,
    },
  },
  {
    title: 'Consent Mode',
    summary: 'Align collection behavior with the user consent state.',
    body: [
      'Pulse supports consent-aware collection by letting you disable optional tracking surfaces until the correct state is known.',
      'The recommended pattern is to initialize the client with the strictest collection mode, then open the needed capabilities only after the consent manager resolves.',
    ],
    bullets: ['Default to strict mode', 'Update collection only after consent is known', 'Document consent assumptions in the project setup'],
  },
  {
    title: 'API Reference',
    summary: 'Understand the core browser methods available in the client.',
    body: [
      'The primary browser methods in the MVP path are init, page, and track. Those three calls cover the standard setup used across the product docs.',
      'Identify is intentionally out of the standard MVP setup path so the client stays focused on anonymous first-party measurement.',
    ],
    code: {
      title: 'browser API',
      code: String.raw`pulse.page({ path: '/privacy', title: 'Privacy' });
pulse.track('file_download', { asset: 'product_sheet' });`,
    },
  },
  {
    title: 'Event Reference',
    summary: 'Use a shared naming system for common event types.',
    body: [
      'Use page_view for route-level traffic, button_click for important CTA interactions, file_download for asset delivery, and form_submit for lead or contact milestones.',
      'When a product needs custom vocabulary, document it in the project tracking plan and keep the event names business-readable.',
    ],
    bullets: ['page_view', 'button_click', 'file_download', 'form_submit', 'video_play'],
  },
  {
    title: 'Script API',
    summary: 'Configure the bootstrap script without shipping environment-specific code paths everywhere.',
    body: [
      'The script tag accepts data attributes for site and endpoint configuration. Keep those settings close to the deployment environment so they can be reviewed during setup.',
      'If you manage multiple sites, centralize script configuration in the site shell or server-side template layer rather than inside page modules.',
    ],
    code: {
      title: 'script configuration',
  code: String.raw`<script
  defer
  src="https://cdn.pulse.continental.com/pulse.js"
  data-site="marketing-site"
  data-collect="https://api.pulse.continental.com"
></script>`,
    },
  },
  {
    title: 'Privacy',
    summary: 'See the privacy-by-design principles behind Pulse collection.',
    body: [
      'Pulse is intentionally narrow in what it collects. Review event payloads for data minimization and avoid adding unnecessary business or personal detail.',
      'Unique visitors are approximate, some session-based metrics only exist after granted analytics consent, and Pulse does not support person-level cross-device attribution.',
    ],
    bullets: ['Anonymous first-party measurement only', 'Unique visitors are approximate', 'Some metrics require granted analytics consent'],
  },
  {
    title: 'FAQs',
    summary: 'Common setup questions and the shortest useful answers.',
    body: [
      'How many events should I track? Only the ones that explain critical journeys or operational milestones. More events do not automatically mean better reporting.',
      'How quickly does data arrive? Most events appear in the dashboard within seconds, while scheduled reports and exports follow their configured delivery window.',
    ],
    bullets: ['Start small and validate', 'Prefer stable naming', 'Review payloads before expanding scope'],
  },
  {
    title: 'Changelog',
    summary: 'Recent product changes worth knowing about.',
    body: [
      'Latest release: Added workspace alerts and shared report landing pages for top referrers and content performance.',
      'Previous release: Improved workspace settings visibility and expanded the docs coverage for SPA routing and consent mode.',
    ],
    bullets: ['Recent: alerting and report deep links', 'Earlier: docs expansion', 'Earlier: export queue improvements'],
  },
]

export const reportLibrary = [
  {
    slug: 'executive',
    title: 'Executive Weekly',
    description: 'A portfolio-level briefing covering traffic, project momentum, and alert summaries for stakeholder reviews.',
    to: '/reports',
  },
  {
    slug: 'pages',
    title: 'Content Performance',
    description: 'Deep dive into top pages, landing journeys, and content opportunities across the workspace.',
    to: '/reports/pages',
  },
  {
    slug: 'referrers',
    title: 'Acquisition Sources',
    description: 'Track external referrers, branded traffic, and owned-channel contribution over time.',
    to: '/reports/referrers',
  },
]

export const reportDetails = {
  pages: {
    title: 'Content Performance',
    description: 'Review the top landing and help pages attracting the most attention across active projects.',
  },
  referrers: {
    title: 'Acquisition Sources',
    description: 'Understand which external and owned channels send the highest-value traffic into the portfolio.',
  },
}

export const eventCatalog = [
  {
    name: 'page_view',
    category: 'Core',
    description: 'Captured for route or page-level visibility across websites and application flows.',
  },
  {
    name: 'button_click',
    category: 'Engagement',
    description: 'Used for high-signal CTA interactions where click intent matters for reporting.',
  },
  {
    name: 'form_submit',
    category: 'Conversion',
    description: 'Represents successful contact, lead, or request form completion.',
  },
  {
    name: 'file_download',
    category: 'Content',
    description: 'Tracks document or asset downloads tied to product research and enablement.',
  },
  {
    name: 'video_play',
    category: 'Engagement',
    description: 'Measures media engagement for product explainers and campaign content.',
  },
]
