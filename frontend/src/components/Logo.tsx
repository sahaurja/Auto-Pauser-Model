import { CirclePause } from 'lucide-react'

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <span className="logo">
      <CirclePause size={size} strokeWidth={2.25} className="logo-icon" />
      <span className="logo-text">Cadence</span>
    </span>
  )
}
