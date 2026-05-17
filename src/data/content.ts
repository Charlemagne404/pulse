import { buildDemoRangePresets, formatTimelineLabel } from '../lib/demoDates'
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
      'Keep rollout teams aligned with current service health, maintenance windows, and the last resolved incidents across the Pulse platform.',
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
        body: 'Planned changes are announced ahead of time and scheduled outside the primary reporting windows used by regional product teams.',
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
    title: 'Terms for using Pulse across approved digital properties.',
    description:
      'These terms summarize the operational expectations for using the Pulse workspace, APIs, reporting surfaces, and export capabilities.',
    cards: [
      { label: 'Eligible use', value: 'Approved properties', detail: 'Projects require an internal owner and declared business purpose.' },
      { label: 'Access model', value: 'Least privilege', detail: 'Workspace access should match role and reporting need.' },
      { label: 'Exports', value: 'Governed', detail: 'Downloaded data remains subject to internal policy.' },
    ],
    sections: [
      {
        title: 'Workspace use',
        body: 'Each project must have a named owner responsible for collection setup, event naming, and reviewing shared dashboards for accuracy.',
        bullets: ['Define a tracking plan before launch', 'Review access on a regular cadence', 'Use clear project naming and ownership'],
      },
      {
        title: 'Data handling',
        body: 'Teams exporting or distributing Pulse data remain responsible for using it in line with internal privacy and security requirements.',
        bullets: ['Limit exports to business need', 'Avoid re-identification attempts', 'Respect retention guidance for downstream files'],
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
      'Keep environment-specific endpoint configuration in one place so production and staging do not mix events during rollout validation.',
    ],
    code: {
      title: 'script tag',
      code: String.raw`<script
  defer
  src="https://cdn.pulse.continental.com/pulse.js"
  data-site="continental.com"
  data-collect="https://api.pulse.continental.com"
></script>`,
    },
  },
  {
    title: 'Project Setup',
    summary: 'Initialize a project and confirm the default collection mode.',
    body: [
      'Call init exactly once in the application shell. Set the project identifier, confirm the base endpoint, and disable debug mode in production environments.',
      'Pair setup with a lightweight tracking plan that documents the primary KPIs and the events that matter for launch readiness.',
    ],
    code: {
      title: 'project config',
      code: String.raw`window.pulse = window.pulse || [];

pulse.init({
  projectId: 'aegis',
  debug: false,
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
    bullets: ['Normalize route labels', 'Track route transitions explicitly for apps', 'Keep titles readable for business teams'],
  },
  {
    title: 'Custom Events',
    summary: 'Track product interactions that explain intent and adoption.',
    body: [
      'Use custom events sparingly and prefer clear verbs tied to business meaning. The best events describe actions like demo_opened, quote_requested, or file_downloaded.',
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
      'The script tag accepts data attributes for site and endpoint configuration. Keep those settings close to the deployment environment so they can be reviewed during rollout.',
      'Teams with multi-brand setups typically centralize script configuration in the site shell or server-side template layer rather than inside page modules.',
    ],
    code: {
      title: 'script configuration',
      code: String.raw`<script
  defer
  src="https://cdn.pulse.continental.com/pulse.js"
  data-site="aegis"
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
      'Previous release: Expanded project-level settings visibility and improved the docs coverage for SPA routing and consent mode.',
    ],
    bullets: ['Recent: alerting and report deep links', 'Earlier: docs expansion', 'Earlier: export queue improvements'],
  },
]

export interface ProjectSummary {
  slug: string
  name: string
  domain: string
  owner: string
  region: string
  status: string
  icon: 'shield' | 'chart' | 'bolt' | 'globe'
  note: string
}

