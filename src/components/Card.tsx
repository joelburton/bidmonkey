import type { Suit } from '../types'
import { SUIT_SHAPE } from './SuitGlyph'

const SUIT_NAME: Record<Suit, string> = {
  S: 'spades',
  H: 'hearts',
  D: 'diamonds',
  C: 'clubs',
}

const RANK_NAME: Record<string, string> = {
  A: 'ace', K: 'king', Q: 'queen', J: 'jack', T: 'ten',
}

/** "T" displays as "10"; everything else is itself. */
export function rankLabel(rank: string): string {
  return rank === 'T' ? '10' : rank
}

/**
 * A single readable card face. Rank + suit sit in the top-left corner — the part
 * that stays visible when cards overlap. No large center pip (it only added
 * clutter). Pips are the Wikimedia suit shapes, dropped in as a nested SVG.
 */
export function Card({ suit, rank }: { suit: Suit; rank: string }) {
  const shape = SUIT_SHAPE[suit]
  const color = shape.red ? 'red' : 'black'
  const label = `${RANK_NAME[rank] ?? rank} of ${SUIT_NAME[suit]}`

  return (
    <svg className="card" viewBox="0 0 100 140" role="img" aria-label={label}>
      <rect className="card-bg" x="1.5" y="1.5" width="97" height="137" rx="11" />
      <text className={`card-idx ${color}`} x="8" y="34">{rankLabel(rank)}</text>
      <svg
        className={color}
        x="3" y="39" width="25" height="26"
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
    <svg className="card" viewBox="0 0 100 140" role="img" aria-label="face-down card">
      <rect className="card-bg" x="1.5" y="1.5" width="97" height="137" rx="11" />
      <rect className="card-back-fill" x="8" y="8" width="84" height="124" rx="7" />
    </svg>
  )
}
