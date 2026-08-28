import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLibrary } from '../context/LibraryContext'
import { getProcessingResult, getProcessingStatus } from '../api/backend'
import { TeddyBear } from '../components/TeddyBear'

interface LoadingState {
  jobId: string
  generateQuestions?: boolean
}

const POLL_INTERVAL_MS = 4000

export function Loading() {
  const location = useLocation()
  const navigate = useNavigate()
  const { addVideo } = useLibrary()
  const state = location.state as LoadingState | null
  const [error, setError] = useState<string | null>(null)
  const [duplicateVideoId, setDuplicateVideoId] = useState<string | null>(null)

  useEffect(() => {
    if (!state?.jobId) {
      navigate('/home', { replace: true })
      return
    }

    const jobId = state.jobId
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const poll = async () => {
      try {
        const statusResult = await getProcessingStatus(jobId)
        if (cancelled) return

        if (statusResult.status === 'error') {
          setError(
            statusResult.error ?? 'Something went wrong while processing this video.',
          )
          return
        }

        if (statusResult.status === 'done') {
          const result = await getProcessingResult(jobId)
          if (cancelled) return
          const { video, isDuplicate } = addVideo(result)
          if (isDuplicate) {
            setDuplicateVideoId(video.videoId)
            return
          }
          navigate('/video', { state: { videoId: video.videoId }, replace: true })
          return
        }

        timer = setTimeout(poll, POLL_INTERVAL_MS)
      } catch {
        if (!cancelled) {
          setError('Lost connection to the processing service.')
        }
      }
    }

    poll()

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) {
    return (
      <div className="loading-page">
        <p className="error-text">{error}</p>
        <button
          className="btn-primary"
          onClick={() => navigate('/home', { replace: true })}
        >
          Back to Home
        </button>
      </div>
    )
  }

  if (duplicateVideoId) {
    return (
      <div className="loading-page">
        <p>This video is already in your library.</p>
        <button
          className="btn-primary"
          onClick={() =>
            navigate('/video', { state: { videoId: duplicateVideoId }, replace: true })
          }
        >
          View video
        </button>
      </div>
    )
  }

  return (
    <div className="loading-page">
      <TeddyBear pose="reading" size={140} animated />
      <p>
        Finding the best moments to pause
        {state?.generateQuestions !== false ? ' and generating questions' : ''}...
      </p>
    </div>
  )
}
