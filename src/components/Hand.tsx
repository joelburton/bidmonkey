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
 * `canPlay`, when given, further restricts which cards are clickable (e.g. only
 * legal follows) — cards it rejects render but don't respond. `selectedCard`
 * raises + highlights that card (toward center, per `raise`). A face-down hand
 * shows `count` backs (default 13) — concealed hands shrink as cards are played,
 * so the remaining count stays readable, as at a real table.
 */
export function Hand({
  hand,
  faceDown = false,
  count = 13,
  orientation = 'horizontal',
  onPlay,
  canPlay,
  selectedCard,
  raise,
}: {
  hand?: HandType
  faceDown?: boolean
  count?: number
  orientation?: Orientation
  onPlay?: (card: string) => void
  canPlay?: (card: string) => boolean
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
        {Array.from({ length: count }, (_, i) => (
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
        const playable = !!onPlay && (!canPlay || canPlay(card))
        return (
          <span
            className={slotClass(i, s.suitStart, playable, card === selectedCard)}
            key={s.key}
            onClick={
              playable
                ? (e) => {
                    e.stopPropagation()
                    onPlay!(card)
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
