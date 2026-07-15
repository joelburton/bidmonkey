// Mirrors schema.v1.json / schema.sql. Only the fields phase 2 needs are
// fully typed; auction/play are kept loose until the bidding phase.

export type Seat = 'N' | 'E' | 'S' | 'W'
export type Suit = 'S' | 'H' | 'D' | 'C'
export type Vulnerability = 'none' | 'ns' | 'ew' | 'both'

/** Ranks in one suit, high to low, e.g. "AK952". "T" = ten. */
export type Holding = string
export type Hand = Partial<Record<Suit, Holding>>
export type Deal = Partial<Record<Seat, Hand>>

export interface BidQuestion {
  id: string
  choiceType: 'multiple_choice' | 'enter_bid'
  prompt?: string
  answer: string
  options?: string[]
  accept?: string[]
  explanation?: string
}
export type AuctionEntry = { call: string } | { question: BidQuestion }

export interface CardQuestion {
  id: string
  choiceType: 'multiple_choice' | 'enter_card'
  prompt?: string
  answer: string // a card, e.g. "HQ"
  options?: string[]
  accept?: string[]
  explanation?: string
}
/** One play by one seat: a recorded card, or a question posed to the hero. */
export type PlayEntry = { seat: Seat; card: string } | { seat: Seat; question: CardQuestion }
export interface Trick {
  cards: PlayEntry[]
}

export interface Problem {
  slug: string
  title?: string
  source?: string // FK → Source.slug
  difficulty?: number
  tags: string[]
  hero: Seat
  dealer: Seat
  vulnerability: Vulnerability
  deal: Deal
  auction: AuctionEntry[]
  play?: Trick[]
  contract?: string
  commentary?: string
}

/** A source is where problems come from — a book, a teacher, a website. */
export interface Source {
  slug: string
  title: string
}

/**
 * A quiz is an ordered collection of problems (optionally from one source). The
 * order of `problemSlugs` is the quiz order; a problem may appear in several
 * quizzes. Mirrors the `quizzes` + `quizzes_problems` tables (the array index
 * is the stored `ordinal`, 1-based).
 */
export interface Quiz {
  slug: string
  title: string
  source?: string // FK → Source.slug
  problemSlugs: string[]
}

export const SEAT_NAME: Record<Seat, string> = {
  N: 'North',
  E: 'East',
  S: 'South',
  W: 'West',
}

export const VULN_LABEL: Record<Vulnerability, string> = {
  none: 'None vul',
  ns: 'N-S vul',
  ew: 'E-W vul',
  both: 'Both vul',
}

/** Is `seat` vulnerable under `vuln`? (for future scoring / coloring) */
export function isVulnerable(seat: Seat, vuln: Vulnerability): boolean {
  const ns = seat === 'N' || seat === 'S'
  return vuln === 'both' || (vuln === 'ns' && ns) || (vuln === 'ew' && !ns)
}
