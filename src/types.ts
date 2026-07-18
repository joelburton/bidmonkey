// Mirrors schema.v1.json / schema.sql. Only the fields phase 2 needs are
// fully typed; auction/play are kept loose until the bidding phase.

export type Seat = 'N' | 'E' | 'S' | 'W'
export type Suit = 'S' | 'H' | 'D' | 'C'
export type Vulnerability = 'none' | 'ns' | 'ew' | 'both'

/** Ranks in one suit, high to low, e.g. "AK952". "T" = ten. */
export type Holding = string
export type Hand = Partial<Record<Suit, Holding>>
export type Deal = Partial<Record<Seat, Hand>>

// A question's answer domain (how `answer`/`options`/`accept` are read and
// rendered) and its input mode are orthogonal:
//   answerKind — 'bid' | 'card' | 'text'  (what the strings mean)
//   choiceType — 'multiple_choice' | 'free'  ('free' = bid pad / card click)
// 'text' is a free-form multiple-choice question whose answer is neither a call
// nor a card (e.g. "at what vulnerability?"); it is always 'multiple_choice'.
export type AnswerKind = 'bid' | 'card' | 'text'
export type ChoiceType = 'multiple_choice' | 'free'

export interface BidQuestion {
  id: string
  // 'text' rides the auction as a terminal, non-continuing question — its answer
  // is not a call, so it doesn't extend the auction (see buildAuction).
  answerKind: 'bid' | 'text'
  choiceType: ChoiceType
  prompt?: string
  answer: string
  options?: string[]
  accept?: string[]
  explanation?: string
}
export type AuctionEntry = { call: string } | { question: BidQuestion }

export interface CardQuestion {
  id: string
  answerKind: 'card'
  choiceType: ChoiceType
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
  // null = the problem didn't state a vulnerability (its solution applies to
  // any); distinct from 'none' (explicitly neither side vulnerable).
  vulnerability: Vulnerability | null
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
  /** Optional cover image URL (e.g. a book cover), shown in the sources list. */
  coverUrl?: string
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