export const projectDirectory: ProjectSummary[] = [
  {
    slug: 'aegis',
    name: 'Aegis',
    domain: 'https://aegis.continental.com',
    owner: 'Product Security',
    region: 'Global',
    status: 'Active',
    icon: 'shield',
    note: 'Highest growth this quarter with strong CTA performance on solution pages.',
  },
  {
    slug: 'contitech',
    name: 'ContiTech',
    domain: 'https://contitech.continental.com',
    owner: 'Industrial Solutions',
    region: 'EMEA',
    status: 'Active',
    icon: 'chart',
    note: 'Strong returning traffic from partner campaigns and product-sheet downloads.',
  },
  {
    slug: 'vdo-fleet',
    name: 'VDO Fleet',
    domain: 'https://fleet.vdo.com',
    owner: 'Fleet Services',
    region: 'Europe',
    status: 'Monitoring',
    icon: 'bolt',
    note: 'Focused on lead quality and conversion lift across mobile support journeys.',
  },
  {
    slug: 'contitrade',
    name: 'ContiTrade',
    domain: 'https://contitrade.continental.com',
    owner: 'Retail Operations',
    region: 'North America',
    status: 'Pilot',
    icon: 'globe',
    note: 'New rollout concentrating on appointment booking and store-location engagement.',
  },
]

export interface ProjectOverviewContent {
  metrics: MetricSnapshot[]
  rangePresets: RangePreset[]
  topPages: { label: string; value: string }[]
  referrers: { label: string; value: string }[]
  eventTable: { event: string; count: string }[]
  countryMix: { label: string; share: string }[]
}

