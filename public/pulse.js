(function installPulse(global) {
  'use strict'

  var script = global.document && global.document.currentScript
  var scriptData = script && script.dataset ? script.dataset : {}
  var queuedCommands = Array.isArray(global.pulse) ? global.pulse.slice() : []
  var memoryStorage = {}
  var fallbackStorage = {
    getItem: function (key) { return memoryStorage[key] || null },
    setItem: function (key, value) { memoryStorage[key] = String(value) },
  }
  var state = {
    initialized: false,
    projectId: '',
    collectUrl: scriptData.collect || '/v1/collect',
    consentState: 'unknown',
    consentMode: 'strict',
    sessionId: null,
    visitorKey: null,
  }

  var readStorage = function readStorage(storage, key) {
    try {
      return storage.getItem(key)
    } catch (error) {
      return memoryStorage[key] || null
    }
  }

  var writeStorage = function writeStorage(storage, key, value) {
    try {
      storage.setItem(key, value)
    } catch (error) {
      memoryStorage[key] = value
    }
  }

  var createId = function createId(prefix) {
    var uuid = global.crypto && typeof global.crypto.randomUUID === 'function'
      ? global.crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2)
    return prefix + '_' + uuid.replace(/[^a-zA-Z0-9_-]/g, '')
  }

  var getSessionId = function getSessionId() {
    if (state.sessionId) {
      return state.sessionId
    }

    var storage = global.sessionStorage || fallbackStorage
    var stored = readStorage(storage, 'pulse.sessionId')
    state.sessionId = stored || createId('session')
    writeStorage(storage, 'pulse.sessionId', state.sessionId)
    return state.sessionId
  }

  var getVisitorKey = function getVisitorKey() {
    if (state.visitorKey) {
      return state.visitorKey
    }

    var storage = global.localStorage || fallbackStorage
    var stored = readStorage(storage, 'pulse.visitorKey')
    var storedAt = Number(readStorage(storage, 'pulse.visitorKey.createdAt'))
    var isFresh = stored && Number.isFinite(storedAt) && Date.now() - storedAt < 24 * 60 * 60 * 1000
    state.visitorKey = isFresh ? stored : createId('visitor')
    writeStorage(storage, 'pulse.visitorKey', state.visitorKey)
    writeStorage(storage, 'pulse.visitorKey.createdAt', String(Date.now()))
    return state.visitorKey
  }

  var getDeviceType = function getDeviceType() {
    var userAgent = String((global.navigator && global.navigator.userAgent) || '').toLowerCase()
    if (/bot|crawler|spider|slurp/.test(userAgent)) {
      return 'bot'
    }
    if (/tablet|ipad/.test(userAgent)) {
      return 'tablet'
    }
    if (/mobile|android|iphone|ipod/.test(userAgent)) {
      return 'mobile'
    }
    return 'desktop'
  }

  var getBrowserName = function getBrowserName() {
    var userAgent = String((global.navigator && global.navigator.userAgent) || '')
    if (/Edg\//.test(userAgent)) return 'Edge'
    if (/Chrome\//.test(userAgent)) return 'Chrome'
    if (/Firefox\//.test(userAgent)) return 'Firefox'
    if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) return 'Safari'
    if (/MSIE|Trident\//.test(userAgent)) return 'Internet Explorer'
    return 'Unknown'
  }

  var send = function send(event) {
    if (!state.initialized || !state.projectId || state.consentState === 'denied') {
      return
    }

    var body = JSON.stringify({ events: [event] })
    if (global.navigator && typeof global.navigator.sendBeacon === 'function' && typeof global.Blob === 'function') {
      var sent = global.navigator.sendBeacon(state.collectUrl, new global.Blob([body], { type: 'application/json' }))
      if (sent) {
        return
      }
    }

    if (typeof global.fetch === 'function') {
      global.fetch(state.collectUrl, {
        method: 'POST',
        body: body,
        keepalive: true,
        headers: { 'content-type': 'application/json' },
      }).catch(function () {})
    }
  }

  var buildEvent = function buildEvent(eventName, payload, isPageView) {
    var page = payload && payload.page ? payload.page : payload || {}
    var properties = payload && payload.properties ? payload.properties : (!isPageView ? payload : undefined)
    var event = {
      eventId: createId('event'),
      eventName: eventName,
      occurredAt: new Date().toISOString(),
      projectId: state.projectId,
      page: {
        path: String(page.path || (global.location && (global.location.pathname + global.location.search)) || '/'),
        title: String(page.title || (global.document && global.document.title) || '').slice(0, 255) || undefined,
        referrer: page.referrer || (global.document && global.document.referrer) || undefined,
      },
      context: {
        deviceType: getDeviceType(),
        browserName: getBrowserName(),
        language: global.navigator && global.navigator.language ? global.navigator.language : undefined,
      },
      consent: {
        state: state.consentState,
        mode: state.consentMode,
      },
    }

    if (state.consentState === 'granted' && state.consentMode === 'standard') {
      event.identity = { sessionId: getSessionId(), visitorKey: getVisitorKey() }
    }

    if (!isPageView && properties && typeof properties === 'object' && !Array.isArray(properties)) {
      event.properties = properties
    }

    return event
  }

  var init = function init(config) {
    var options = config || {}
    state.initialized = true
    state.projectId = String(options.projectId || scriptData.project || '')
    state.collectUrl = String(options.collectUrl || scriptData.collect || state.collectUrl)
    state.consentMode = options.consentDefault === 'standard' ? 'standard' : 'strict'
    var requestedConsentState = options.consentState
    state.consentState = requestedConsentState === 'unknown' || requestedConsentState === 'denied' || requestedConsentState === 'granted'
      ? requestedConsentState
      : (state.consentMode === 'standard' ? 'granted' : 'unknown')
    if (state.consentState !== 'granted') {
      state.sessionId = null
      state.visitorKey = null
    }
    return api
  }

  var consent = function consent(nextState, mode) {
    var value = typeof nextState === 'object' && nextState ? nextState.state : nextState
    var nextMode = typeof nextState === 'object' && nextState ? nextState.mode : mode
    if (value !== 'unknown' && value !== 'denied' && value !== 'granted') {
      return api
    }
    state.consentState = value
    state.consentMode = nextMode === 'standard' && value === 'granted' ? 'standard' : 'strict'
    if (value !== 'granted') {
      state.sessionId = null
      state.visitorKey = null
    }
    return api
  }

  var page = function page(payload) {
    if (state.consentState === 'denied') return api
    send(buildEvent('page_view', payload || {}, true))
    return api
  }

  var track = function track(eventName, properties) {
    if (state.consentState !== 'granted' || state.consentMode !== 'standard') return api
    var name = String(eventName || '')
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(name)) return api
    send(buildEvent(name, properties || {}, false))
    return api
  }

  var api = { init: init, page: page, track: track, consent: consent }
  global.pulse = api

  queuedCommands.forEach(function (command) {
    if (!Array.isArray(command) || typeof api[command[0]] !== 'function') return
    api[command[0]].apply(api, command.slice(1))
  })
})(typeof window !== 'undefined' ? window : globalThis)
