import type { Suit } from '../types'
import { SUIT_SHAPE, pipClass } from './SuitGlyph'

const SUIT_NAME: Record<Suit, string> = {
  S: 'spades',
  H: 'hearts',
  D: 'diamonds',
  C: 'clubs',
}

const RANK_NAME: Record<string, string> = {
  A: 'ace',
  K: 'king',
  Q: 'queen',
  J: 'jack',
  T: 'ten',
}

/** "T" displays as "10"; everything else is itself. */
export function rankLabel(rank: string): string {
  return rank === 'T' ? '10' : rank
}

/**
 * A single card, shown only as its rank + suit — no full "playing-card" face.
 * Real cards waste width (a wide blank face right of the corner index) and height
 * (blank below it); here the viewBox is cropped to just the rank-over-suit index,
 * so the chip is as narrow/short as the values allow. It still keeps the ~1.4
 * aspect the fan/rail overlap math assumes, and the index sits at the leading
 * (top-left) edge — the part that stays visible when cards overlap in a fan or a
 * rotated rail. Pips are the Wikimedia suit shapes, dropped in as a nested SVG.
 */
export function Card({
  suit,
  rank,
  bottomPad = false,
}: {
  suit: Suit
  rank: string
  bottomPad?: boolean
}) {
  const shape = SUIT_SHAPE[suit]
  // Two classes: the red/black one that colours the card by default, and the
  // per-suit one the four-colour deck overrides (see `pipClass`). Both the rank
  // and the pip carry them, so a suit changes colour as a unit.
  const color = `${shape.red ? 'red' : 'black'} ${pipClass(suit)}`
  const label = `${RANK_NAME[rank] ?? rank} of ${SUIT_NAME[suit]}`
  // The bottom (South) hand grows a little taller — extra blank white BELOW the
  // rank/suit — so on a real phone the rounded bottom screen corner clips only
  // that blank space, never a pip (gated by useIsPhone). The rank/suit and the
  // suit divider stay put at the top; only the viewBox + white background extend
  // downward, lifting the pips clear of the curve.
  const h = bottomPad ? 80 : 66

  return (
    <svg className="card" viewBox={`0 0 44 ${h}`} role="img" aria-label={label}>
      <rect className="card-bg" x="1" y="1" width="42" height={h - 2} rx="7" />
      {/* Left-edge divider, shown only when this is the first card of a new suit
          group (see .slot.suit-start in the CSS). */}
      <line className="card-divider" x1="2.5" y1="9" x2="2.5" y2="57" />
      {/* Rank over suit, each centered horizontally (text-anchor middle / the
          nested SVG centered), with room below the suit so it isn't clipped. */}
      <text className={`card-idx ${color}`} x="22" y="30" textAnchor="middle">
        {rankLabel(rank)}
      </text>
      <svg
        className={color}
        x="9"
        y="33"
        width="26"
        height="26"
        viewBox={shape.box}
        preserveAspectRatio="xMidYMid meet"
      >
        <path d={shape.d} />
      </svg>
    </svg>
  )
}

/** Face-down card, used to represent hidden hands. */
export function CardBack() {
  return (
    <svg className="card" viewBox="0 0 44 66" role="img" aria-label="face-down card">
      <rect className="card-bg" x="1" y="1" width="42" height="64" rx="7" />
      <rect className="card-back-fill" x="6" y="6" width="32" height="54" rx="5" />
    </svg>
  )
}
