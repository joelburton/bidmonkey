import type { BidQuestion, Problem, Seat, Vulnerability } from './types'

// Auction columns are a clockwise cycle (W→N→E→S→W), so filling left-to-right
// and wrapping rows, starting at the dealer's column, follows the real auction
// order for any dealer.
export const AUCTION_COLS: Seat[] = ['W', 'N', 'E', 'S']

export const STRAINS = ['C', 'D', 'H', 'S', 'NT'] as const
export type Strain = (typeof STRAINS)[number]
export const LEVELS: number[] = [1, 2, 3, 4, 5, 6, 7]

export const STRAIN_META: Record<Strain, { sym: string; red: boolean }> = {
  C: { sym: '♣', red: false },
  D: { sym: '♦', red: true },
  H: { sym: '♥', red: true },
  S: { sym: '♠', red: false },
  NT: { sym: 'NT', red: false },
}

export const VUL_SHORT: Record<Vulnerability, string> = {
  none: 'None',
  ns: 'N/S',
  ew: 'E/W',
  both: 'Both',
}

export function parseBid(call: string): { level: number; strain: Strain } | null {
  const m = /^([1-7])(NT|N|C|D|H|S)$/.exec(call)
  if (!m) return null
  const strain = (m[2] === 'N' ? 'NT' : m[2]) as Strain
  return { level: Number(m[1]), strain }
}

/** Ordinal rank of a contract bid; higher beats lower. Non-bids return -1. */
export function bidRank(level: number, strain: Strain): number {
  return (level - 1) * 5 + STRAINS.indexOf(strain)
}
function callRank(call: string): number {
  const b = parseBid(call)
  return b ? bidRank(b.level, b.strain) : -1
}

export interface SeatedCall {
  seat: Seat
  call: string
}
export interface Cell {
  seat: Seat
  call?: string // a made call
  question?: boolean // the "?" (seat to act) cell
}
export interface AuctionModel {
  cols: Seat[]
  grid: (Cell | null)[][]
  actingSeat: Seat | null // seat with the "?", or null when the auction is done
  prior: SeatedCall[] // calls before the current "?", tagged with seat
  priorCalls: string[]
  question: BidQuestion | null // the current question, or null when done
  complete: boolean // every question has been answered
  numQuestions: number
}

/** How many questions the whole auction poses to the player. */
export function auctionQuestionCount(problem: Problem): number {
  return (problem.auction ?? []).filter((e) => 'question' in e).length
}

/**
 * Build the auction grid given the player's answers so far. Reveals every call
 * up to (and including) the next unanswered question — the "?" — with earlier
 * questions filled in by `answers`. Once all questions are answered, the whole
 * auction (including trailing passes) is shown and `complete` is true.
 */
export function buildAuction(problem: Problem, answers: string[]): AuctionModel {
  const cols = AUCTION_COLS
  const dealerIdx = cols.indexOf(problem.dealer)
  const auction = problem.auction ?? []
  const numQuestions = auctionQuestionCount(problem)
  const complete = answers.length >= numQuestions

  const cells: Cell[] = []
  const prior: SeatedCall[] = []
  let qSeen = 0
  let actingSeat: Seat | null = null
  let question: BidQuestion | null = null

  for (let k = 0; k < auction.length; k++) {
    const seat = cols[(dealerIdx + k) % 4]
    const e = auction[k]
    if ('question' in e) {
      if (qSeen < answers.length) {
        // already answered — show the answer as a made call
        const call = answers[qSeen]
        cells.push({ seat, call })
        prior.push({ seat, call })
      } else {
        // the current question — the "?"
        cells.push({ seat, question: true })
        actingSeat = seat
        question = e.question
        qSeen++
        break // hide everything after the current question
      }
      qSeen++
    } else {
      cells.push({ seat, call: e.call })
      prior.push({ seat, call: e.call })
    }
  }

  const total = dealerIdx + cells.length
  const nRows = Math.max(1, Math.ceil(total / 4))
  const grid: (Cell | null)[][] = Array.from({ length: nRows }, () =>
    Array<Cell | null>(4).fill(null),
  )
  cells.forEach((c, k) => {
    const pos = dealerIdx + k
    grid[Math.floor(pos / 4)][pos % 4] = c
  })

  return {
    cols,
    grid,
    actingSeat,
    prior,
    priorCalls: prior.map((p) => p.call),
    question,
    complete,
    numQuestions,
  }
}

