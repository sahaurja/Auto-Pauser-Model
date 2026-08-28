export type TeddyPose = 'reading' | 'waiting' | 'celebrating' | 'peeking' | 'thinking'

interface TeddyBearProps {
  pose?: TeddyPose
  size?: number
  animated?: boolean
  className?: string
}

const FUR = 'var(--color-brown)'
const FUR_DARK = 'var(--color-brown-dark)'
const MUZZLE = '#eaceac'
const INNER_EAR = '#d9a98a'
const BLUSH = '#f3b8a0'
const INK = '#4a3220'
const PAGE = 'var(--color-surface)'
const STAR = 'var(--color-action)'

/** Ears + head + face — identical across every pose so the bear reads as
 * one consistent character rather than a different drawing each time. */
function Face() {
  return (
    <>
      <circle cx="62" cy="44" r="17" fill={FUR} />
      <circle cx="138" cy="44" r="17" fill={FUR} />
      <circle cx="62" cy="45" r="8" fill={INNER_EAR} />
      <circle cx="138" cy="45" r="8" fill={INNER_EAR} />

      <circle cx="100" cy="80" r="48" fill={FUR} />

      <circle cx="72" cy="90" r="9" fill={BLUSH} opacity="0.55" />
      <circle cx="128" cy="90" r="9" fill={BLUSH} opacity="0.55" />

      <ellipse cx="100" cy="92" rx="25" ry="19" fill={MUZZLE} />
      <ellipse cx="100" cy="84" rx="7" ry="5" fill={INK} />
      <path
        d="M100 89 v5 M100 94 q-6 6 -12 2 M100 94 q6 6 12 2"
        fill="none"
        stroke={INK}
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      <circle cx="84" cy="70" r="4" fill={INK} />
      <circle cx="116" cy="70" r="4" fill={INK} />
    </>
  )
}

function Star({ x, y, r = 9 }: { x: number; y: number; r?: number }) {
  return (
    <path
      d={`M${x} ${y - r} L${x + r * 0.28} ${y - r * 0.28} L${x + r} ${y} L${x + r * 0.28} ${y + r * 0.28} L${x} ${y + r} L${x - r * 0.28} ${y + r * 0.28} L${x - r} ${y} L${x - r * 0.28} ${y - r * 0.28} Z`}
      fill={STAR}
    />
  )
}

function SittingBody({ pose }: { pose: TeddyPose }) {
  return (
    <>
      {/* legs */}
      <ellipse cx="76" cy="186" rx="16" ry="11" fill={FUR} />
      <ellipse cx="124" cy="186" rx="16" ry="11" fill={FUR} />
      <ellipse cx="76" cy="190" rx="8" ry="5" fill={MUZZLE} />
      <ellipse cx="124" cy="190" rx="8" ry="5" fill={MUZZLE} />

      {/* body */}
      <ellipse cx="100" cy="150" rx="54" ry="46" fill={FUR} />
      <ellipse cx="100" cy="158" rx="26" ry="22" fill={MUZZLE} opacity="0.7" />

      {pose === 'reading' && (
        <>
          {/* little book resting on lap */}
          <path d="M66 172 q34 -16 68 0 v14 q-34 -14 -68 0 z" fill={PAGE} stroke={FUR_DARK} strokeWidth="2" />
          <path d="M100 172 v14" stroke={FUR_DARK} strokeWidth="2" />
          {/* paws resting on book */}
          <circle cx="70" cy="168" r="11" fill={FUR} />
          <circle cx="130" cy="168" r="11" fill={FUR} />
        </>
      )}

      {pose === 'waiting' && (
        <>
          {/* paws folded in lap */}
          <ellipse cx="100" cy="172" rx="20" ry="12" fill={FUR} />
          <circle cx="86" cy="168" r="10" fill={FUR} />
          <circle cx="114" cy="168" r="10" fill={FUR} />
        </>
      )}

      {pose === 'celebrating' && (
        <>
          {/* arms raised */}
          <ellipse cx="56" cy="132" rx="12" ry="22" fill={FUR} transform="rotate(-35 56 132)" />
          <ellipse cx="144" cy="132" rx="12" ry="22" fill={FUR} transform="rotate(35 144 132)" />
          <circle cx="42" cy="106" r="11" fill={FUR} />
          <circle cx="158" cy="106" r="11" fill={FUR} />
          <Star x={100} y={40} r={10} />
          <Star x={168} y={90} r={6} />
          <Star x={32} y={90} r={6} />
        </>
      )}

      {pose === 'thinking' && (
        <>
          {/* one paw up near chin */}
          <ellipse cx="128" cy="130" rx="11" ry="20" fill={FUR} transform="rotate(-15 128 130)" />
          <circle cx="120" cy="102" r="10" fill={FUR} />
          {/* other paw resting */}
          <circle cx="76" cy="168" r="11" fill={FUR} />
        </>
      )}
    </>
  )
}

function PeekingBear() {
  return (
    <>
      <rect x="0" y="96" width="200" height="10" rx="5" fill={FUR_DARK} opacity="0.15" />
      <circle cx="78" cy="70" r="11" fill={FUR} />
      <circle cx="122" cy="70" r="11" fill={FUR} />
      <g transform="translate(0 -34)">
        <Face />
      </g>
    </>
  )
}

export function TeddyBear({ pose = 'waiting', size = 120, animated = false, className }: TeddyBearProps) {
  const isPeeking = pose === 'peeking'
  const viewBox = isPeeking ? '0 0 200 106' : '0 0 200 200'
  const height = isPeeking ? (size * 106) / 200 : size

  return (
    <svg
      viewBox={viewBox}
      width={size}
      height={height}
      role="img"
      aria-label={`Cadence the teddy bear, ${pose}`}
      className={[className, animated ? 'teddy-bob' : ''].filter(Boolean).join(' ')}
    >
      {isPeeking ? (
        <PeekingBear />
      ) : (
        <>
          <SittingBody pose={pose} />
          <Face />
        </>
      )}
    </svg>
  )
}
