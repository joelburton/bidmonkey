/**
 * The ⚑ pennant, drawn rather than typed: the Unicode flags (⚑/⚐) render as
 * emoji on iOS, which can't be recolored. `filled` is the flagged state.
 */
export function FlagIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="flag-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 3 L6 21"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <path
        d="M6 4.5 L18 8 L6 11.5 Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Puts this problem on (or off) the review list — the same effect a wrong answer
 * has automatically. A solid orange chip with a black pennant when flagged, an
 * outlined circle when not.
 *
 * Like every other button in the app it must not take focus (preventing
 * mousedown's default), or the next keypress would re-activate it.
 */
export function FlagButton({
  flagged,
  onToggle,
  pressed,
}: {
  flagged: boolean
  onToggle: () => void
  /** Flash after Shift+F, matching the bid pad's key feedback. */
  pressed?: boolean
}) {
  return (
    <button
      className={`flag-btn${flagged ? ' on' : ''}${pressed ? ' pressed' : ''}`}
      aria-pressed={flagged}
      aria-label={flagged ? 'Unflag this problem' : 'Flag this problem for review'}
      title={flagged ? 'Flagged for review (⇧F)' : 'Flag for review (⇧F)'}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onToggle}
    >
      <FlagIcon filled={flagged} />
    </button>
  )
}
