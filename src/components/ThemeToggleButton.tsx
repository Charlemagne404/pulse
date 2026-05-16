import { useEffect, useState } from 'react'
import { AppIcon } from './Icon'

type ThemeName = 'dark' | 'light'

const THEME_STORAGE_KEY = 'pulse-theme'

function getPreferredTheme(): ThemeName {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)

  if (storedTheme === 'dark' || storedTheme === 'light') {
    return storedTheme
  }

  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function ThemeToggleButton() {
  const [theme, setTheme] = useState<ThemeName>(() => getPreferredTheme())

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      className="icon-button"
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
      onClick={() => setTheme(nextTheme)}
    >
      <AppIcon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  )
}
