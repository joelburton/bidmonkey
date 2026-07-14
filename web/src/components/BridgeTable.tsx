import type { ReactNode } from 'react'

/**
 * The full-bleed portrait table as a layout shell: N/S span the top and bottom,
 * E/W are the side rails, and the center holds the auction or play panel. What
 * goes in each slot (which hand, face up/down, the center content) is decided by
 * the caller (ProblemView) per phase.
 */
export function BridgeTable({
  top,
  bottom,
  left,
  right,
  center,
  className = '',
}: {
  top: ReactNode
  bottom: ReactNode
  left: ReactNode
  right: ReactNode
  center: ReactNode
  className?: string
}) {
  return (
    <div className={`table ${className}`}>
      <div className="rail rail-north">{top}</div>
      <div className="middle">
        <div className="rail rail-west">{left}</div>
        <div className="center">{center}</div>
        <div className="rail rail-east">{right}</div>
      </div>
      <div className="rail rail-south">{bottom}</div>
    </div>
  )
}
