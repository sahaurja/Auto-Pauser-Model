import { TeddyBear } from './TeddyBear'
import { Star } from './Star'

export function HomeIllustration() {
  return (
    <div
      className="home-illustration"
      role="img"
      aria-label="A teddy bear reading a book in a sunny study nook"
      style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}
    >
      <svg viewBox="0 0 260 260" width="100%" height="auto" style={{ position: 'absolute', inset: 0 }}>
        <circle cx="130" cy="130" r="128" fill="var(--color-bg-yellow)" opacity="0.6" />
        <circle cx="130" cy="130" r="100" fill="var(--color-surface)" opacity="0.7" />
      </svg>
      <div style={{ position: 'relative', paddingTop: 32 }}>
        <TeddyBear pose="reading" size={170} />
      </div>
      <div style={{ position: 'absolute', top: 12, right: 30 }}>
        <Star size={18} />
      </div>
      <div style={{ position: 'absolute', bottom: 34, left: 18 }}>
        <Star size={12} />
      </div>
    </div>
  )
}
