import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

const sdkSource = await readFile(new URL('../public/pulse.js', import.meta.url), 'utf8')

const createStorage = () => {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  }
}

const createBrowser = (queuedCommands = []) => {
  const requests = []
  const browser = {
    pulse: queuedCommands,
    document: {
      currentScript: {
        dataset: { project: 'demo-site', collect: '/v1/collect' },
      },
      title: 'Demo page',
      referrer: 'https://search.example/',
    },
    location: { pathname: '/pricing', search: '' },
    navigator: {
      userAgent: 'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36',
      language: 'en-US',
    },
    sessionStorage: createStorage(),
    localStorage: createStorage(),
    crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000001' },
    fetch: async (url, options) => {
      requests.push({ url, options })
      return { ok: true }
    },
  }

  vm.runInNewContext(sdkSource, { window: browser })
  return { browser, requests }
}

const readRequestEvent = (request) => JSON.parse(request.options.body).events[0]

test('browser SDK queues initialization and sends strict page views without identity', async () => {
  const { browser, requests } = createBrowser([
    ['init', { projectId: 'demo-site', consentDefault: 'strict' }],
  ])

  browser.pulse.page()
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(requests.length, 1)
  const event = readRequestEvent(requests[0])
  assert.equal(requests[0].url, '/v1/collect')
  assert.equal(event.eventName, 'page_view')
  assert.equal(event.projectId, 'demo-site')
  assert.deepEqual(event.consent, { state: 'unknown', mode: 'strict' })
  assert.equal('identity' in event, false)

  browser.pulse.track('button_click', { button: 'learn_more' })
  assert.equal(requests.length, 1)
})

test('browser SDK enables anonymous identity only after granted standard consent', async () => {
  const { browser, requests } = createBrowser([
    ['init', { projectId: 'demo-site', consentDefault: 'strict' }],
  ])

  browser.pulse.consent('granted', 'standard')
  browser.pulse.track('button_click', { button: 'learn_more' })
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(requests.length, 1)
  const event = readRequestEvent(requests[0])
  assert.deepEqual(event.consent, { state: 'granted', mode: 'standard' })
  assert.deepEqual(event.identity, {
    sessionId: 'session_00000000-0000-4000-8000-000000000001',
    visitorKey: 'visitor_00000000-0000-4000-8000-000000000001',
  })
})

test('browser SDK stops collection when consent is denied', async () => {
  const { browser, requests } = createBrowser([
    ['init', { projectId: 'demo-site', consentDefault: 'standard' }],
  ])

  browser.pulse.consent('denied')
  browser.pulse.page()
  browser.pulse.track('button_click', { button: 'learn_more' })
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(requests.length, 0)
})
