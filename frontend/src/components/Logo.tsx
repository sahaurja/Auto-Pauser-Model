export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="logo">
      <span className="logo-icon">
        <img src="/pixel_bear.png" alt="" width={size} height={size} className="teddy-sprite" />
      </span>
      <span className="logo-text">Cadence</span>
    </span>
  )
}
