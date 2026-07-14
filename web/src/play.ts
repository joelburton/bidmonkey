import type { CardQuestion, Hand, Seat, Suit } from './types'
import type { Strain } from './bidding'

// Clockwise seating: N → E → S → W → N.
const CLOCKWISE: Seat[] = ['N', 'E', 'S', 'W']
export function nextSeat(seat: Seat): Seat {
  return CLOCKWISE[(CLOCKWISE.indexOf(seat) + 1) % 4]
}
export function partnerOf(seat: Seat): Seat {
  return CLOCKWISE[(CLOCKWISE.indexOf(seat) + 2) % 4]
}

export function cardSuit(card: string): Suit {
  return card[0] as Suit
}
const RANKS = 'AKQJT98765432'
export function cardRankValue(card: string): number {
  return RANKS.length - RANKS.indexOf(card[1])
}

/** Winning seat of a completed trick, given the trump strain ('NT' = no trump). */
export function trickWinner(
  cards: { seat: Seat; card: string }[],
  trump: Strain,
): Seat {
  const led = cardSuit(cards[0].card)
  let best = cards[0]
  for (const c of cards.slice(1)) {
    const s = cardSuit(c.card)
    const bs = cardSuit(best.card)
    const cTrump = trump !== 'NT' && s === trump
    const bTrump = trump !== 'NT' && bs === trump
    if (cTrump && !bTrump) best = c
    else if (cTrump === bTrump && s === led && bs === led && cardRankValue(c.card) > cardRankValue(best.card)) best = c
    else if (cTrump && bTrump && cardRankValue(c.card) > cardRankValue(best.card)) best = c
  }
  return best.seat
}

export interface Move {
  seat: Seat
  card?: string
  question?: CardQuestion
  trickIndex: number
  lastInTrick: boolean
}

/** Flatten the recorded play into a single ordered list of moves. */
export function flattenPlay(play: { cards: { seat: Seat; card?: string; question?: CardQuestion }[] }[]): Move[] {
  const out: Move[] = []
  play.forEach((trick, trickIndex) => {
    trick.cards.forEach((entry, pi) => {
      out.push({
        seat: entry.seat,
        card: entry.card,
        question: entry.question,
        trickIndex,
        lastInTrick: pi === trick.cards.length - 1,
      })
    })
  })
  return out
}

/** Whether the given trick (of the recorded play) contains a question for the hero. */
export function trickHasQuestion(moves: Move[], trickIndex: number): boolean {
  return moves.some((m) => m.trickIndex === trickIndex && m.question != null)
}

/** A hand with the played cards removed, ready to render. */
export function handRemaining(hand: Hand, playedCards: string[]): Hand {
  const played = new Set(playedCards)
  const out: Hand = {}
  for (const suit of ['S', 'H', 'C', 'D'] as Suit[]) {
    const holding = hand[suit]
    if (holding == null) continue
    const left = [...holding].filter((r) => !played.has(suit + r)).join('')
    out[suit] = left
  }
  return out
}
