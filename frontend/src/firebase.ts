import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

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

const app: FirebaseApp | null = isFirebaseConfigured ? initializeApp(firebaseConfig) : null

/**
 * `auth`/`db` are only initialized when real Firebase credentials are present
 * in .env.local. Without them, AuthContext and LibraryContext fall back to
 * mock in-memory auth / localStorage so the UI stays fully demoable before
 * Firebase is set up.
 */
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
