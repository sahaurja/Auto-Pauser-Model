export type TeddyPose = 'reading' | 'waiting' | 'celebrating' | 'peeking' | 'thinking'

interface TeddyBearProps {
  pose?: TeddyPose
  size?: number
  animated?: boolean
  className?: string
}

/** Source images keep their own natural aspect ratio so nothing gets stretched. */
const BEAR_SOURCES: Record<'default' | 'peeking', { src: string; aspect: number }> = {
  default: { src: '/pixel_bear.png', aspect: 447 / 558 },
  peeking: { src: '/bear_dance_seq/cutie.png', aspect: 532 / 469 },
}

export function TeddyBear({ pose = 'waiting', size = 120, animated = false, className }: TeddyBearProps) {
  const { src, aspect } = BEAR_SOURCES[pose === 'peeking' ? 'peeking' : 'default']
  const width = size
  const fullHeight = width * aspect
  const classes = [className, animated ? 'teddy-bob' : ''].filter(Boolean).join(' ')

  return (
    <span role="img" aria-label={`Cadence the pixel bear, ${pose}`} className={classes}>
      <img
        src={src}
        alt=""
        width={width}
        height={fullHeight}
        className="teddy-sprite"
        style={{ width, height: fullHeight }}
      />
    </span>
  )
}
