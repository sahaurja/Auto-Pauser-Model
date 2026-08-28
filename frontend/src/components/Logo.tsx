/** Small bear-face glyph, used as Cadence's mark next to the wordmark. */
function BearGlyph({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <circle cx="8" cy="9" r="4.5" fill="var(--color-brown)" />
      <circle cx="24" cy="9" r="4.5" fill="var(--color-brown)" />
      <circle cx="16" cy="17" r="12" fill="var(--color-brown)" />
      <ellipse cx="16" cy="20" rx="6.5" ry="5" fill="#eaceac" />
      <circle cx="16" cy="18.5" r="1.8" fill="var(--color-brown-dark)" />
      <circle cx="11" cy="14" r="1.4" fill="var(--color-brown-dark)" />
      <circle cx="21" cy="14" r="1.4" fill="var(--color-brown-dark)" />
    </svg>
  )
}

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <span className="logo">
      <span className="logo-icon">
        <BearGlyph size={size} />
      </span>
      <span className="logo-text">Cadence</span>
    </span>
  )
}
