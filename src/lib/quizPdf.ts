// Printable PDF export of a whole quiz (jsPDF), laid out to print on as few
// pages as possible: minimal margins and a two-column flow. Each problem is a
// self-contained block that is never split across a column or a page — it moves
// whole to the next column (or page) when it doesn't fit. The answer key follows
// on its own page(s), also two-column.
//
// Each problem is frozen at its FIRST question: the hand(s), the auction (and
// play) up to the first "?", and nothing past it. Rendering is typographic, not
// the on-screen card faces: a one-line hand when a single hand is given,
// otherwise a compass rose of stacked suits, balanced within its column. Card
// suits are colored (red ♥♦) — including in the answer-key explanations — the
// only color on the page; it still prints fine in black and white. Suit glyphs
// come from an embedded Unicode font (see quizPdfFont.ts); jsPDF's built-in
// fonts can't render them.
import { jsPDF } from 'jspdf'
import type { Hand, Problem, Quiz, Seat, Suit } from '../types'
import { SEAT_NAME } from '../types'
import {
  AUCTION_COLS,
  STRAIN_META,
  VUL_SHORT,
  auctionQuestionCount,
  buildAuction,
  finalContract,
  parseContract,
  type Contract,
  type Strain,
} from '../bidding'
import { flattenPlay } from './play'
import { PDF_FONT, registerPdfFont } from './quizPdfFont'

// Letter portrait, points. Margins are deliberately small to fit more per page.
const PW = 612
const PH = 792
const MARGIN = 22
const GUTTER = 20
const COL_W = (PW - 2 * MARGIN - GUTTER) / 2
const COL_X = [MARGIN, MARGIN + COL_W + GUTTER]
const TOP = MARGIN
const BOTTOM = PH - MARGIN
const PROBLEM_GAP = 14
const ANSWER_GAP = 10

const RED: [number, number, number] = [192, 0, 0]
const BLACK: [number, number, number] = [0, 0, 0]

// Hand-diagram suit order (spades, hearts, diamonds, clubs) — conventional
// newspaper order, and the one the user's one-line example uses.
const DIAGRAM_SUITS: Suit[] = ['S', 'H', 'D', 'C']

/** A run of text with a single color/weight — lets us color suit glyphs mid-line. */
interface Seg {
  text: string
  red?: boolean
  bold?: boolean
}

/** Ranks of a holding, spaced and with T shown as "10" ("AKT5" → "A K 10 5"). */
function rankStr(holding: string): string {
  return [...holding].map((r) => (r === 'T' ? '10' : r)).join(' ')
}

/** A bridge call ("2D*", "1NT", "P", "X") as colored segments. */
function callSegs(call: string): Seg[] {
  let c = call
  let star = ''
  if (c.endsWith('*')) {
    star = '*'
    c = c.slice(0, -1)
  }
  if (c === 'P' || c === 'p') return [{ text: 'Pass' }]
  if (c === 'X') return [{ text: 'Dbl' }]
  if (c === 'XX') return [{ text: 'Rdbl' }]
  const m = /^([1-7])(NT|N|C|D|H|S)$/.exec(c)
  if (m) {
    const strain = (m[2] === 'N' ? 'NT' : m[2]) as Strain
    const meta = STRAIN_META[strain]
    const segs: Seg[] = [{ text: m[1] }, { text: meta.sym, red: meta.red }]
    if (star) segs.push({ text: '*' })
    return segs
  }
  return [{ text: call }]
}

/** A card ("HQ", "ST") as colored segments ("♥Q", "♠10"). */
function cardSegs(card: string): Seg[] {
  const suit = card[0] as Suit
  const rank = card.slice(1) === 'T' ? '10' : card.slice(1)
  const meta = STRAIN_META[suit]
  return [{ text: meta.sym, red: meta.red }, { text: rank }]
}

