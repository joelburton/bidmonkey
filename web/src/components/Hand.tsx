import type { Hand as HandType, Suit } from '../types'
import { Card, CardBack } from './Card'

// Display order: spades, hearts, clubs, diamonds — clubs separates the two red
// suits so hearts and diamonds are never adjacent.
const SUIT_ORDER: Suit[] = ['S', 'H', 'C', 'D']

type Orientation = 'horizontal' | 'west' | 'east'

interface Slot {
  key: string
  suit: Suit
  rank: string
  suitStart: boolean // first card of a new suit group
}

function toSlots(hand: HandType): Slot[] {
  const slots: Slot[] = []
  for (const suit of SUIT_ORDER) {
    const holding = hand[suit]
    if (!holding) continue
    ;[...holding].forEach((rank, i) => {
      slots.push({ key: `${suit}${rank}`, suit, rank, suitStart: i === 0 })
    })
  }
  return slots
}

function slotClass(i: number, suitStart: boolean, playable: boolean): string {
  return (
    'slot' +
    (i === 0 ? ' first' : suitStart ? ' suit-start' : '') +
    (playable ? ' playable' : '')
  )
}

const HAND_CLASS: Record<Orientation, string> = {
  horizontal: 'hand-h',
  west: 'hand-v hand-v-west',
  east: 'hand-v hand-v-east',
}

/**
 * A hand as overlapping card faces. Horizontal fan (N/S, and the dummy); rotated
 * rails for E/W. `onPlay` makes the cards clickable (returns e.g. "HQ").
 */
export function Hand({
  hand,
  faceDown = false,
  orientation = 'horizontal',
  onPlay,
}: {
  hand?: HandType
  faceDown?: boolean
  orientation?: Orientation
  onPlay?: (card: string) => void
}) {
  const vertical = orientation !== 'horizontal'
  const cls = `hand ${HAND_CLASS[orientation]}`
  const wrap = (node: React.ReactNode) =>
    vertical ? <span className="rot">{node}</span> : node

  if (!hand || faceDown) {
    return (
      <div className={cls} aria-label="hidden hand">
        {Array.from({ length: 13 }, (_, i) => (
          <span className={slotClass(i, false, false)} key={i}>
            {wrap(<CardBack />)}
          </span>
        ))}
      </div>
    )
  }

  const slots = toSlots(hand)
  return (
    <div className={cls}>
      {slots.map((s, i) => (
        <span
          className={slotClass(i, s.suitStart, !!onPlay)}
          key={s.key}
          onClick={onPlay ? () => onPlay(`${s.suit}${s.rank}`) : undefined}
        >
          {wrap(<Card suit={s.suit} rank={s.rank} />)}
        </span>
      ))}
    </div>
  )
}
