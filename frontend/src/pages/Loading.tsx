import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { generateMockResult } from '../mock/mockData'
import { useLibrary } from '../context/LibraryContext'

interface LoadingState {
  youtubeUrl: string
  generateQuestions: boolean
}

export function Loading() {
  const location = useLocation()
  const navigate = useNavigate()
  const { addVideo } = useLibrary()
  const state = location.state as LoadingState | null

  useEffect(() => {
    if (!state?.youtubeUrl) {
      navigate('/home', { replace: true })
      return
    }

    const timer = setTimeout(() => {
      const result = generateMockResult(state.youtubeUrl, state.generateQuestions)
      addVideo(result)
      navigate('/video', { state: { videoId: result.videoId }, replace: true })
    }, 2200)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="loading-page">
      <div className="spinner" />
      <p>Finding the best moments to pause and generating questions...</p>
    </div>
  )
}
