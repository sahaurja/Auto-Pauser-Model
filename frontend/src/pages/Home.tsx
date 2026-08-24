import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link2, MessageCircleQuestion, UploadCloud } from 'lucide-react'
import { NavBar } from '../components/NavBar'
import { HomeIllustration } from '../components/HomeIllustration'
import { isValidYouTubeUrl } from '../mock/mockData'

export function Home() {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [generateQuestions, setGenerateQuestions] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (!isValidYouTubeUrl(url)) {
      setError('Please enter a valid YouTube video URL.')
      return
    }

    setError(null)
    navigate('/loading', {
      state: { youtubeUrl: url.trim(), generateQuestions },
    })
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
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            {error && <p className="error-text">{error}</p>}
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

          <button type="submit" className="btn-primary">
            <UploadCloud size={20} />
            Submit
          </button>
        </form>
      </div>
    </>
  )
}
