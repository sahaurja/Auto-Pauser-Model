export function HomeIllustration() {
  return (
    <svg
      viewBox="0 0 360 280"
      role="img"
      aria-label="Illustration of a video pausing to ask a comprehension question"
      className="home-illustration"
    >
      <circle cx="180" cy="140" r="132" fill="#dbe7fb" />

      <rect x="48" y="56" width="220" height="150" rx="18" fill="#ffffff" stroke="#cddcf5" strokeWidth="2" />

      <circle cx="158" cy="120" r="40" fill="#8fb4f2" />
      <rect x="143" y="102" width="12" height="36" rx="4" fill="#ffffff" />
      <rect x="167" y="102" width="12" height="36" rx="4" fill="#ffffff" />

      <rect x="72" y="176" width="172" height="8" rx="4" fill="#eef4fd" />
      <rect x="72" y="176" width="96" height="8" rx="4" fill="#0853d1" />
      <circle cx="168" cy="180" r="7" fill="#0853d1" />

      <circle cx="272" cy="70" r="34" fill="#0853d1" />
      <text
        x="272"
        y="80"
        textAnchor="middle"
        fontSize="34"
        fontWeight="600"
        fill="#ffffff"
        fontFamily="'Apple SD Gothic Neo', 'Helvetica Neue', Arial, sans-serif"
      >
        ?
      </text>

      <circle cx="70" cy="220" r="22" fill="#ffffff" stroke="#2e7d32" strokeWidth="3" />
      <path
        d="M61 220l6 6 12-13"
        fill="none"
        stroke="#2e7d32"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
