// Renders a problem as plain text to paste into a Claude conversation.
//
// Deliberately NOT JSON. Bridge has a universal written notation and Claude has
// read a great deal of it, so a hand diagram and a W/N/E/S auction table are
// understood directly; a JSON encoding of the same facts would first have to be
// decoded against a schema Claude has never seen. Plain text is also readable
// and editable by the person pasting it — you can see what you sent, and delete
// the answer if you'd rather be quizzed than told.
//
// It is also not a written-out prompt. Two lines of framing say what the block
// is; the question is left to the person, because a canned "explain why this is
// right" would prescribe the only conversation you could have.

import type { Hand, Problem, Seat, Suit } from '../types'
import { SEAT_NAME } from '../types'
import { buildAuction, finalContract, parseBid, stripAlert, VUL_SHORT } from '../bidding'

const SUIT_SYM: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' }
/** Written bridge order — always S-H-D-C, unlike the on-screen fan (S-H-C-D). */
const WRITTEN_ORDER: Suit[] = ['S', 'H', 'D', 'C']
const SEATS: Seat[] = ['N', 'E', 'S', 'W']

/** "AKT52" → "A K 10 5 2". Ranks are spaced and T is spelled out: "AKT52" and
 * "A10852" are both readable, but neither is unambiguous the way this is. */
function holding(h?: string): string {
  if (!h) return '—'
  return h
    .split('')
    .map((r) => (r === 'T' ? '10' : r))
    .join(' ')
}

function handLine(hand: Hand): string {
  return WRITTEN_ORDER.map((s) => `${SUIT_SYM[s]} ${holding(hand[s])}`).join('   ')
}

/** "1H" → "1♥", "P" → "Pass", "2D*" → "2♦!" (! is the standard alert mark). */
function callText(raw: string): string {
  const c = stripAlert(raw)
  const alerted = c !== raw
  let out: string
  if (c === 'P') out = 'Pass'
  else if (c === 'X') out = 'Dbl'
  else if (c === 'XX') out = 'Rdbl'
  else {
    const b = parseBid(c)
    out = b ? `${b.level}${b.strain === 'NT' ? 'NT' : SUIT_SYM[b.strain as Suit]}` : c
  }
  return alerted ? `${out}!` : out
}

/** "HQ" → "♥Q", "ST" → "♠10". */
function cardText(c: string): string {
  const suit = c[0] as Suit
  if (!SUIT_SYM[suit]) return c
  const rank = c[1] === 'T' ? '10' : c.slice(1)
  return `${SUIT_SYM[suit]}${rank}`
}

/** How to write an answer/option depends on what kind of answer it is. */
function answerText(kind: 'bid' | 'card' | 'text', v: string): string {
  return kind === 'bid' ? callText(v) : kind === 'card' ? cardText(v) : v
}

const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - s.length))

