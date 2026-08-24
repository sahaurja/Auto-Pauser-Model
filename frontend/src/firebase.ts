import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

/**
 * PLACEHOLDER CONFIG — do not hardcode real values here.
 * All values come from Vite env vars defined in .env.local (see .env.example).
 * See the setup summary printed at the end of the build for how to obtain
 * these from the Firebase console.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey)

/**
 * `auth` is only initialized when real Firebase credentials are present in
 * .env.local. Without them, AuthContext falls back to a mock in-memory auth
 * implementation so the UI stays fully demoable before Firebase is set up.
 */
export const auth = isFirebaseConfigured ? getAuth(initializeApp(firebaseConfig)) : null
