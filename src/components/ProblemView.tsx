import { useState } from 'react'
import type { Problem, Seat } from '../types'
import { finalContract } from '../bidding'
import { BridgeTable } from './BridgeTable'
import { Hand } from './Hand'
import { AuctionPanel } from './AuctionPanel'
import { PlayView } from './PlayView'

const ALL_SEATS: Seat[] = ['N', 'E', 'S', 'W']

/**
 * Drives one problem: the auction (with answers accumulating), then the play
 * phase (if all four hands are known). Quiz navigation (Home / Next) lives in
 * the app header; `onNext`/`hasNext` are also passed to the auction panel so a
 * "Next ▸" sits beside "Play" on a playable problem.
 */
export function ProblemView({
  problem,
  onNext,
  hasNext,
}: {
  problem: Problem
  onNext: () => void
  hasNext: boolean
}) {
  const [answers, setAnswers] = useState<string[]>([])
  const [phase, setPhase] = useState<'auction' | 'play'>('auction')

  // Playable in exactly two cases: every hand is known (full play / free study),
  // or it's an opening-lead problem — only the hero's hand, and the play is the
  // single lead question. (Partial hands with a fuller recorded play aren't
  // supported and don't import.)
  const allHandsKnown = ALL_SEATS.every((s) => problem.deal[s] != null)
  const play = problem.play ?? []
  const isLeadOnly =
    play.length === 1 && play[0].cards.length === 1 && 'question' in play[0].cards[0]
  const canPlay = allHandsKnown || isLeadOnly

  if (phase === 'play') {
    return (
      <PlayView
        problem={problem}
        contract={finalContract(problem, answers)}
        answers={answers}
        onNext={onNext}
        hasNext={hasNext}
      />
    )
  }

  // Auction: only the hero's hand is shown (at the bottom); the rest are face down.
  return (
    <BridgeTable
      top={<Hand faceDown orientation="horizontal" />}
      left={<Hand faceDown orientation="west" />}
      right={<Hand faceDown orientation="east" />}
      bottom={<Hand hand={problem.deal[problem.hero]} orientation="horizontal" />}
      center={
        <AuctionPanel
          key={answers.length}
          problem={problem}
          answers={answers}
          onAnswer={(c) => setAnswers((a) => [...a, c])}
          onPlay={() => setPhase('play')}
          onNext={onNext}
          hasNext={hasNext}
          canPlay={canPlay}
        />
      }
    />
  )
}
