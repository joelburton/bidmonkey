// Pure bridge rules for card play — seating, cards, trick resolution, and legal
// plays. No React and no layout here: this is just the game, so it stays easy to
// test and keeps the components free of bridge logic. Screen-position helpers
// (seatLayout / Pos) live in ../play, the app-facing wrapper that re-exports all
// of this.
import type { CardQuestion, Hand, Seat, Suit } from '../types'
import type { Strain } from '../bidding'

// Clockwise seating: N → E → S → W → N. Play always proceeds clockwise.
const CLOCKWISE: Seat[] = ['N', 'E', 'S', 'W']
export function nextSeat(seat: Seat): Seat {
  return CLOCKWISE[(CLOCKWISE.indexOf(seat) + 1) % 4]
}
export function prevSeat(seat: Seat): Seat {
  return CLOCKWISE[(CLOCKWISE.indexOf(seat) + 3) % 4]
}
export function partnerOf(seat: Seat): Seat {
  return CLOCKWISE[(CLOCKWISE.indexOf(seat) + 2) % 4]
}

// A card is a two-char code: suit letter + rank, e.g. "HQ", "ST", "D2".
export function cardSuit(card: string): Suit {
  return card[0] as Suit
}
const RANKS = 'AKQJT98765432'
export function cardRankValue(card: string): number {
  return RANKS.length - RANKS.indexOf(card[1])
}

// Suit display order (spades, hearts, clubs, diamonds — clubs splits the reds).
const SUIT_ORDER: Suit[] = ['S', 'H', 'C', 'D']

/** Every card in a hand as codes (e.g. ["SA","SK","HQ",…]), in display order. */
export function handToCards(hand: Hand): string[] {
  const out: string[] = []
  for (const suit of SUIT_ORDER) {
    const holding = hand[suit]
    if (!holding) continue
    for (const rank of holding) out.push(suit + rank)
  }
  return out
}

/** The suit led in the current trick (its first card), or null if empty. */
export function ledSuit(trick: { card: string }[]): Suit | null {
  return trick.length ? cardSuit(trick[0].card) : null
}

/**
 * The cards from `hand` that may legally be played to the current `trick`: you
 * must follow the led suit if you hold any of it; otherwise any card is legal.
 * Leading (an empty trick) allows anything.
 */
export function legalCards(hand: Hand, trick: { card: string }[]): string[] {
  const cards = handToCards(hand)
  const led = ledSuit(trick)
  if (!led) return cards
  const following = cards.filter((c) => cardSuit(c) === led)
  return following.length ? following : cards
}

/** Whether `card` is a legal play from `hand` to the current `trick`. */
export function isLegalPlay(hand: Hand, trick: { card: string }[], card: string): boolean {
  return legalCards(hand, trick).includes(card)
}

/**
 * Whose turn it is, given who led the current trick and the cards played so far.
 * Play runs clockwise from the leader. A full (4-card) trick has no next player
 * until it is won and cleared, so callers should only ask with 0–3 cards down.
 */
export function seatToAct(leader: Seat, trick: { card: string }[]): Seat {
  return CLOCKWISE[(CLOCKWISE.indexOf(leader) + trick.length) % 4]
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

/** A hand with the played cards removed, ready to render. */
export function handRemaining(hand: Hand, playedCards: string[]): Hand {
  const played = new Set(playedCards)
  const out: Hand = {}
  for (const suit of SUIT_ORDER) {
    const holding = hand[suit]
    if (holding == null) continue
    const left = [...holding].filter((r) => !played.has(suit + r)).join('')
    out[suit] = left
  }
  return out
}
