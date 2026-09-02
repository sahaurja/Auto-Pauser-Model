export type TeddyPose = 'reading' | 'waiting' | 'celebrating' | 'peeking' | 'thinking'

interface TeddyBearProps {
  pose?: TeddyPose
  size?: number
  animated?: boolean
  className?: string
}

const BEAR_SRC = '/pixel_bear.png'
/** Source image is 558x447 — used to keep every rendered size in proportion. */
const BEAR_ASPECT = 447 / 558

export function TeddyBear({ pose = 'waiting', size = 120, animated = false, className }: TeddyBearProps) {
  const width = size
  const fullHeight = width * BEAR_ASPECT
  const classes = [className, animated ? 'teddy-bob' : ''].filter(Boolean).join(' ')

  const img = (
    <img
      src={BEAR_SRC}
      alt=""
      width={width}
      height={fullHeight}
      className="teddy-sprite"
      style={{ width, height: fullHeight }}
    />
  )

  if (pose === 'peeking') {
    // Crop to just the head so the bear appears to peek up over an edge.
    const peekHeight = fullHeight * 0.52
    return (
      <div
        role="img"
        aria-label="Cadence the pixel bear, peeking"
        className={classes}
        style={{ width, height: peekHeight, overflow: 'hidden' }}
      >
        {img}
      </div>
    )
  }

  return (
    <span role="img" aria-label={`Cadence the pixel bear, ${pose}`} className={classes}>
      {img}
    </span>
  )
}
