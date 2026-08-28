import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link2, MessageCircleQuestion, UploadCloud } from 'lucide-react'
import { NavBar } from '../components/NavBar'
import { HomeIllustration } from '../components/HomeIllustration'
import { extractYouTubeId, isValidYouTubeUrl } from '../mock/mockData'
import { startProcessing } from '../api/backend'
import { useLibrary } from '../context/LibraryContext'

export function Home() {
  const navigate = useNavigate()
  const { videos } = useLibrary()
  const [url, setUrl] = useState('')
  const [generateQuestions, setGenerateQuestions] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [duplicateVideoId, setDuplicateVideoId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmedUrl = url.trim()

    if (!isValidYouTubeUrl(trimmedUrl)) {
      setDuplicateVideoId(null)
      setError('Please enter a valid YouTube video URL.')
      return
    }

    // Check the library immediately, before kicking off a (possibly slow)
    // processing job, so a resubmitted video gets instant feedback instead
    // of only being caught once processing finishes.
    const videoId = extractYouTubeId(trimmedUrl)
    const existing = videos.find(
      (v) => v.videoId === videoId || v.youtubeUrl === trimmedUrl,
    )
    if (existing) {
      setDuplicateVideoId(existing.videoId)
      setError('This video is already in your library.')
      return
    }

    setError(null)
    setDuplicateVideoId(null)
    setSubmitting(true)
    try {
      const { jobId } = await startProcessing(trimmedUrl, generateQuestions)
      navigate('/loading', { state: { jobId, generateQuestions } })
    } catch {
      setError('Could not reach the processing service. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <>
      <NavBar />
      <div className="page-content">
        <section className="hero">
          <div className="hero-text">
            <h1 className="hero-title">What Cadence does</h1>
            <p className="hero-subtitle">
              Cadence watches educational videos on your behalf and figures out
              where a learner is most likely to need a moment to think. It
              automatically pauses playback at those points, and — if you opt
              in — asks a short comprehension question to check understanding
              before the video continues.
            </p>
          </div>
          <HomeIllustration />
        </section>

        <form className="home-form card" onSubmit={handleSubmit}>
          <h2>Process a new video</h2>

          <div className="auth-field">
            <label htmlFor="youtubeUrl">YouTube video URL</label>
            <div className="input-with-icon">
              <Link2 size={20} className="input-icon" />
              <input
                id="youtubeUrl"
                type="text"
                className="text-field"
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setError(null)
                  setDuplicateVideoId(null)
                }}
              />
            </div>
            {error && <p className="error-text">{error}</p>}
            {duplicateVideoId && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate('/video', { state: { videoId: duplicateVideoId } })}
              >
                View video
              </button>
            )}
          </div>

          <div className="home-toggle-row">
            <span className="home-toggle-label">
              <MessageCircleQuestion size={20} />
              Generate questions
            </span>
            <div className="toggle">
              <button
                type="button"
                className={generateQuestions ? 'active' : ''}
                onClick={() => setGenerateQuestions(true)}
              >
                Yes
              </button>
              <button
                type="button"
                className={!generateQuestions ? 'active' : ''}
                onClick={() => setGenerateQuestions(false)}
              >
                No
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={submitting}>
            <UploadCloud size={20} />
            {submitting ? 'Starting…' : 'Submit'}
          </button>
        </form>
      </div>
    </>
  )
}
