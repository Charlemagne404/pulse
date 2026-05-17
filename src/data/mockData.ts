import { relabelRecentWeekSeries } from '../lib/demoDates'

export const landingPreviewMetrics = [
  { label: 'Page Views', value: '2.48M', delta: '+12.4%', trend: [22, 24, 28, 26, 31, 35, 38] },
  { label: 'Unique Visitors', value: '827K', delta: '+8.7%', trend: [12, 16, 14, 20, 19, 22, 24] },
  { label: 'Live Visitors', value: '126', delta: 'Live', trend: [8, 9, 7, 11, 10, 13, 12], live: true },
]

export const landingSeries = relabelRecentWeekSeries([
  { label: 'May 12', value: 58000 },
  { label: 'May 13', value: 77000 },
  { label: 'May 14', value: 104000 },
  { label: 'May 15', value: 92000 },
  { label: 'May 16', value: 118000 },
  { label: 'May 17', value: 137000 },
  { label: 'May 18', value: 151000 },
])

export const landingFeatureCards = [
  {
    title: 'Privacy by design',
    body: 'No cookies, no fingerprinting, IP data is anonymized and automatically rotated.',
  },
  {
    title: 'Reliable insights',
    body: 'Accurate, real-time analytics you can trust to make better decisions.',
  },
  {
    title: 'Lightweight & fast',
    body: 'A small script with modern collection and minimal impact on performance.',
  },
  {
    title: 'Minimal by default',
    body: 'EU-hosted, GDPR aligned, and built to keep collection intentionally narrow.',
  },
]

export const dashboardMetrics = [
  { label: 'Total Page Views', value: '2.48M', delta: '+12.4%', trend: [21, 26, 24, 29, 32, 35, 38] },
  { label: 'Unique Visitors', value: '827K', delta: '+8.7%', trend: [16, 15, 18, 20, 19, 23, 24] },
  { label: 'Live Visitors', value: '126', delta: 'Live', trend: [7, 9, 8, 11, 10, 13, 12], live: true },
  { label: 'Bounce Rate', value: '42.6%', delta: '-3.1%', trend: [34, 33, 32, 29, 28, 26, 25] },
  { label: 'Avg. Engagement Time', value: '1m 42s', delta: '+6.3%', trend: [12, 13, 14, 14, 15, 17, 18] },
]

export const dashboardSeries = relabelRecentWeekSeries([
  { label: 'May 12', value: 62000 },
  { label: 'May 13', value: 101000 },
  { label: 'May 14', value: 76000 },
  { label: 'May 15', value: 114000 },
  { label: 'May 16', value: 98000 },
  { label: 'May 17', value: 127000 },
  { label: 'May 18', value: 149000 },
])

export const dashboardTopProjects = [
  { name: 'Aegis', pageViews: '1.29M', uniqueVisitors: '456K', share: 100 },
  { name: 'ContiTech', pageViews: '642K', uniqueVisitors: '210K', share: 50 },
  { name: 'VDO Fleet', pageViews: '312K', uniqueVisitors: '104K', share: 24 },
  { name: 'ContiTrade', pageViews: '158K', uniqueVisitors: '57K', share: 12 },
  { name: 'Other Projects', pageViews: '88K', uniqueVisitors: '32K', share: 7 },
]

export const dashboardTopPages = [
  { label: '/home', value: '428K' },
  { label: '/projects/aegis', value: '315K' },
  { label: '/solutions', value: '210K' },
  { label: '/about', value: '180K' },
  { label: '/contact', value: '142K' },
]

export const dashboardReferrers = [
  { label: 'google.com', value: '412K' },
  { label: 'continental.com', value: '198K' },
  { label: 'linkedin.com', value: '86K' },
  { label: 'direct / none', value: '74K' },
  { label: 'bing.com', value: '41K' },
]

export const dashboardDeviceMix = [
  { label: 'Desktop', share: 58.3, color: '#d59c31' },
  { label: 'Mobile', share: 34.7, color: '#347fff' },
  { label: 'Tablet', share: 7, color: '#5c6c88' },
]

