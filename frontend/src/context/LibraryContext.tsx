import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore'
import type { ProcessedVideo, ProcessedVideoData } from '../types'
import { useAuth } from './AuthContext'
import { db, isFirebaseConfigured } from '../firebase'

export interface AddVideoResult {
  video: ProcessedVideo
  isDuplicate: boolean
}

interface LibraryContextValue {
  videos: ProcessedVideo[]
  addVideo: (video: ProcessedVideoData) => AddVideoResult
  getVideo: (videoId: string) => ProcessedVideo | undefined
}

const LibraryContext = createContext<LibraryContextValue | undefined>(undefined)

const STORAGE_KEY = 'cadence_library'

/** userId -> that user's processed videos. Only used by the localStorage
 * fallback path (no Firebase project configured — see firebase.ts). */
type LibraryStore = Record<string, ProcessedVideo[]>

function loadLocalStore(): LibraryStore {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as LibraryStore
  } catch {
    return {}
  }
}

function saveLocalStore(store: LibraryStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

function withoutDuplicate(videos: ProcessedVideo[], videoId: string) {
  return videos.filter((v) => v.videoId !== videoId)
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.uid ?? null
  const [videos, setVideos] = useState<ProcessedVideo[]>([])

  // Firestore-backed path — used whenever a real Firebase project is
  // configured. Library lives at users/{userId}/videos/{videoId}, so it
  // syncs across devices/browsers for that user instead of being stuck in
  // one browser's localStorage.
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return

    if (!userId) {
      setVideos([])
      return
    }

    let cancelled = false
    const firestore = db

    const load = async () => {
      const videosRef = collection(firestore, 'users', userId, 'videos')
      const snapshot = await getDocs(query(videosRef, orderBy('processedDate', 'desc')))
      if (cancelled) return

      setVideos(
        snapshot.docs.map((d) => ({ ...(d.data() as ProcessedVideoData), userId })),
      )
    }

    load().catch((err) => {
      console.error('[Cadence] Failed to load library from Firestore', err)
    })

    return () => {
      cancelled = true
    }
  }, [userId])

  // localStorage fallback — only runs when Firebase hasn't been configured
  // (mock auth mode, see AuthContext), so the app stays demoable without a
  // real Firebase project.
  useEffect(() => {
    if (isFirebaseConfigured) return

    if (!userId) {
      setVideos([])
      return
    }

    const store = loadLocalStore()
    setVideos(store[userId] ?? [])
  }, [userId])

  // A video is a duplicate if this user already has it, matched by YouTube
  // video ID (covers different URL formats for the same video) or the raw
  // URL as a fallback.
  const addVideo = (video: ProcessedVideoData): AddVideoResult => {
    if (!userId) {
      return { video: { ...video, userId: '' }, isDuplicate: false }
    }

    const existing = videos.find(
      (v) => v.videoId === video.videoId || v.youtubeUrl === video.youtubeUrl,
    )
    if (existing) {
      return { video: existing, isDuplicate: true }
    }

    const withUser: ProcessedVideo = { ...video, userId }

    // Optimistic local update so getVideo() finds it immediately, without
    // waiting on a Firestore round-trip.
    setVideos((prev) => [withUser, ...withoutDuplicate(prev, video.videoId)])

    if (isFirebaseConfigured && db) {
      setDoc(doc(db, 'users', userId, 'videos', video.videoId), video).catch((err) => {
        console.error('[Cadence] Failed to save video to Firestore', err)
      })
    } else {
      const store = loadLocalStore()
      const next: LibraryStore = {
        ...store,
        [userId]: [withUser, ...withoutDuplicate(store[userId] ?? [], video.videoId)],
      }
      saveLocalStore(next)
    }

    return { video: withUser, isDuplicate: false }
  }

  const getVideo = (videoId: string) => videos.find((v) => v.videoId === videoId)

  return (
    <LibraryContext.Provider value={{ videos, addVideo, getVideo }}>
      {children}
    </LibraryContext.Provider>
  )
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext)
  if (!ctx) throw new Error('useLibrary must be used within a LibraryProvider')
  return ctx
}