function segsWidth(doc: jsPDF, segs: Seg[], size: number): number {
  let w = 0
  for (const s of segs) {
    doc.setFont(PDF_FONT, s.bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    w += doc.getTextWidth(s.text)
  }
  return w
}

/** Draw segments left-anchored at x. */
function drawSegs(doc: jsPDF, x: number, y: number, segs: Seg[], size: number): void {
  for (const s of segs) {
    doc.setFont(PDF_FONT, s.bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(...(s.red ? RED : BLACK))
    doc.text(s.text, x, y)
    x += doc.getTextWidth(s.text)
  }
}

function drawSegsCentered(doc: jsPDF, cx: number, y: number, segs: Seg[], size: number): void {
  drawSegs(doc, cx - segsWidth(doc, segs, size) / 2, y, segs, size)
}

/** Plain (single-color) text. */
function plain(doc: jsPDF, str: string, x: number, y: number, size: number, bold = false): void {
  doc.setFont(PDF_FONT, bold ? 'bold' : 'normal')
  doc.setFontSize(size)
  doc.setTextColor(...BLACK)
  doc.text(str, x, y)
}

/**
 * Draw a line of running text, coloring the red suit glyphs (♥♦) red and leaving
 * everything else — including ♠♣ — black. Widths are unaffected by color, so the
 * caller can wrap with splitTextToSize first and render each line here.
 */
function drawRichLine(doc: jsPDF, x: number, y: number, line: string, size: number): void {
  doc.setFont(PDF_FONT, 'normal')
  doc.setFontSize(size)
  let buf = ''
  let cx = x
  const flush = () => {
    if (!buf) return
    doc.setTextColor(...BLACK)
    doc.text(buf, cx, y)
    cx += doc.getTextWidth(buf)
    buf = ''
  }
  for (const ch of line) {
    if (ch === '♥' || ch === '♦') {
      flush()
      doc.setTextColor(...RED)
      doc.text(ch, cx, y)
      cx += doc.getTextWidth(ch)
    } else {
      buf += ch
    }
  }
  flush()
}

// --- diagram --------------------------------------------------------------

/** One hand, one line: "♠ A 2 ♥ J 9 8 6 2 ♦ A Q J 7 3 ♣ 10". */
function handLineSegs(hand: Hand): Seg[] {
  const segs: Seg[] = []
  DIAGRAM_SUITS.forEach((suit, i) => {
    const meta = STRAIN_META[suit]
    const holding = hand[suit] ?? ''
    if (i > 0) segs.push({ text: '   ' })
    segs.push({ text: meta.sym, red: meta.red })
    segs.push({ text: ' ' + (holding ? rankStr(holding) : '—') })
  })
  return segs
}

/** Suit-line segments for one suit of a hand ("♠ A Q J 7 3", or "♠ —" for a void). */
function suitLineSegs(hand: Hand, suit: Suit): Seg[] {
  const meta = STRAIN_META[suit]
  const holding = hand[suit] ?? ''
  return [{ text: meta.sym, red: meta.red }, { text: ' ' + (holding ? rankStr(holding) : '—') }]
}

const DEAL_SIZE = 8.5
const DEAL_LINE_H = 10.5
const DEAL_LABEL_H = 11
const DEAL_BLOCK_H = DEAL_LABEL_H + 4 * DEAL_LINE_H
const DEAL_ROW_GAP = 5
// Pull West/East in from the column edges so the compass reads closer to square
// than a wide rectangle.
const DEAL_SIDE_INSET = 28

/** Widest suit line in a hand (for centering / flush-right placement). */
function handWidth(doc: jsPDF, hand: Hand): number {
  return Math.max(...DIAGRAM_SUITS.map((s) => segsWidth(doc, suitLineSegs(hand, s), DEAL_SIZE)))
}

/** Draw a stacked hand block (seat label + 4 suit lines) top-anchored at (x, top). */
function drawHandBlock(doc: jsPDF, seat: Seat, hand: Hand, x: number, top: number): void {
  plain(doc, seat, x, top + 8, 8, true)
  DIAGRAM_SUITS.forEach((suit, i) => {
    drawSegs(doc, x, top + DEAL_LABEL_H + 8 + i * DEAL_LINE_H, suitLineSegs(hand, suit), DEAL_SIZE)
  })
}

/**
 * Render the deal within a column of width colW, top-anchored at yTop; returns
 * the height used. One hand → a single line; two or more → a compass rose with N
 * centered on top, W flush-left and E flush-right in the middle, S centered
 * below. Empty rows (a missing middle or pole) collapse so the block stays tight.
 */
function renderDeal(
  doc: jsPDF,
  problem: Problem,
  x: number,
  yTop: number,
  colW: number,
  draw: boolean,
): number {
  const seats = (['N', 'E', 'S', 'W'] as Seat[]).filter((s) => problem.deal[s] != null)
  if (seats.length <= 1) {
    const hand = seats.length ? problem.deal[seats[0]]! : {}
    if (draw) drawSegs(doc, x, yTop + 9, handLineSegs(hand), 10)
    return 16
  }

  let cy = yTop
  const centered = (seat: Seat) => {
    const hand = problem.deal[seat]!
    const bx = x + (colW - handWidth(doc, hand)) / 2
    return () => draw && drawHandBlock(doc, seat, hand, bx, cy)
  }

  // North row.
  if (problem.deal.N != null) {
    if (draw) centered('N')()
    cy += DEAL_BLOCK_H + DEAL_ROW_GAP
  }
  // West / East row, inset from the column edges toward the center.
  if (problem.deal.W != null || problem.deal.E != null) {
    if (draw && problem.deal.W != null) {
      drawHandBlock(doc, 'W', problem.deal.W, x + DEAL_SIDE_INSET, cy)
    }
    if (draw && problem.deal.E != null) {
      const bx = x + colW - DEAL_SIDE_INSET - handWidth(doc, problem.deal.E)
      drawHandBlock(doc, 'E', problem.deal.E, bx, cy)
    }
    cy += DEAL_BLOCK_H + DEAL_ROW_GAP
  }
  // South row.
  if (problem.deal.S != null) {
    if (draw) centered('S')()
    cy += DEAL_BLOCK_H
  } else {
    cy -= DEAL_ROW_GAP
  }
  return cy - yTop
}

// --- auction & play tables ------------------------------------------------

const AUCTION_HEADERS = ['West', 'North', 'East', 'South']
const AUC_COL_W = 60
const PLAY_TRICK_W = 32
const PLAY_COL_W = 54
const TABLE_ROW_H = 12.5

function tableHeader(
  doc: jsPDF,
  headers: string[],
  centers: number[],
  x0: number,
  right: number,
  yTop: number,
  draw: boolean,
): void {
  if (!draw) return
  headers.forEach((h, j) => drawSegsCentered(doc, centers[j], yTop + 7, [{ text: h, bold: true }], 8))
  // A subtle hairline under the column headers.
  doc.setDrawColor(150, 150, 150)
  doc.setLineWidth(0.3)
  doc.line(x0, yTop + 10, right, yTop + 10)
}

/** Draw the auction up to the first "?"; returns the height used. */
function renderAuction(doc: jsPDF, problem: Problem, x: number, yTop: number, draw: boolean): number {
  if (problem.auction.length === 0) return 0
  const model = buildAuction(problem, [])
  const centers = AUCTION_HEADERS.map((_, j) => x + j * AUC_COL_W + AUC_COL_W / 2)
  tableHeader(doc, AUCTION_HEADERS, centers, x, x + 4 * AUC_COL_W, yTop, draw)

  let y = yTop + 10
  model.grid.forEach((row) => {
    y += TABLE_ROW_H
    if (!draw) return
    row.forEach((cell, j) => {
      if (!cell) return
      const segs = cell.question ? [{ text: '?', bold: true }] : callSegs(cell.call ?? '')
      drawSegsCentered(doc, centers[j], y, segs, 9)
    })
  })
  return y - yTop + 3
}

/** Draw the recorded play up to the first "?"; returns the height used. */
function renderPlay(doc: jsPDF, problem: Problem, x: number, yTop: number, draw: boolean): number {
  const play = problem.play ?? []
  if (play.length === 0) return 0
  const moves = flattenPlay(play)

  type PCell = { segs: Seg[]; lead: boolean } | null
  const rows: PCell[][] = []
  const leaders = play.map((t) => (t.cards[0] as { seat: Seat }).seat)
  for (const mv of moves) {
    const col = AUCTION_COLS.indexOf(mv.seat)
    while (rows.length <= mv.trickIndex) rows.push([null, null, null, null])
    const lead = leaders[mv.trickIndex] === mv.seat
    if (mv.question) {
      rows[mv.trickIndex][col] = { segs: [{ text: '?', bold: true }], lead }
      break
    }
    rows[mv.trickIndex][col] = { segs: cardSegs(mv.card!), lead }
  }
  if (rows.length === 0) return 0

  const trickCx = x + PLAY_TRICK_W / 2
  const centers = AUCTION_HEADERS.map(
    (_, j) => x + PLAY_TRICK_W + j * PLAY_COL_W + PLAY_COL_W / 2,
  )
  const right = x + PLAY_TRICK_W + 4 * PLAY_COL_W
  if (draw) drawSegsCentered(doc, trickCx, yTop + 7, [{ text: 'Trick', bold: true }], 8)
  tableHeader(doc, AUCTION_HEADERS, centers, x, right, yTop, draw)

  let y = yTop + 10
  rows.forEach((row, r) => {
    y += TABLE_ROW_H
    if (!draw) return
    drawSegsCentered(doc, trickCx, y, [{ text: String(r + 1) }], 8)
    row.forEach((cell, j) => {
      if (!cell) return
      // The card that led the trick is bracketed so the reading order is clear.
      const segs = cell.lead ? [{ text: '[' }, ...cell.segs, { text: ']' }] : cell.segs
      drawSegsCentered(doc, centers[j], y, segs, 9)
    })
  })
  return y - yTop + 3
}

// --- problem block --------------------------------------------------------

function problemTitle(quiz: Quiz, problem: Problem, ordinal: number): string {
  return problem.title || `${quiz.title} #${ordinal}`
}

function contractSegs(c: Contract): Seg[] {
  const meta = STRAIN_META[c.strain]
  const segs: Seg[] = [{ text: String(c.level) }, { text: meta.sym, red: meta.red }]
  if (c.doubled) segs.push({ text: c.doubled === 'X' ? ' Dbl' : ' Rdbl' })
  segs.push({ text: ` by ${SEAT_NAME[c.declarer]}` })
  return segs
}

/**
 * Render one problem block within a column, top-anchored at (x, y); returns the
 * height used. With draw=false nothing is drawn — used to measure the block so
 * the flow can keep it whole. Measuring and drawing share this code, so heights
 * always match.
 */
function renderProblem(
  doc: jsPDF,
  quiz: Quiz,
  problem: Problem,
  ordinal: number,
  x: number,
  y: number,
  colW: number,
  draw: boolean,
): number {
  let yy = y
  // A thicker rule above the title so problems read as separate units.
  if (draw) {
    doc.setDrawColor(...BLACK)
    doc.setLineWidth(1.1)
    doc.line(x, yy + 1.5, x + colW, yy + 1.5)
  }
  yy += 8
  if (draw) plain(doc, problemTitle(quiz, problem, ordinal), x, yy + 9, 11, true)
  yy += 14

  // The first question is in the auction unless the whole auction is settled;
  // only then is there a contract to show and possibly a play question.
  const auctionPhase = auctionQuestionCount(problem) > 0
  let contract: Contract | null = null
  if (!auctionPhase) {
    contract = problem.auction.length
      ? finalContract(problem, [])
      : problem.contract
        ? parseContract(problem.contract)
        : null
  }

  const metaSegs: Seg[] = [{ text: `Dealer: ${SEAT_NAME[problem.dealer]}` }]
  if (problem.vulnerability) metaSegs.push({ text: `    Vul: ${VUL_SHORT[problem.vulnerability]}` })
  if (contract) metaSegs.push({ text: '    Contract: ' }, ...contractSegs(contract))
  if (draw) drawSegs(doc, x, yy + 7, metaSegs, 8)
  yy += 13

  yy += renderDeal(doc, problem, x, yy, colW, draw)
  yy += 4
  const ah = renderAuction(doc, problem, x, yy, draw)
  yy += ah
  if (!auctionPhase) {
    if (ah) yy += 6
    yy += renderPlay(doc, problem, x, yy, draw)
  }
  return yy - y
}

// --- answer key -----------------------------------------------------------

interface FirstQ {
  kind: 'bid' | 'card'
  answer: string
  accept?: string[]
  explanation?: string
}

function firstQuestion(problem: Problem): FirstQ | null {
  for (const e of problem.auction) {
    if ('question' in e) {
      const q = e.question
      return { kind: 'bid', answer: q.answer, accept: q.accept, explanation: q.explanation }
    }
  }
  for (const t of problem.play ?? []) {
    for (const c of t.cards) {
      if ('question' in c) {
        const q = c.question
        return { kind: 'card', answer: q.answer, accept: q.accept, explanation: q.explanation }
      }
    }
  }
  return null
}

function valueSegs(kind: 'bid' | 'card', value: string): Seg[] {
  return kind === 'bid' ? callSegs(value) : cardSegs(value)
}

function joinSegs(lists: Seg[][]): Seg[] {
  const out: Seg[] = []
  lists.forEach((l, i) => {
    if (i > 0) out.push({ text: ', ' })
    out.push(...l)
  })
  return out
}

const EXPL_SIZE = 8.5
const EXPL_LINE_H = 11

/** Wrap an explanation (respecting its paragraph breaks) to lines for `colW`. */
function explanationLines(doc: jsPDF, text: string, wrapW: number): string[] {
  doc.setFont(PDF_FONT, 'normal')
  doc.setFontSize(EXPL_SIZE)
  const lines: string[] = []
  for (const para of text.split('\n')) {
    if (!para.trim()) {
      lines.push('')
      continue
    }
    for (const line of doc.splitTextToSize(para, wrapW) as string[]) lines.push(line)
  }
  return lines
}

/** Render one answer-key entry within a column; returns the height used. */
function renderAnswer(
  doc: jsPDF,
  quiz: Quiz,
  problem: Problem,
  ordinal: number,
  x: number,
  y: number,
  colW: number,
  draw: boolean,
): number {
  let yy = y
  if (draw) plain(doc, `#${ordinal}  ${problemTitle(quiz, problem, ordinal)}`, x, yy + 8, 9.5, true)
  yy += 13

  const fq = firstQuestion(problem)
  if (!fq) {
    if (draw) plain(doc, '(no question — study hand)', x + 10, yy + 8, EXPL_SIZE)
    return yy + 12 - y
  }

  const answerLine: Seg[] = [{ text: 'Answer: ', bold: true }, ...valueSegs(fq.kind, fq.answer)]
  if (fq.accept?.length) {
    answerLine.push(
      { text: '    Also accept: ' },
      ...joinSegs(fq.accept.map((a) => valueSegs(fq.kind, a))),
    )
  }
  if (draw) drawSegs(doc, x + 10, yy + 8, answerLine, EXPL_SIZE)
  yy += 13

  if (fq.explanation) {
    const lines = explanationLines(doc, fq.explanation, colW - 10)
    for (const line of lines) {
      if (draw && line) drawRichLine(doc, x + 10, yy + 8, line, EXPL_SIZE)
      yy += EXPL_LINE_H
    }
  }
  return yy - y
}

// --- two-column flow ------------------------------------------------------

interface Block {
  height: number
  draw: (x: number, y: number) => void
}

/**
 * Lay blocks into two columns, top-to-bottom, left column then right, adding
 * pages as needed. A block never splits: if it doesn't fit the rest of a column
 * it moves whole to the next column (or a new page). `firstTop` is the starting
 * y on the first page (below any heading); later pages start at TOP.
 */
function flowBlocks(doc: jsPDF, blocks: Block[], firstTop: number, gap: number): void {
  let col = 0
  let curTop = firstTop
  let y = firstTop
  for (const b of blocks) {
    if (y + b.height > BOTTOM && y > curTop) {
      if (col === 0) {
        col = 1
        y = curTop
      } else {
        doc.addPage()
        col = 0
        curTop = TOP
        y = TOP
      }
    }
    b.draw(COL_X[col], y)
    y += b.height + gap
  }
}

// --- entry points ---------------------------------------------------------

/** Build the printable-quiz PDF document (problem pages + answer key). */
export function buildQuizPdf(quiz: Quiz, allProblems: Problem[]): jsPDF {
  const bySlug = new Map(allProblems.map((p) => [p.slug, p]))
  const problems = quiz.problemSlugs
    .map((s) => bySlug.get(s))
    .filter((p): p is Problem => p != null)

  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  registerPdfFont(doc)
  doc.setFont(PDF_FONT, 'normal')

  const problemBlocks: Block[] = problems.map((problem, i) => ({
    height: renderProblem(doc, quiz, problem, i + 1, 0, 0, COL_W, false),
    draw: (x, y) => renderProblem(doc, quiz, problem, i + 1, x, y, COL_W, true),
  }))
  flowBlocks(doc, problemBlocks, TOP, PROBLEM_GAP)

  doc.addPage()
  plain(doc, 'Answer Key', MARGIN, TOP + 12, 14, true)
  const answerBlocks: Block[] = problems.map((problem, i) => ({
    height: renderAnswer(doc, quiz, problem, i + 1, 0, 0, COL_W, false),
    draw: (x, y) => renderAnswer(doc, quiz, problem, i + 1, x, y, COL_W, true),
  }))
  flowBlocks(doc, answerBlocks, TOP + 30, ANSWER_GAP)

  return doc
}

/** Build and download a printable PDF of an entire quiz. */
export function downloadQuizPdf(quiz: Quiz, allProblems: Problem[]): void {
  buildQuizPdf(quiz, allProblems).save(`${quiz.slug}.pdf`)
}