export interface Contract {
  level: number
  strain: Strain
  declarer: Seat
  doubled: '' | 'X' | 'XX'
}

/**
 * The final contract from a completed auction (questions replaced by `answers`).
 * Declarer is the first of the winning side to have named the final strain.
 * Returns null if the auction was passed out.
 */
export function finalContract(problem: Problem, answers: string[]): Contract | null {
  const cols = AUCTION_COLS
  const dealerIdx = cols.indexOf(problem.dealer)
  const seated: SeatedCall[] = []
  let qSeen = 0
  for (let k = 0; k < problem.auction.length; k++) {
    const e = problem.auction[k]
    const seat = cols[(dealerIdx + k) % 4]
    const call = 'question' in e ? answers[qSeen++] : e.call
    if (call == null) return null
    seated.push({ seat, call })
  }

  let last: { level: number; strain: Strain; seat: Seat } | null = null
  for (const { seat, call } of seated) {
    const b = parseBid(call)
    if (b) last = { ...b, seat }
  }
  if (!last) return null

  let declarer: Seat = last.seat
  for (const { seat, call } of seated) {
    const b = parseBid(call)
    if (b && b.strain === last.strain && sameSide(seat, last.seat)) {
      declarer = seat
      break
    }
  }

  let doubled: '' | 'X' | 'XX' = ''
  for (const { call } of seated) {
    if (parseBid(call)) doubled = ''
    else if (call === 'X') doubled = 'X'
    else if (call === 'XX') doubled = 'XX'
  }

  return { level: last.level, strain: last.strain, declarer, doubled }
}

/** Parse a stored contract string ("3NT E", "4SX W") into a Contract, or null.
 * Used for problems given as a contract + play with no auction to derive one. */
export function parseContract(text: string): Contract | null {
  const m = /^([1-7])(NT|N|C|D|H|S)(XX|X)?\s+([NESW])$/.exec(text.trim())
  if (!m) return null
  const strain = (m[2] === 'N' ? 'NT' : m[2]) as Strain
  return {
    level: Number(m[1]),
    strain,
    declarer: m[4] as Seat,
    doubled: (m[3] ?? '') as '' | 'X' | 'XX',
  }
}

function highestRank(calls: string[]): number {
  let max = -1
  for (const c of calls) max = Math.max(max, callRank(c))
  return max
}

/** A whole level is available only if its highest bid (level-NT) beats the auction. */
export function levelLegal(level: number, priorCalls: string[]): boolean {
  return bidRank(level, 'NT') > highestRank(priorCalls)
}
export function bidLegal(level: number, strain: Strain, priorCalls: string[]): boolean {
  return bidRank(level, strain) > highestRank(priorCalls)
}

function sameSide(a: Seat, b: Seat): boolean {
  const ns = (s: Seat) => s === 'N' || s === 'S'
  return ns(a) === ns(b)
}

/** Whether Double or Redouble is currently available to the acting seat. */
export function doubleState(
  prior: SeatedCall[],
  acting: Seat | null,
): 'double' | 'redouble' | null {
  if (!acting) return null
  for (let i = prior.length - 1; i >= 0; i--) {
    const { seat, call } = prior[i]
    if (call === 'P') continue
    const opponent = !sameSide(seat, acting)
    if (parseBid(call)) return opponent ? 'double' : null // double an opponent's bid
    if (call === 'X') return opponent ? 'redouble' : null // redouble their double
    return null // already XX, etc.
  }
  return null
}
