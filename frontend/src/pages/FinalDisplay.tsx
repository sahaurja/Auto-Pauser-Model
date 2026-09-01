import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import YouTube, { type YouTubePlayer, type YouTubeProps } from 'react-youtube'
import { Play } from 'lucide-react'
import { NavBar } from '../components/NavBar'
import { QuestionModal } from '../components/QuestionModal'
import { QuestionSummaryModal, type QuestionResult } from '../components/QuestionSummaryModal'
import { useLibrary } from '../context/LibraryContext'

interface VideoLocationState {
  videoId: string
}

export function FinalDisplay() {
  const location = useLocation()
  const navigate = useNavigate()
  const { getVideo } = useLibrary()

  const state = location.state as VideoLocationState | null
  const video = state?.videoId ? getVideo(state.videoId) : undefined

  const playerRef = useRef<YouTubePlayer | null>(null)
  const playerContainerRef = useRef<HTMLDivElement | null>(null)
  const [duration, setDuration] = useState(0)
  const [triggeredIndices, setTriggeredIndices] = useState<Set<number>>(new Set())
  const [passedIndices, setPassedIndices] = useState<Set<number>>(new Set())
  const [activePauseIndex, setActivePauseIndex] = useState<number | null>(null)
  const [answersByPauseIndex, setAnswersByPauseIndex] = useState<Record<number, number>>({})
  const [videoEnded, setVideoEnded] = useState(false)

  // Every pause point stops playback when its timestamp is reached, whether
  // or not it carries a question — only the popup is conditional on that.
  useEffect(() => {
    if (!video) return

    const interval = setInterval(() => {
      const player = playerRef.current
      if (!player || activePauseIndex !== null) return

      const currentTime = player.getCurrentTime?.()
      if (currentTime === undefined) return

      for (let index = 0; index < video.pausePoints.length; index += 1) {
        if (triggeredIndices.has(index)) continue
        if (currentTime >= video.pausePoints[index].timestamp) {
          setTriggeredIndices((prev) => new Set(prev).add(index))
          player.pauseVideo()
          setActivePauseIndex(index)
          break
        }
      }
    }, 300)

    return () => clearInterval(interval)
  }, [video, triggeredIndices, activePauseIndex])

  const activePoint =
    video && activePauseIndex !== null ? video.pausePoints[activePauseIndex] : null

  const resumeFromPause = () => {
    if (activePauseIndex === null) return
    if (activePoint?.hasQuestion && answersByPauseIndex[activePauseIndex] === undefined) {
      // A question is up — it must be answered before playback can resume.
      return
    }
    setPassedIndices((prev) => new Set(prev).add(activePauseIndex))
    setActivePauseIndex(null)
    playerRef.current?.playVideo()
  }

  // Spacebar resumes from a pause, unless focus is inside a text input.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || activePauseIndex === null) return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      event.preventDefault()
      resumeFromPause()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePauseIndex, answersByPauseIndex])

  if (!video) {
    return (
      <>
        <NavBar />
        <div className="page-content">
          <p>No video selected. Head back to the Library to pick one.</p>
          <button className="btn-primary" onClick={() => navigate('/library')}>
            Go to Library
          </button>
        </div>
      </>
    )
  }

  const handleReady: YouTubeProps['onReady'] = (event) => {
    playerRef.current = event.target
    setDuration(event.target.getDuration())
  }

  const handleEnd: YouTubeProps['onEnd'] = () => {
    setVideoEnded(true)
  }

  const handleAnswer = (selectedIndex: number) => {
    if (activePauseIndex === null) return
    setAnswersByPauseIndex((prev) => ({ ...prev, [activePauseIndex]: selectedIndex }))
  }

  const opts: YouTubeProps['opts'] = {
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 0,
      // Native fullscreen only fullscreens the iframe, which would hide the
      // question popup. We disable it and provide our own button that
      // fullscreens a wrapper containing both the iframe and the popup.
      fs: 0,
    },
  }

  const handleFullscreenToggle = () => {
    const container = playerContainerRef.current
    if (!container) return

    if (document.fullscreenElement) {
      document.exitFullscreen()
      return
    }

    const request =
      container.requestFullscreen ??
      (container as unknown as { webkitRequestFullscreen?: () => Promise<void> })
        .webkitRequestFullscreen
    request?.call(container)
  }

  const questionResults: QuestionResult[] = video.pausePoints
    .map((point, index) => ({ point, index }))
    .filter(({ point }) => point.hasQuestion && point.question)
    .map(({ point, index }) => ({
      prompt: point.question!.prompt,
      choices: point.question!.choices,
      selectedIndex: answersByPauseIndex[index] ?? -1,
      correctIndex: point.question!.correctIndex,
      explanation: point.question!.explanation,
    }))

  const continueDisabled = Boolean(
    activePoint?.hasQuestion && answersByPauseIndex[activePauseIndex ?? -1] === undefined,
  )

  return (
    <>
      <NavBar />
      <div className="page-content video-page">
        <div className="video-meta">
          <h1>{video.title}</h1>
        </div>

        <div className="player-container" ref={playerContainerRef}>
          <YouTube
            videoId={video.videoId}
            className="video-wrapper"
            iframeClassName="video-iframe"
            opts={opts}
            onReady={handleReady}
            onEnd={handleEnd}
          />

          <button
            type="button"
            className="fullscreen-button"
            aria-label="Toggle fullscreen"
            onClick={handleFullscreenToggle}
          >
            <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20" cy="20" r="20" fill="black" fillOpacity="0.5" />
              <path
                d="M14 14L20 14M14 14L14 20M14 14L18 18"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <path
                d="M26 26L20 26M26 26L26 20M26 26L22 22"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </button>

          {activePoint?.hasQuestion && activePoint.question && (
            <QuestionModal
              question={activePoint.question}
              onAnswer={handleAnswer}
              onContinue={resumeFromPause}
            />
          )}

          {videoEnded && (
            <QuestionSummaryModal
              results={questionResults}
              onDone={() => navigate('/library')}
            />
          )}
        </div>

        {duration > 0 && (
          <div className="pause-track">
            {video.pausePoints.map((point, index) => (
              <div
                key={index}
                className={`pause-marker${passedIndices.has(index) ? ' answered' : ''}`}
                style={{ left: `${(point.timestamp / duration) * 100}%` }}
                title={`Pause at ${point.timestamp}s`}
              />
            ))}
          </div>
        )}

        {activePauseIndex !== null && (
          <div className="continue-row">
            <button
              className="btn-primary continue-button"
              onClick={resumeFromPause}
              disabled={continueDisabled}
            >
              <Play size={18} />
              Continue
            </button>
          </div>
        )}
      </div>
    </>
  )
}
