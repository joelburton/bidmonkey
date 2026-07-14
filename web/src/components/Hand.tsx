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

function slotClass(
  i: number,
  suitStart: boolean,
  playable: boolean,
  selected: boolean,
): string {
  return (
    'slot' +
    (i === 0 ? ' first' : suitStart ? ' suit-start' : '') +
    (playable ? ' playable' : '') +
    (selected ? ' selected' : '')
  )
}

const HAND_CLASS: Record<Orientation, string> = {
  horizontal: 'hand-h',
  west: 'hand-v hand-v-west',
  east: 'hand-v hand-v-east',
}

type Raise = 'up' | 'down' | 'left' | 'right'

/**
 * A hand as overlapping card faces. Horizontal fan (N/S, and the dummy); rotated
 * rails for E/W. `onPlay` makes the cards clickable (returns e.g. "HQ").
 * `selectedCard` raises + highlights that card (toward center, per `raise`).
 */
export function Hand({
  hand,
  faceDown = false,
  orientation = 'horizontal',
  onPlay,
  selectedCard,
  raise,
}: {
  hand?: HandType
  faceDown?: boolean
  orientation?: Orientation
  onPlay?: (card: string) => void
  selectedCard?: string
  raise?: Raise
}) {
  const vertical = orientation !== 'horizontal'
  const cls = `hand ${HAND_CLASS[orientation]}${raise ? ` raise-${raise}` : ''}`
  const wrap = (node: React.ReactNode) =>
    vertical ? <span className="rot">{node}</span> : node

  if (!hand || faceDown) {
    return (
      <div className={cls} aria-label="hidden hand">
        {Array.from({ length: 13 }, (_, i) => (
          <span className={slotClass(i, false, false, false)} key={i}>
            {wrap(<CardBack />)}
          </span>
        ))}
      </div>
    )
  }

  const slots = toSlots(hand)
  return (
    <div className={cls}>
      {slots.map((s, i) => {
        const card = `${s.suit}${s.rank}`
        return (
          <span
            className={slotClass(i, s.suitStart, !!onPlay, card === selectedCard)}
            key={s.key}
            onClick={
              onPlay
                ? (e) => {
                    e.stopPropagation()
                    onPlay(card)
                  }
                : undefined
            }
          >
            {wrap(<Card suit={s.suit} rank={s.rank} />)}
          </span>
        )
      })}
    </div>
  )
}
