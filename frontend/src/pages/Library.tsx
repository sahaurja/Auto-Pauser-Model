import { useNavigate } from 'react-router-dom'
import { NavBar } from '../components/NavBar'
import { useLibrary } from '../context/LibraryContext'

export function Library() {
  const navigate = useNavigate()
  const { videos } = useLibrary()

  const openVideo = (videoId: string) => {
    navigate('/video', { state: { videoId } })
  }

  return (
    <>
      <NavBar />
      <div className="page-content">
        <div className="library-header">
          <h1>Your library</h1>
          <button className="btn-primary" onClick={() => navigate('/home')}>
            + New upload
          </button>
        </div>

        <div className="library-grid">
          {videos.map((video) => (
            <div
              key={video.videoId}
              className="library-card card"
              onClick={() => openVideo(video.videoId)}
            >
              <img
                className="library-thumb"
                src={video.thumbnailUrl}
                alt={video.title}
              />
              <div className="library-card-body">
                <span className="library-title">{video.title}</span>
                <span className="library-date">{video.processedDate}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
