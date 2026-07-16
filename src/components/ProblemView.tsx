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

  // Playable if we know every hand (full play / free study), or the problem has
  // a recorded play even though some hands are hidden — e.g. a "what's your lead"
  // or "win this trick" problem, where the specific cards are authored but the
  // opponents' full hands aren't. PlayView plays as far as the record allows.
  const allHandsKnown = ALL_SEATS.every((s) => problem.deal[s] != null)
  const canPlay = allHandsKnown || (problem.play?.length ?? 0) > 0

  if (phase === 'play') {
    return (
      <PlayView
        problem={problem}
        contract={finalContract(problem, answers)}
        answers={answers}
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