export const projectOverviewBySlug: Record<string, ProjectOverviewContent> = {
  aegis: {
    metrics: [
      { label: 'Page Views', value: '1.28M', delta: '+14.2%', trend: [20, 23, 24, 22, 26, 29, 31] },
      { label: 'Unique Visitors', value: '456K', delta: '+9.1%', trend: [13, 15, 16, 14, 18, 20, 21] },
      { label: 'Avg. Engagement Time', value: '1m 56s', delta: '+7.4%', trend: [12, 12, 14, 15, 16, 17, 18] },
      { label: 'Bounce Rate', value: '38.7%', delta: '-2.8%', trend: [32, 31, 29, 28, 27, 25, 24] },
      { label: 'Live Visitors', value: '48', delta: 'Live', trend: [5, 6, 4, 8, 7, 9, 8], live: true },
    ],
    rangePresets: buildDemoRangePresets({
      sevenDaySeries: [
        { label: 'May 12', value: 55000 },
        { label: 'May 13', value: 89000 },
        { label: 'May 14', value: 72000 },
        { label: 'May 15', value: 108000 },
        { label: 'May 16', value: 94000 },
        { label: 'May 17', value: 121000 },
        { label: 'May 18', value: 138000 },
      ],
      thirtyDaySeries: [
        { label: 'Apr 19', value: 43000 },
        { label: 'Apr 24', value: 52000 },
        { label: 'Apr 29', value: 61000 },
        { label: 'May 04', value: 69000 },
        { label: 'May 09', value: 84000 },
        { label: 'May 14', value: 96000 },
        { label: 'May 18', value: 138000 },
      ],
      quarterToDateSeries: [
        { label: 'Mar', value: 310000 },
        { label: 'Late Mar', value: 364000 },
        { label: 'Apr', value: 412000 },
        { label: 'Late Apr', value: 458000 },
        { label: 'May', value: 521000 },
      ],
    }),
    topPages: [
      { label: '/overview', value: '285K' },
      { label: '/features', value: '210K' },
      { label: '/privacy', value: '178K' },
      { label: '/resources', value: '160K' },
      { label: '/contact', value: '96K' },
    ],
    referrers: [
      { label: 'google.com', value: '226K' },
      { label: 'continental.com', value: '109K' },
      { label: 'linkedin.com', value: '54K' },
      { label: 'direct / none', value: '41K' },
      { label: 'bing.com', value: '19K' },
    ],
    eventTable: [
      { event: 'page_view', count: '1.28M' },
      { event: 'button_click', count: '83K' },
      { event: 'form_submit', count: '6.2K' },
      { event: 'file_download', count: '4.1K' },
      { event: 'video_play', count: '2.7K' },
    ],
    countryMix: [
      { label: 'Germany', share: '42.3%' },
      { label: 'United States', share: '18.7%' },
      { label: 'France', share: '6.4%' },
      { label: 'Italy', share: '4.8%' },
      { label: 'Others', share: '27.8%' },
    ],
  },
  contitech: {
    metrics: [
      { label: 'Page Views', value: '642K', delta: '+9.6%', trend: [17, 18, 20, 19, 22, 24, 25] },
      { label: 'Unique Visitors', value: '210K', delta: '+6.2%', trend: [11, 12, 13, 13, 15, 16, 17] },
      { label: 'Avg. Engagement Time', value: '2m 08s', delta: '+4.1%', trend: [15, 15, 16, 17, 18, 18, 19] },
      { label: 'Bounce Rate', value: '41.4%', delta: '-1.7%', trend: [31, 31, 30, 29, 28, 28, 27] },
      { label: 'Live Visitors', value: '23', delta: 'Live', trend: [4, 5, 4, 6, 6, 7, 6], live: true },
    ],
    rangePresets: buildDemoRangePresets({
      sevenDaySeries: [
        { label: 'May 12', value: 24000 },
        { label: 'May 13', value: 31000 },
        { label: 'May 14', value: 28000 },
        { label: 'May 15', value: 36000 },
        { label: 'May 16', value: 34000 },
        { label: 'May 17', value: 41000 },
        { label: 'May 18', value: 46000 },
      ],
      thirtyDaySeries: [
        { label: 'Apr 19', value: 18000 },
        { label: 'Apr 24', value: 22000 },
        { label: 'Apr 29', value: 26000 },
        { label: 'May 04', value: 28000 },
        { label: 'May 09', value: 32000 },
        { label: 'May 14', value: 39000 },
        { label: 'May 18', value: 46000 },
      ],
      quarterToDateSeries: [
        { label: 'Mar', value: 144000 },
        { label: 'Late Mar', value: 166000 },
        { label: 'Apr', value: 194000 },
        { label: 'Late Apr', value: 221000 },
        { label: 'May', value: 253000 },
      ],
    }),
    topPages: [
      { label: '/hydraulics', value: '131K' },
      { label: '/products/e-belt', value: '104K' },
      { label: '/sustainability', value: '86K' },
      { label: '/contact', value: '62K' },
      { label: '/downloads', value: '49K' },
    ],
    referrers: [
      { label: 'google.com', value: '118K' },
      { label: 'partner.portal', value: '61K' },
      { label: 'continental.com', value: '49K' },
      { label: 'linkedin.com', value: '27K' },
      { label: 'direct / none', value: '21K' },
    ],
    eventTable: [
      { event: 'page_view', count: '642K' },
      { event: 'file_download', count: '31K' },
      { event: 'spec_opened', count: '19K' },
      { event: 'contact_request', count: '5.4K' },
      { event: 'video_play', count: '1.9K' },
    ],
    countryMix: [
      { label: 'Germany', share: '28.4%' },
      { label: 'France', share: '14.1%' },
      { label: 'United States', share: '12.8%' },
      { label: 'Italy', share: '6.7%' },
      { label: 'Others', share: '38.0%' },
    ],
  },
  'vdo-fleet': {
    metrics: [
      { label: 'Page Views', value: '312K', delta: '+11.2%', trend: [14, 15, 16, 18, 19, 21, 22] },
      { label: 'Unique Visitors', value: '104K', delta: '+8.3%', trend: [9, 9, 10, 11, 12, 13, 14] },
      { label: 'Avg. Engagement Time', value: '2m 21s', delta: '+5.8%', trend: [14, 15, 15, 16, 17, 18, 19] },
      { label: 'Bounce Rate', value: '36.2%', delta: '-4.6%', trend: [29, 28, 27, 26, 25, 24, 23] },
      { label: 'Live Visitors', value: '17', delta: 'Live', trend: [3, 4, 4, 5, 5, 6, 5], live: true },
    ],
    rangePresets: buildDemoRangePresets({
      sevenDaySeries: [
        { label: 'May 12', value: 11000 },
        { label: 'May 13', value: 14000 },
        { label: 'May 14', value: 16000 },
        { label: 'May 15', value: 21000 },
        { label: 'May 16', value: 24000 },
        { label: 'May 17', value: 26000 },
        { label: 'May 18', value: 29000 },
      ],
      thirtyDaySeries: [
        { label: 'Apr 19', value: 9000 },
        { label: 'Apr 24', value: 11000 },
        { label: 'Apr 29', value: 14000 },
        { label: 'May 04', value: 17000 },
        { label: 'May 09', value: 21000 },
        { label: 'May 14', value: 25000 },
        { label: 'May 18', value: 29000 },
      ],
      quarterToDateSeries: [
        { label: 'Mar', value: 72000 },
        { label: 'Late Mar', value: 81000 },
        { label: 'Apr', value: 96000 },
        { label: 'Late Apr', value: 112000 },
        { label: 'May', value: 134000 },
      ],
    }),
    topPages: [
      { label: '/fleet-dashboard', value: '76K' },
      { label: '/drivers-app', value: '58K' },
      { label: '/case-studies', value: '43K' },
      { label: '/contact', value: '37K' },
      { label: '/faq', value: '22K' },
    ],
    referrers: [
      { label: 'google.com', value: '49K' },
      { label: 'newsletter', value: '18K' },
      { label: 'fleet-partners', value: '14K' },
      { label: 'continental.com', value: '12K' },
      { label: 'direct / none', value: '11K' },
    ],
    eventTable: [
      { event: 'page_view', count: '312K' },
      { event: 'demo_opened', count: '18K' },
      { event: 'contact_request', count: '7.4K' },
      { event: 'video_play', count: '3.1K' },
      { event: 'file_download', count: '2.2K' },
    ],
    countryMix: [
      { label: 'Germany', share: '21.5%' },
      { label: 'United Kingdom', share: '11.2%' },
      { label: 'Spain', share: '9.3%' },
      { label: 'Italy', share: '7.0%' },
      { label: 'Others', share: '51.0%' },
    ],
  },
  contitrade: {
    metrics: [
      { label: 'Page Views', value: '158K', delta: '+18.7%', trend: [9, 10, 12, 13, 15, 17, 19] },
      { label: 'Unique Visitors', value: '57K', delta: '+13.4%', trend: [6, 7, 8, 8, 9, 10, 11] },
      { label: 'Avg. Engagement Time', value: '1m 34s', delta: '+3.6%', trend: [10, 10, 11, 12, 12, 13, 13] },
      { label: 'Bounce Rate', value: '44.8%', delta: '-2.2%', trend: [34, 33, 33, 31, 31, 30, 29] },
      { label: 'Live Visitors', value: '11', delta: 'Live', trend: [2, 3, 3, 4, 4, 5, 4], live: true },
    ],
    rangePresets: buildDemoRangePresets({
      sevenDaySeries: [
        { label: 'May 12', value: 6000 },
        { label: 'May 13', value: 7200 },
        { label: 'May 14', value: 8100 },
        { label: 'May 15', value: 9400 },
        { label: 'May 16', value: 10100 },
        { label: 'May 17', value: 11800 },
        { label: 'May 18', value: 13200 },
      ],
      thirtyDaySeries: [
        { label: 'Apr 19', value: 4200 },
        { label: 'Apr 24', value: 5100 },
        { label: 'Apr 29', value: 6200 },
        { label: 'May 04', value: 7600 },
        { label: 'May 09', value: 9100 },
        { label: 'May 14', value: 10800 },
        { label: 'May 18', value: 13200 },
      ],
      quarterToDateSeries: [
        { label: 'Mar', value: 34000 },
        { label: 'Late Mar', value: 39000 },
        { label: 'Apr', value: 47000 },
        { label: 'Late Apr', value: 56000 },
        { label: 'May', value: 68000 },
      ],
    }),
    topPages: [
      { label: '/store-locator', value: '39K' },
      { label: '/book-service', value: '31K' },
      { label: '/offers', value: '28K' },
      { label: '/winter-check', value: '22K' },
      { label: '/faq', value: '14K' },
    ],
    referrers: [
      { label: 'google.com', value: '24K' },
      { label: 'maps', value: '11K' },
      { label: 'campaign.sms', value: '8K' },
      { label: 'continental.com', value: '6K' },
      { label: 'direct / none', value: '5K' },
    ],
    eventTable: [
      { event: 'page_view', count: '158K' },
      { event: 'appointment_started', count: '9.1K' },
      { event: 'store_selected', count: '6.4K' },
      { event: 'coupon_download', count: '2.6K' },
      { event: 'form_submit', count: '1.3K' },
    ],
    countryMix: [
      { label: 'United States', share: '38.1%' },
      { label: 'Canada', share: '14.5%' },
      { label: 'Mexico', share: '10.2%' },
      { label: 'Germany', share: '6.1%' },
      { label: 'Others', share: '31.1%' },
    ],
  },
}

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
    metrics: [
      { label: 'Tracked pages', value: '186' },
      { label: 'Top landing pages', value: '24' },
      { label: 'Avg. exit rate', value: '28.4%' },
    ],
    rows: [
      { label: '/home', value: '428K', detail: 'Primary workspace entry point with strong repeat traffic.' },
      { label: '/projects/aegis', value: '315K', detail: 'High engagement from solution comparison flows.' },
      { label: '/solutions', value: '210K', detail: 'Top cross-project product discovery surface.' },
      { label: '/about', value: '180K', detail: 'Frequently paired with recruitment and brand campaigns.' },
      { label: '/contact', value: '142K', detail: 'High-intent traffic from lifecycle campaigns.' },
    ],
  },
  referrers: {
    title: 'Acquisition Sources',
    description: 'Understand which external and owned channels send the highest-value traffic into the portfolio.',
    metrics: [
      { label: 'Tracked referrers', value: '74' },
      { label: 'Owned share', value: '33.8%' },
      { label: 'Search-led visits', value: '412K' },
    ],
    rows: [
      { label: 'google.com', value: '412K', detail: 'Primary acquisition source across product discovery content.' },
      { label: 'continental.com', value: '198K', detail: 'Strong internal referral from corporate and portfolio navigation.' },
      { label: 'linkedin.com', value: '86K', detail: 'Campaign and recruitment support traffic.' },
      { label: 'direct / none', value: '74K', detail: 'Repeat users and direct navigation from known audiences.' },
      { label: 'bing.com', value: '41K', detail: 'Secondary search source with stable conversion intent.' },
    ],
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

export const alertRules = [
  {
    name: 'Traffic drop: Aegis hero landing',
    status: 'Active',
    owner: 'Aegis owner',
    trigger: 'Page views down more than 20% day-over-day',
  },
  {
    name: 'Export delay monitor',
    status: 'Watching',
    owner: 'Export owner',
    trigger: 'Weekly exports delayed more than 15 minutes',
  },
  {
    name: 'Consent mode mismatch',
    status: 'Active',
    owner: 'Workspace owner',
    trigger: 'Unexpected event volume after consent state changes',
  },
]

export const alertTimeline = [
  {
    when: formatTimelineLabel(0, '09:14'),
    title: 'Export delay monitor recovered',
    detail: 'Weekly export queue returned to normal delivery latency.',
  },
  {
    when: formatTimelineLabel(-1, '16:40'),
    title: 'Aegis landing page alert resolved',
    detail: 'Traffic dip traced to a temporary campaign pause.',
  },
  {
    when: formatTimelineLabel(-4, '08:20'),
    title: 'Consent mode mismatch reviewed',
    detail: 'Staging configuration updated after QA validation.',
  },
]

export const workspaceSettingsSections = [
  {
    title: 'Workspace access',
    body: 'Control who can view reports, manage alerts, invite members, and change retention settings across the workspace.',
    bullets: ['Workspace-scoped viewer, editor, and owner roles', 'Owners invite members and manage retention', 'Project-level permissions are out of scope for MVP'],
  },
  {
    title: 'Collection controls',
    body: 'Review endpoint configuration, consent handling, and event naming rules before expanding project coverage.',
    bullets: ['Project-level collection settings', 'Consent mode guidance', 'Event allowlists by project'],
  },
  {
    title: 'Export controls',
    body: 'Define who owns scheduled exports, who can trigger manual downloads, and how failures surface inside the product.',
    bullets: ['Editors and owners can trigger CSV exports', 'Owners manage scheduled PDF exports', 'Export failures raise in-app alerts'],
  },
]

export const projectConversionBySlug: Record<
  string,
  { label: string; value: string; detail: string; share: number }[]
> = {
  aegis: [
    { label: 'Demo request', value: '4.7%', detail: 'Hero CTA to request form completion', share: 74 },
    { label: 'Spec download', value: '3.3%', detail: 'Technical PDF downloads from product pages', share: 58 },
    { label: 'Newsletter opt-in', value: '1.8%', detail: 'Product and roadmap updates subscription', share: 32 },
  ],
  contitech: [
    { label: 'Contact request', value: '3.9%', detail: 'Contact form completion rate', share: 69 },
    { label: 'Asset download', value: '5.1%', detail: 'High-value product sheet delivery', share: 83 },
    { label: 'Sample request', value: '1.6%', detail: 'Qualified engineering inquiry submission', share: 29 },
  ],
  'vdo-fleet': [
    { label: 'Demo opened', value: '5.4%', detail: 'Fleet platform tour launch rate', share: 79 },
    { label: 'Contact request', value: '2.7%', detail: 'Contact flow completion after docs review', share: 44 },
    { label: 'App install', value: '1.9%', detail: 'Mobile app handoff from help pages', share: 31 },
  ],
  contitrade: [
    { label: 'Book service', value: '6.2%', detail: 'Appointment start from location and offer pages', share: 88 },
    { label: 'Coupon download', value: '3.4%', detail: 'Promotional asset retrieval', share: 52 },
    { label: 'Store call', value: '1.5%', detail: 'Click-to-call from store detail pages', share: 24 },
  ],
}

export const projectSettingsBySlug: Record<string, StaticPageSection[]> = {
  aegis: [
    {
      title: 'Collection profile',
      body: 'Aegis runs standard page and event collection with consent-aware configuration for comparison and brochure flows.',
      bullets: ['Project owner: Product Security', 'Retention: 13 months', 'Alerts enabled for campaign and export health'],
    },
    {
      title: 'Reporting defaults',
      body: 'Dashboard filters and exports are tuned for weekly launch reviews and monthly leadership reporting.',
      bullets: ['Default range: 7D', 'Primary market: Germany', 'Exports delivered every Monday 08:00 UTC'],
    },
  ],
  contitech: [
    {
      title: 'Collection profile',
      body: 'ContiTech prioritizes product content, file downloads, and partner-driven traffic analysis.',
      bullets: ['Project owner: Industrial Solutions', 'Retention: 12 months', 'Download events reviewed monthly'],
    },
    {
      title: 'Reporting defaults',
      body: 'Partner and search acquisition are surfaced first for the commercial content team.',
      bullets: ['Default range: 30D', 'Primary market: EMEA', 'Weekly export recipients include campaign owners'],
    },
  ],
  'vdo-fleet': [
    {
      title: 'Collection profile',
      body: 'VDO Fleet emphasizes demo and lead-flow validation across responsive application surfaces.',
      bullets: ['Project owner: Fleet Services', 'Retention: 12 months', 'Mobile route tracking enabled'],
    },
    {
      title: 'Reporting defaults',
      body: 'Mobile traffic and conversion-rate movement are emphasized in stakeholder exports.',
      bullets: ['Default range: 7D', 'Primary market: Europe', 'Alerts watch demo and contact flows'],
    },
  ],
  contitrade: [
    {
      title: 'Collection profile',
      body: 'ContiTrade is a pilot focused on appointment booking and local-store discovery.',
      bullets: ['Project owner: Retail Operations', 'Retention: 6 months', 'Store-locator interactions prioritized'],
    },
    {
      title: 'Reporting defaults',
      body: 'The pilot is tuned for launch validation and regional adoption monitoring.',
      bullets: ['Default range: 30D', 'Primary market: North America', 'Weekly reports shared with pilot owners'],
    },
  ],
}
