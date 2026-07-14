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
  actingSeat: Seat | null
  prior: SeatedCall[] // calls before the question, tagged with seat
  priorCalls: string[]
  question: BidQuestion | null
}

/**
 * Turn a problem's auction into a grid of cells up to (and including) the first
 * question — the "?" the player must answer. Calls after the question (the
 * solution) are not included.
 */
export function buildAuction(problem: Problem): AuctionModel {
  const cols = AUCTION_COLS
  const dealerIdx = cols.indexOf(problem.dealer)
  const auction = problem.auction ?? []
  const qIndex = auction.findIndex((e) => 'question' in e)
  const lastIndex = qIndex === -1 ? auction.length - 1 : qIndex

  const cells: Cell[] = []
  const prior: SeatedCall[] = []
  for (let k = 0; k <= lastIndex; k++) {
    const seat = cols[(dealerIdx + k) % 4]
    const e = auction[k]
    if ('question' in e) {
      cells.push({ seat, question: true })
    } else {
      cells.push({ seat, call: e.call })
      prior.push({ seat, call: e.call })
    }
  }
  const actingSeat = qIndex === -1 ? null : cols[(dealerIdx + qIndex) % 4]
  const question =
    qIndex === -1
      ? null
      : (auction[qIndex] as { question: BidQuestion }).question

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
