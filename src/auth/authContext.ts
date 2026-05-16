import { createContext } from 'react'
import type { ContinentalIdUser } from '../lib/continentalId'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface AuthContextValue {
  status: AuthStatus
  isAuthenticated: boolean
  user: ContinentalIdUser | null
  userInitials: string
  errorMessage: string
  signIn: (redirectTo?: string) => void
  signInFullPage: (redirectTo?: string) => void
  signOut: () => Promise<void>
  refreshSession: () => Promise<boolean>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
