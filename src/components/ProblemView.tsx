import { useState } from 'react'
import type { Problem, Seat } from '../types'
import { buildAuction, finalContract, parseContract } from '../bidding'
import { BridgeTable } from './BridgeTable'
import { Hand } from './Hand'
import { AuctionPanel } from './AuctionPanel'
import { PlayView } from './PlayView'
import { useIsPhone } from '../useIsPhone'

const ALL_SEATS: Seat[] = ['N', 'E', 'S', 'W']

/**
 * Drives one problem: the auction (with answers accumulating), then the play
 * phase (if all four hands are known). Quiz navigation (Home / Next) lives in
 * the app header; `onNext`/`hasNext` are also passed to the auction panel so a
 * "Next ▸" sits beside "Play" on a playable problem.
 *
 * The review flag is owned by App (it's persisted per player, not per problem
 * view) and threaded through to whichever phase is on screen.
 */
export function ProblemView({
  problem,
  onNext,
  hasNext,
  flagged,
  onToggleFlag,
  onFlagAnswer,
  freeEntry = false,
}: {
  problem: Problem
  onNext: () => void
  hasNext: boolean
  flagged: boolean
  onToggleFlag: () => void
  onFlagAnswer: (reason: 'wrong' | 'alternate') => void
  /** The "enter answers, don't choose" setting — see AuctionPanel/PlayView for
   * what it turns into. Off by default so a test can render a problem alone. */
  freeEntry?: boolean
}) {
  const [answers, setAnswers] = useState<string[]>([])
  // Held here, not in AuctionPanel: that panel is remounted on every answer (see
  // its `key` below), which would re-hide the id each time the auction advances.
  // ProblemView is keyed per problem, so a reveal lasts the problem and no longer.
  const [showId, setShowId] = useState(false)
  const isPhone = useIsPhone()

  // Playable in exactly two cases: every hand is known (full play / free study),
  // or it's an opening-lead problem — only the hero's hand, and the play is the
  // single lead question. (Partial hands with a fuller recorded play aren't
  // supported and don't import.)
  const allHandsKnown = ALL_SEATS.every((s) => problem.deal[s] != null)
  const play = problem.play ?? []
  const isLeadOnly =
    play.length === 1 && play[0].cards.length === 1 && 'question' in play[0].cards[0]
  const canPlay = allHandsKnown || isLeadOnly

  // A problem given as contract + play with no auction opens straight on the
  // play page; its contract is the stored one (there's no auction to derive it).
  const noAuction = problem.auction.length === 0
  const [phase, setPhase] = useState<'auction' | 'play'>(noAuction && canPlay ? 'play' : 'auction')

  if (phase === 'play') {
    return (
      <PlayView
        problem={problem}
        contract={
          noAuction ? parseContract(problem.contract ?? '') : finalContract(problem, answers)
        }
        answers={answers}
        onNext={onNext}
        hasNext={hasNext}
        flagged={flagged}
        onToggleFlag={onToggleFlag}
        onFlagAnswer={onFlagAnswer}
        freeEntry={freeEntry}
      />
    )
  }

  // A bidding-only problem is over once the auction is: the panel shows nothing
  // but "Next ▸". (A playable one still offers "Play", so it stays on the felt.)
  const biddingDone = !canPlay && !buildAuction(problem, answers).actingSeat

  // Auction: only the hero's hand is shown (at the bottom); the rest are face down.
  return (
    <BridgeTable
      done={biddingDone}
      top={<Hand faceDown orientation="horizontal" />}
      left={<Hand faceDown orientation="west" />}
      right={<Hand faceDown orientation="east" />}
      bottom={
        <Hand hand={problem.deal[problem.hero]} orientation="horizontal" bottomPad={isPhone} />
      }
      center={
        <AuctionPanel
          // Load-bearing, not a list key: a correct answer advances via
          // onAnswer without the panel ever clearing its popup state — the key
          // change remounts it, which is what closes the popup and resets any
          // pending level.
          key={answers.length}
          problem={problem}
          answers={answers}
          onAnswer={(c) => setAnswers((a) => [...a, c])}
          onPlay={() => setPhase('play')}
          onNext={onNext}
          hasNext={hasNext}
          canPlay={canPlay}
          flagged={flagged}
          onToggleFlag={onToggleFlag}
          onFlagAnswer={onFlagAnswer}
          freeEntry={freeEntry}
          showId={showId}
          onToggleShowId={() => setShowId((v) => !v)}
        />
      }
    />
  )
}
