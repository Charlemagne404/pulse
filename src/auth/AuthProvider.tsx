import type { ReactNode } from 'react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { AuthContext } from './authContext'
import {
  buildContinentalLoginUrl,
  describeContinentalError,
  fetchContinentalUser,
  getUserInitials,
  isTrustedContinentalMessageOrigin,
  logoutContinentalSession,
  rememberContinentalApiBaseUrl,
  refreshContinentalSession,
  stripContinentalAuthParams,
} from '../lib/continentalId'
import type { AuthStatus } from './authContext'
import type { ContinentalIdUser } from '../lib/continentalId'

const REFRESH_INTERVAL_MS = 10 * 60 * 1000

const openCenteredPopup = (url: string, existingWindow: Window | null) => {
  const width = 860
  const height = 780
  const left = window.screenX + (window.outerWidth - width) / 2
  const top = window.screenY + (window.outerHeight - height) / 2

  if (existingWindow && !existingWindow.closed) {
    existingWindow.focus()
    return existingWindow
  }

  return window.open(
    url,
    'PulseLoginPopup',
    [
      'popup=yes',
      `width=${width}`,
      `height=${height}`,
      `top=${Math.max(top, 0)}`,
      `left=${Math.max(left, 0)}`,
      'resizable=yes',
      'scrollbars=yes',
    ].join(',')
  )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<ContinentalIdUser | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const accessTokenRef = useRef('')
  const popupWindowRef = useRef<Window | null>(null)
  const refreshTaskRef = useRef<Promise<boolean> | null>(null)
  const statusRef = useRef<AuthStatus>('loading')

  useEffect(() => {
    statusRef.current = status
  }, [status])

  const closePopup = () => {
    if (popupWindowRef.current && !popupWindowRef.current.closed) {
      popupWindowRef.current.close()
    }

    popupWindowRef.current = null
  }

  const setSignedOut = (message = '') => {
    accessTokenRef.current = ''
    setUser(null)
    setStatus('unauthenticated')
    setErrorMessage(message)
  }

  const refreshSession = async () => {
    if (refreshTaskRef.current) {
      return refreshTaskRef.current
    }

    const task = (async () => {
      try {
        const refreshed = await refreshContinentalSession()
        if (!refreshed.authenticated) {
          setSignedOut(refreshed.message)
          return false
        }

        accessTokenRef.current = refreshed.accessToken
        const nextUser = await fetchContinentalUser(refreshed.accessToken)
        setUser(nextUser)
        setStatus('authenticated')
        setErrorMessage('')
        closePopup()
        return true
      } catch (error) {
        const message = describeContinentalError(
          error,
          'Could not reach the Continental ID service from Pulse.'
        )

        if (statusRef.current === 'authenticated') {
          setErrorMessage(message)
          return false
        }

        setSignedOut(message)
        return false
      } finally {
        refreshTaskRef.current = null
      }
    })()

    refreshTaskRef.current = task
    return task
  }

  const signInFullPage = (redirectTo = window.location.href) => {
    window.location.assign(buildContinentalLoginUrl(redirectTo))
  }

  const signIn = (redirectTo = window.location.href) => {
    const popup = openCenteredPopup(buildContinentalLoginUrl(redirectTo), popupWindowRef.current)
    if (popup) {
      popupWindowRef.current = popup
      if (statusRef.current !== 'authenticated') {
        setErrorMessage('Finish signing in with Continental ID in the popup window.')
      }
      return
    }

    signInFullPage(redirectTo)
  }

  const signOut = async () => {
    try {
      await logoutContinentalSession()
    } catch {
      // Clear local state even when the remote logout endpoint is unavailable.
    }

    closePopup()
    setSignedOut('')
  }

  const refreshSessionEvent = useEffectEvent(async () => refreshSession())
  const completePopupLoginEvent = useEffectEvent(
    async (payload: { accessToken?: unknown; token?: unknown; apiBaseUrl?: unknown }) => {
      const accessToken =
        typeof payload.accessToken === 'string'
          ? payload.accessToken
          : typeof payload.token === 'string'
            ? payload.token
            : ''
      const trimmedToken = accessToken.trim()
      const messageApiBase = typeof payload.apiBaseUrl === 'string' ? payload.apiBaseUrl : ''

      if (messageApiBase) {
        rememberContinentalApiBaseUrl(messageApiBase)
      }

      if (trimmedToken) {
        try {
          accessTokenRef.current = trimmedToken
          const nextUser = await fetchContinentalUser(trimmedToken)
          setUser(nextUser)
          setStatus('authenticated')
          setErrorMessage('')
          closePopup()
          return
        } catch {
          // Fall back to the refresh-cookie flow when the popup token cannot finish sign-in alone.
        }
      }

      await refreshSession()
    }
  )

  useEffect(() => {
    stripContinentalAuthParams()
    void refreshSessionEvent()
  }, [])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!isTrustedContinentalMessageOrigin(event.origin)) {
        return
      }

      if (event.data?.type !== 'LOGIN_SUCCESS') {
        return
      }

      void completePopupLoginEvent(event.data)
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') {
      return
    }

    const timerId = window.setInterval(() => {
      void refreshSessionEvent()
    }, REFRESH_INTERVAL_MS)

    return () => window.clearInterval(timerId)
  }, [status])

  return (
    <AuthContext.Provider
      value={{
        status,
        isAuthenticated: status === 'authenticated',
        user,
        userInitials: getUserInitials(user),
        errorMessage,
        signIn,
        signInFullPage,
        signOut,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