/** "North", "North and East", "North, East and West". */
function andList(parts: string[]): string {
  if (parts.length < 2) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/**
 * The whole problem as pasteable text: framing, the hands, the auction as far
 * as it has been revealed, the question on the table with its answer, and the
 * recorded play if the problem has one.
 *
 * `answers` is the run's answers so far, so the auction shown matches the
 * screen — the calls after the current question stay hidden, exactly as they
 * are on the felt. The book's answer to the *current* question is included: the
 * point of this is to discuss the answer, not to be quizzed again.
 */
export function problemToText(problem: Problem, answers: string[]): string {
  const model = buildAuction(problem, answers)
  const out: string[] = []
  let anyAlert = false
  const call = (c: string) => {
    if (c !== stripAlert(c)) anyAlert = true
    return callText(c)
  }

  out.push("Here's a bridge problem I'm working through. Details below; my question follows.")
  out.push('')

  const where = [problem.source && `source: ${problem.source}`, `id: ${problem.slug}`]
    .filter(Boolean)
    .join(', ')
  if (problem.title) out.push(problem.title)
  out.push(`(${where})`)
  if (problem.tags.length) out.push(`Tags: ${problem.tags.join(', ')}`)
  out.push('')

  out.push(`I am ${SEAT_NAME[problem.hero]}.`)
  out.push(
    `Dealer: ${SEAT_NAME[problem.dealer]}. Vulnerability: ${
      problem.vulnerability ? VUL_SHORT[problem.vulnerability] : 'not stated'
    }.`,
  )
  out.push('')

  // --- the hands -----------------------------------------------------------
  out.push('Hands:')
  const unknown: Seat[] = []
  for (const s of SEATS) {
    const hand = problem.deal[s]
    if (!hand) {
      unknown.push(s)
      continue
    }
    // The marker goes with the seat name rather than at the end of the line: on
    // a phone the hand wraps, and a trailing "<- me" ends up orphaned below it.
    const label = s === problem.hero ? `${SEAT_NAME[s]} (me)` : SEAT_NAME[s]
    out.push(`  ${pad(label, 11)} ${handLine(hand)}`)
  }
  if (unknown.length) {
    const who = andList(unknown.map((s) => SEAT_NAME[s]))
    out.push(`  (${who} ${unknown.length > 1 ? 'are' : 'is'} not given.)`)
  }
  out.push('')

  // --- the auction ---------------------------------------------------------
  if (problem.auction.length) {
    out.push('Auction:')
    out.push(
      '  ' +
        model.cols
          .map((s) => pad(SEAT_NAME[s], 7))
          .join('')
          .trimEnd(),
    )
    for (const row of model.grid) {
      const cells = row.map((c) => pad(c ? (c.call ? call(c.call) : c.question ? '?' : '') : '', 7))
      out.push('  ' + cells.join('').trimEnd())
    }
    if (anyAlert) out.push('  (! marks an alertable call.)')
    out.push('')
  }

  // --- the question on the table -------------------------------------------
  const q = model.question
  if (q) {
    out.push(`It is ${SEAT_NAME[model.actingSeat!]}'s turn, and that is the question.`)
    if (q.prompt) out.push(`Prompt: ${q.prompt}`)
    if (q.options?.length) {
      out.push(`Choices offered: ${q.options.map((o) => answerText(q.answerKind, o)).join(' / ')}`)
    }
    out.push(`The book's answer: ${answerText(q.answerKind, q.answer)}`)
    if (q.accept?.length) {
      out.push(`Also accepted: ${q.accept.map((a) => answerText(q.answerKind, a)).join(' / ')}`)
    }
    if (q.explanation) out.push(`The book's reasoning: ${q.explanation}`)
    out.push('')
  } else if (problem.auction.length) {
    // Only meaningful when there *was* an auction: a problem given as contract
    // + play has none, and "passed out" would both be false and contradict the
    // stored contract printed just below.
    const c = finalContract(problem, answers)
    out.push(
      c
        ? `Final contract: ${c.level}${c.strain === 'NT' ? 'NT' : SUIT_SYM[c.strain as Suit]}${
            c.doubled === 'X' ? ' doubled' : c.doubled === 'XX' ? ' redoubled' : ''
          } by ${SEAT_NAME[c.declarer]}.`
        : 'The auction is over (passed out).',
    )
    out.push('')
  }

  if (problem.contract && !problem.auction.length) {
    out.push(`Contract: ${problem.contract} (no auction given).`)
    out.push('')
  }

  // --- the recorded play ---------------------------------------------------
  const play = problem.play ?? []
  if (play.length) {
    out.push('Recorded play (how the hand goes):')
    let asked = false
    play.forEach((trick, i) => {
      const cards = trick.cards.map((e) => {
        if ('card' in e) return `${e.seat} ${cardText(e.card)}`
        asked = true
        return `${e.seat} ${cardText(e.question.answer)}*`
      })
      out.push(`  Trick ${i + 1}: ${cards.join(', ')}`)
    })
    if (asked) out.push('  (* marks a card the problem asks me to choose.)')
    out.push('')
  }

  if (problem.commentary) {
    out.push(`Commentary: ${problem.commentary}`)
    out.push('')
  }

  return (
    out
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n'
  )
}
