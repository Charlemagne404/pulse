import { useEffect } from 'react'
import { matchPath, useLocation } from 'react-router-dom'

const SITE_NAME = 'Pulse'
const SITE_ORIGIN = 'https://pulse.continental-hub.com'
const DEFAULT_TITLE = 'Pulse | Privacy-First Website Analytics'
const DEFAULT_DESCRIPTION =
  'Create a project, install one script, and understand your traffic with privacy-first analytics for websites and web apps.'
const DEFAULT_ROBOTS = 'index,follow,max-image-preview:large'
const DEFAULT_IMAGE_PATH = '/landing/hero-earth-network-v2.png'

interface SeoConfig {
  title: string
  description: string
  canonicalPath: string
  robots?: string
  pageType?: 'WebPage' | 'CollectionPage'
  structuredData?: Record<string, unknown>
}

function absoluteUrl(path: string) {
  return new URL(path, SITE_ORIGIN).toString()
}

function stripTrailingSlash(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }

  return pathname || '/'
}

function toTitleCase(value: string) {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function buildPageStructuredData(config: SeoConfig) {
  return {
    '@context': 'https://schema.org',
    '@type': config.pageType ?? 'WebPage',
    name: config.title,
    description: config.description,
    url: absoluteUrl(config.canonicalPath),
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_ORIGIN,
    },
    inLanguage: 'en',
  }
}

function buildHomeStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'Continental',
        url: SITE_ORIGIN,
      },
      {
        '@type': 'WebSite',
        name: SITE_NAME,
        url: SITE_ORIGIN,
        description: DEFAULT_DESCRIPTION,
        inLanguage: 'en',
        potentialAction: {
          '@type': 'SearchAction',
          target: `${SITE_ORIGIN}/docs/search?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'SoftwareApplication',
        name: SITE_NAME,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        url: SITE_ORIGIN,
        description: DEFAULT_DESCRIPTION,
      },
    ],
  }
}

function getSeoConfig(pathname: string, search: string): SeoConfig {
  const normalizedPath = stripTrailingSlash(pathname)
  const query = new URLSearchParams(search).get('q')?.trim()

  if (normalizedPath === '/') {
    return {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      canonicalPath: '/',
      structuredData: buildHomeStructuredData(),
    }
  }

  if (normalizedPath === '/docs') {
    return {
      title: 'Pulse Docs | Install the Script and Track Events',
      description:
        'Read the Pulse docs to install the script, validate page views, configure custom events, and keep analytics privacy-first.',
      canonicalPath: '/docs',
      pageType: 'CollectionPage',
    }
  }

  if (normalizedPath === '/docs/search') {
    const titleSuffix = query ? ` for "${query}"` : ''

    return {
      title: `Search Pulse Docs${titleSuffix} | Pulse`,
      description:
        'Search the Pulse documentation for installation, consent mode, SPA support, and event tracking guidance.',
      canonicalPath: '/docs/search',
      robots: 'noindex,follow',
      pageType: 'CollectionPage',
    }
  }

  if (normalizedPath === '/help') {
    return {
      title: 'Pulse Help | Validate Setup and Troubleshoot Analytics',
      description:
        'Use the Pulse help page to verify the script install, review privacy checks, and troubleshoot analytics collection issues.',
      canonicalPath: '/help',
    }
  }

  if (normalizedPath === '/privacy') {
    return {
      title: 'Pulse Privacy | What Pulse Collects and What It Avoids',
      description:
        'Review the Pulse privacy approach, including minimal collection defaults, consent-aware analytics, and what the product deliberately does not track.',
      canonicalPath: '/privacy',
    }
  }

  if (normalizedPath === '/legal/privacy') {
    return {
      title: 'Pulse Privacy | What Pulse Collects and What It Avoids',
      description:
        'Review the Pulse privacy approach, including minimal collection defaults, consent-aware analytics, and what the product deliberately does not track.',
      canonicalPath: '/privacy',
      robots: 'noindex,follow',
    }
  }

  if (normalizedPath === '/legal/imprint') {
    return {
      title: 'Pulse Imprint | Publisher and Contact Information',
      description:
        'Read the Pulse imprint for publishing information, the responsible entity, and the main contact route for the product.',
      canonicalPath: '/legal/imprint',
    }
  }

  if (normalizedPath === '/legal/terms') {
    return {
      title: 'Pulse Terms | Workspace Use and Data Handling',
      description:
        'Read the Pulse terms covering workspace use, access expectations, exports, and responsible handling of analytics data.',
      canonicalPath: '/legal/terms',
    }
  }

  if (normalizedPath === '/dashboard') {
    return {
      title: 'Pulse Dashboard',
      description: 'Open the Pulse dashboard to review traffic, events, and recent workspace activity.',
      canonicalPath: normalizedPath,
      robots: 'noindex,nofollow',
    }
  }

  if (normalizedPath === '/projects' || normalizedPath.startsWith('/projects/')) {
    const projectMatch = matchPath('/projects/:projectSlug/*', normalizedPath) ?? matchPath('/projects/:projectSlug', normalizedPath)
    const projectSlug = projectMatch?.params.projectSlug
    const projectLabel = projectSlug ? toTitleCase(projectSlug) : 'Projects'

    return {
      title: `${projectLabel} | Pulse`,
      description: 'Manage Pulse projects, review setup progress, and inspect page and event reporting.',
      canonicalPath: normalizedPath,
      robots: 'noindex,nofollow',
    }
  }

  if (normalizedPath === '/events') {
    return {
      title: 'Events | Pulse',
      description: 'Review and configure event tracking inside the Pulse workspace.',
      canonicalPath: normalizedPath,
      robots: 'noindex,nofollow',
    }
  }

  if (normalizedPath === '/reports' || normalizedPath.startsWith('/reports/')) {
    return {
      title: 'Reports | Pulse',
      description: 'View saved analytics reports and report details inside Pulse.',
      canonicalPath: normalizedPath,
      robots: 'noindex,nofollow',
    }
  }

  if (normalizedPath === '/alerts') {
    return {
      title: 'Alerts | Pulse',
      description: 'Review traffic and collection alerts inside the Pulse workspace.',
      canonicalPath: normalizedPath,
      robots: 'noindex,nofollow',
    }
  }

  if (normalizedPath === '/settings') {
    return {
      title: 'Settings | Pulse',
      description: 'Manage workspace and analytics settings inside Pulse.',
      canonicalPath: normalizedPath,
      robots: 'noindex,nofollow',
    }
  }

  return {
    title: '404 | Pulse',
    description: 'The requested Pulse page could not be found.',
    canonicalPath: normalizedPath,
    robots: 'noindex,nofollow',
  }
}

function upsertMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)

  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.append(element)
  }

  element.content = content
}

function upsertLink(rel: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)

  if (!element) {
    element = document.createElement('link')
    element.rel = rel
    document.head.append(element)
  }

  element.href = href
}

function upsertStructuredData(data: Record<string, unknown>) {
  const scriptId = 'pulse-structured-data'
  let element = document.head.querySelector<HTMLScriptElement>(`script#${scriptId}`)

  if (!element) {
    element = document.createElement('script')
    element.id = scriptId
    element.type = 'application/ld+json'
    document.head.append(element)
  }

  element.textContent = JSON.stringify(data)
}

export function SeoManager() {
  const location = useLocation()

  useEffect(() => {
    const config = getSeoConfig(location.pathname, location.search)
    const canonicalUrl = absoluteUrl(config.canonicalPath)
    const imageUrl = absoluteUrl(DEFAULT_IMAGE_PATH)
    const structuredData = config.structuredData ?? buildPageStructuredData(config)

    document.title = config.title

    upsertMeta('name', 'description', config.description)
    upsertMeta('name', 'robots', config.robots ?? DEFAULT_ROBOTS)
    upsertMeta('property', 'og:type', 'website')
    upsertMeta('property', 'og:site_name', SITE_NAME)
    upsertMeta('property', 'og:locale', 'en_US')
    upsertMeta('property', 'og:title', config.title)
    upsertMeta('property', 'og:description', config.description)
    upsertMeta('property', 'og:url', canonicalUrl)
    upsertMeta('property', 'og:image', imageUrl)
    upsertMeta('property', 'og:image:alt', 'Pulse analytics preview')
    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', config.title)
    upsertMeta('name', 'twitter:description', config.description)
    upsertMeta('name', 'twitter:image', imageUrl)
    upsertLink('canonical', canonicalUrl)
    upsertStructuredData(structuredData)
  }, [location.pathname, location.search])

  return null
}
