interface StarProps {
  size?: number
  className?: string
}

/** Small hand-drawn-style four-point sparkle, used sparingly as an accent
 * (correct-answer feedback, headings, empty states) — never as decoration
 * covering the whole interface. */
export function Star({ size = 16, className }: StarProps) {
  return (
    <svg
      viewBox="0 0 18 18"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        d="M9 0 L11.5 6.5 L18 9 L11.5 11.5 L9 18 L6.5 11.5 L0 9 L6.5 6.5 Z"
        fill="var(--color-action)"
      />
    </svg>
  )
}