export const dashboardBrowserMix = [
  { label: 'Chrome', share: 54.2 },
  { label: 'Edge', share: 18.6 },
  { label: 'Safari', share: 15.1 },
  { label: 'Firefox', share: 7.4 },
  { label: 'Others', share: 4.7 },
]

export const recentEvents = [
  {
    time: '10:26:31',
    event: 'page_view',
    project: 'Aegis',
    location: '/solutions/aegis-overview',
    device: 'Desktop',
    browser: 'Chrome',
    country: 'DE',
  },
  {
    time: '10:24:18',
    event: 'button_click',
    project: 'Aegis',
    location: '/privacy',
    device: 'Mobile',
    browser: 'Safari',
    country: 'DE',
  },
  {
    time: '10:23:05',
    event: 'demo_opened',
    project: 'ContiTech',
    location: '/products/e-belt.pdf',
    device: 'Desktop',
    browser: 'Edge',
    country: 'FR',
  },
  {
    time: '10:21:52',
    event: 'form_submit',
    project: 'VDO Fleet',
    location: '/contact',
    device: 'Mobile',
    browser: 'Chrome',
    country: 'IT',
  },
  {
    time: '10:21:41',
    event: 'video_play',
    project: 'Aegis',
    location: '/media/product-intro',
    device: 'Desktop',
    browser: 'Firefox',
    country: 'ES',
  },
]

export const projectMetrics = [
  { label: 'Page Views', value: '1.28M', delta: '+14.2%', trend: [20, 23, 24, 22, 26, 29, 31] },
  { label: 'Unique Visitors', value: '456K', delta: '+9.1%', trend: [13, 15, 16, 14, 18, 20, 21] },
  { label: 'Avg. Engagement Time', value: '1m 56s', delta: '+7.4%', trend: [12, 12, 14, 15, 16, 17, 18] },
  { label: 'Bounce Rate', value: '38.7%', delta: '-2.8%', trend: [32, 31, 29, 28, 27, 25, 24] },
  { label: 'Live Visitors', value: '48', delta: 'Live', trend: [5, 6, 4, 8, 7, 9, 8], live: true },
]

export const projectSeries = relabelRecentWeekSeries([
  { label: 'May 12', value: 55000 },
  { label: 'May 13', value: 89000 },
  { label: 'May 14', value: 72000 },
  { label: 'May 15', value: 108000 },
  { label: 'May 16', value: 94000 },
  { label: 'May 17', value: 121000 },
  { label: 'May 18', value: 138000 },
])

export const projectTopPages = [
  { label: '/overview', value: '285K' },
  { label: '/features', value: '210K' },
  { label: '/privacy', value: '178K' },
  { label: '/resources', value: '160K' },
  { label: '/contact', value: '96K' },
]

export const projectReferrers = [
  { label: 'google.com', value: '226K' },
  { label: 'continental.com', value: '109K' },
  { label: 'linkedin.com', value: '54K' },
  { label: 'direct / none', value: '41K' },
  { label: 'bing.com', value: '19K' },
]

export const projectEventTable = [
  { event: 'page_view', count: '1.28M' },
  { event: 'button_click', count: '83K' },
  { event: 'form_submit', count: '6.2K' },
  { event: 'download', count: '4.1K' },
  { event: 'video_play', count: '2.7K' },
]

export const projectCountryMix = [
  { label: 'Germany', share: '42.3%' },
  { label: 'United States', share: '18.7%' },
  { label: 'France', share: '6.4%' },
  { label: 'Italy', share: '4.8%' },
  { label: 'Others', share: '27.8%' },
]

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

export const docsOnThisPage = [
  'Install the tracking script',
  'Initialize your project',
  'Track a custom event',
  "What's next?",
]

export const docsSnippets = {
  install: String.raw`<script
  defer
  src="https://cdn.pulse.continental.com/pulse.js"
  data-site="continental.com"
  data-collect="https://api.pulse.continental.com"
></script>`,
  init: String.raw`window.pulse = window.pulse || [];

pulse.init({
  projectId: 'aegis',
  debug: false,
});`,
  event: String.raw`pulse.track('button_click', {
  button: 'learn_more',
  location: 'hero',
});`,
}
