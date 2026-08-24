import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { auth, isFirebaseConfigured } from '../firebase'

export interface AppUser {
  uid: string
  email: string | null
}

interface AuthContextValue {
  user: AppUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const MOCK_SESSION_KEY = 'cadence_mock_session'

/** Deterministic stand-in for a Firebase uid, scoped to mock auth only. */
const mockUid = (email: string) => `mock:${email.trim().toLowerCase()}`

/**
 * Mock auth used only when Firebase hasn't been configured yet (see
 * .env.example / firebase.ts). Accepts any email/password so the rest of the
 * app stays fully demoable without a real Firebase project. Once real
 * Firebase credentials are added, this branch is never used.
 */
function useMockAuth(): AuthContextValue {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(MOCK_SESSION_KEY)
    setUser(stored ? { uid: mockUid(stored), email: stored } : null)
    setLoading(false)
  }, [])

  const login = async (email: string) => {
    localStorage.setItem(MOCK_SESSION_KEY, email)
    setUser({ uid: mockUid(email), email })
  }

  const signUp = async (email: string) => {
    localStorage.setItem(MOCK_SESSION_KEY, email)
    setUser({ uid: mockUid(email), email })
  }

  const logout = async () => {
    localStorage.removeItem(MOCK_SESSION_KEY)
    setUser(null)
  }

  const resetPassword = async () => {
    throw new Error(
      'Password reset requires a real Firebase project. Add your Firebase config to .env.local to enable this.',
    )
  }

  return { user, loading, login, signUp, logout, resetPassword }
}

function useFirebaseAuth(): AuthContextValue {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth!, (firebaseUser) => {
      setUser(firebaseUser ? { uid: firebaseUser.uid, email: firebaseUser.email } : null)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth!, email, password)
  }

  const signUp = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth!, email, password)
  }

  const logout = async () => {
    await signOut(auth!)
  }

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth!, email)
  }

  return { user, loading, login, signUp, logout, resetPassword }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const value = isFirebaseConfigured ? useFirebaseAuth() : useMockAuth()

  if (!isFirebaseConfigured && typeof window !== 'undefined') {
    console.warn(
      '[Cadence] Firebase is not configured — using mock in-memory auth. ' +
        'See .env.example for the variables to set in .env.local.',
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
