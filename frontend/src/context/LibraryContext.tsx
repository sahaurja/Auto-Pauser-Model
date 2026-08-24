import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { ProcessedVideo, ProcessedVideoData } from '../types'
import { mockVideos } from '../mock/mockData'
import { useAuth } from './AuthContext'

interface LibraryContextValue {
  videos: ProcessedVideo[]
  addVideo: (video: ProcessedVideoData) => void
  getVideo: (videoId: string) => ProcessedVideo | undefined
}

const LibraryContext = createContext<LibraryContextValue | undefined>(undefined)

const STORAGE_KEY = 'cadence_library'

/** userId -> that user's processed videos, persisted so a refresh keeps it. */
type LibraryStore = Record<string, ProcessedVideo[]>

function loadStore(): LibraryStore {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as LibraryStore
  } catch {
    return {}
  }
}

function saveStore(store: LibraryStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.uid ?? null
  const [store, setStore] = useState<LibraryStore>(() => loadStore())

  // First time a given user is seen, seed their library with the mock
  // catalog so the app stays demoable. Later videos they process are added
  // on top of that. Each user's list is stored independently.
  useEffect(() => {
    if (!userId) return

    setStore((prev) => {
      if (prev[userId]) return prev
      const seeded: LibraryStore = {
        ...prev,
        [userId]: mockVideos.map((video) => ({ ...video, userId })),
      }
      saveStore(seeded)
      return seeded
    })
  }, [userId])

  const videos = userId ? (store[userId] ?? []) : []

  const addVideo = (video: ProcessedVideoData) => {
    if (!userId) return
    setStore((prev) => {
      const next: LibraryStore = {
        ...prev,
        [userId]: [{ ...video, userId }, ...(prev[userId] ?? [])],
      }
      saveStore(next)
      return next
    })
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
