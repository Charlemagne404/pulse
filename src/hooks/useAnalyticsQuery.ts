import { startTransition, useEffect, useEffectEvent, useState } from 'react'

interface AnalyticsQueryState<T> {
  data: T | null
  error: string
  resolvedKey: string
}

const INITIAL_STATE = {
  data: null,
  error: '',
  resolvedKey: '',
} as const

export function useAnalyticsQuery<T>(requestKey: string, load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<AnalyticsQueryState<T>>(INITIAL_STATE)
  const loadEvent = useEffectEvent(load)

  useEffect(() => {
    const controller = new AbortController()

    void loadEvent(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) {
          return
        }

        startTransition(() => {
          setState({
            data,
            error: '',
            resolvedKey: requestKey,
          })
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        const message = error instanceof Error ? error.message : 'Could not load analytics.'

        startTransition(() => {
          setState((current) => ({
            data: current.data,
            error: message,
            resolvedKey: requestKey,
          }))
        })
      })

    return () => controller.abort()
  }, [requestKey])

  const isResolved = state.resolvedKey === requestKey

  return {
    data: state.data,
    error: isResolved ? state.error : '',
    isLoading: state.data === null && !isResolved,
    isRefreshing: state.data !== null && !isResolved,
  }
}
