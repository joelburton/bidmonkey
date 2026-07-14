import { useState } from 'react'
import type { Problem, Seat } from '../types'
import { finalContract } from '../bidding'
import { BridgeTable } from './BridgeTable'
import { Hand } from './Hand'
import { AuctionPanel } from './AuctionPanel'
import { PlayView } from './PlayView'

const ALL_SEATS: Seat[] = ['N', 'E', 'S', 'W']

/**
 * Drives one problem: the auction (with answers accumulating), then either back
 * to the list (if not all four hands are known) or the play phase.
 */
export function ProblemView({
  problem,
  onExit,
}: {
  problem: Problem
  onExit: () => void
}) {
  const [answers, setAnswers] = useState<string[]>([])
  const [phase, setPhase] = useState<'auction' | 'play'>('auction')

  const canPlay = ALL_SEATS.every((s) => problem.deal[s] != null)

  if (phase === 'play') {
    return (
      <PlayView problem={problem} contract={finalContract(problem, answers)} />
    )
  }

  // Auction: only the hero's hand is shown; the rest are face down.
  return (
    <BridgeTable
      top={<Hand faceDown orientation="horizontal" />}
      left={<Hand faceDown orientation="west" />}
      right={<Hand faceDown orientation="east" />}
      bottom={<Hand hand={problem.deal.S} orientation="horizontal" />}
      center={
        <AuctionPanel
          key={answers.length}
          problem={problem}
          answers={answers}
          onAnswer={(c) => setAnswers((a) => [...a, c])}
          onPlay={() => setPhase('play')}
          onDone={onExit}
          canPlay={canPlay}
        />
      }
    />
  )
}
