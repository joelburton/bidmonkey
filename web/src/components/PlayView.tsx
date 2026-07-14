import { useEffect, useMemo, useRef, useState } from 'react'
import type { CardQuestion, Problem, Seat } from '../types'
import type { Contract } from '../bidding'
import { buildAuction } from '../bidding'
import { flattenPlay, handRemaining, partnerOf, trickWinner } from '../play'
import { BridgeTable } from './BridgeTable'
import { Hand } from './Hand'
import { PlayCenter } from './PlayCenter'
import { AuctionTable } from './AuctionTable'

const ALL_SEATS: Seat[] = ['N', 'E', 'S', 'W']
type Raise = 'up' | 'down' | 'left' | 'right'

/**
 * Play phase. Steps through the recorded play: auto-plays cards (1s pause each),
 * stops at questions for the hero, reveals the dummy after the opening lead, and
 * pauses for a click after any trick the hero didn't finish. When the recorded
 * play runs out it reveals every hand for free study/play.
 */
export function PlayView({
  problem,
  contract,
  answers,
}: {
  problem: Problem
  contract: Contract | null
  answers: string[]
}) {
  const moves = useMemo(() => flattenPlay(problem.play ?? []), [problem])
  const trump = contract?.strain ?? 'NT'
  const declarer = contract?.declarer ?? 'N'
  const dummy = partnerOf(declarer)

  const [plays, setPlays] = useState<{ seat: Seat; card: string }[]>([])
  const [moveIndex, setMoveIndex] = useState(0)
  const [tableTrick, setTableTrick] = useState<{ seat: Seat; card: string }[]>([])
  const [dummyRevealed, setDummyRevealed] = useState(false)
  const [allRevealed, setAllRevealed] = useState(false)
  const [pending, setPending] = useState<{ seat: Seat; question: CardQuestion } | null>(null)
  const [review, setReview] = useState<Seat | null>(null) // winner awaiting a click
  const [selected, setSelected] = useState<{ seat: Seat; card: string } | null>(null)
  const [playResult, setPlayResult] = useState<
    { correct: boolean; question: CardQuestion; card: string; seat: Seat } | null
  >(null)
  const [showAuction, setShowAuction] = useState(false)
  const lastHuman = useRef(false) // did a human play the most recent card?

  const playedBy = (seat: Seat) =>
    plays.filter((p) => p.seat === seat).map((p) => p.card)

  const playCard = (seat: Seat, card: string, byHuman: boolean) => {
    lastHuman.current = byHuman
    setPlays((p) => [...p, { seat, card }])
    setTableTrick((t) => [...t, { seat, card }])
  }
  const proceed = (winner: Seat) => {
    setTableTrick([])
    setReview(null)
    void winner // winner leads next; free play doesn't enforce turn order
  }

  useEffect(() => {
    if (plays.length >= 1) setDummyRevealed(true)
  }, [plays.length])

  // A completed trick: pause for a click unless the hero played the last card.
  useEffect(() => {
    if (tableTrick.length !== 4) return
    const winner = trickWinner(tableTrick, trump)
    if (lastHuman.current) {
      const t = setTimeout(() => proceed(winner), 1200)
      return () => clearTimeout(t)
    }
    setReview(winner)
  }, [tableTrick, trump])

  // Recorded-play engine: auto-play cards, stop at questions, then reveal all.
  useEffect(() => {
    if (allRevealed || review || pending || playResult) return
    if (tableTrick.length >= 4) return
    if (moveIndex >= moves.length) {
      setAllRevealed(true)
      return
    }
    const move = moves[moveIndex]
    if (move.question) {
      setPending({ seat: move.seat, question: move.question })
      return
    }
    const t = setTimeout(() => {
      playCard(move.seat, move.card!, false)
      setMoveIndex((i) => i + 1)
    }, 1000)
    return () => clearTimeout(t)
  }, [moveIndex, allRevealed, review, pending, playResult, tableTrick.length, moves])

  const answerPlay = (card: string) => {
    if (!pending) return
    const q = pending.question
    const correct = card === q.answer || (q.accept?.includes(card) ?? false)
    setPlayResult({ correct, question: q, card, seat: pending.seat })
  }
  const dismissPlayResult = () => {
    const r = playResult
    setPlayResult(null)
    setSelected(null)
    if (r?.correct) {
      setPending(null)
      playCard(r.seat, r.card, true)
      setMoveIndex((i) => i + 1)
    }
  }

  const clickable = (seat: Seat) => allRevealed || pending?.seat === seat
  const commitCard = (seat: Seat, card: string) => {
    if (allRevealed) playCard(seat, card, true)
    else if (pending?.seat === seat) answerPlay(card)
  }
  const handleCard = (seat: Seat) => (card: string) => {
    if (selected && selected.seat === seat && selected.card === card) {
      setSelected(null)
      commitCard(seat, card)
    } else {
      setSelected({ seat, card })
    }
  }

  // Layout: South at the bottom; the dummy is always horizontal (top unless it's
  // us, in which case North is on top); the other two seats are the rails.
  const topSeat = dummy !== 'S' ? dummy : partnerOf('S')
  const topFaceUp = allRevealed || (topSeat === dummy && dummyRevealed)
  const others = ALL_SEATS.filter((s) => s !== 'S' && s !== topSeat)
  const [leftSeat, rightSeat] = others

  const seatPos = {} as Record<Seat, 'top' | 'bottom' | 'left' | 'right'>
  seatPos.S = 'bottom'
  seatPos[topSeat] = 'top'
  seatPos[leftSeat] = 'left'
  seatPos[rightSeat] = 'right'

  const hand = (seat: Seat) => handRemaining(problem.deal[seat] ?? {}, playedBy(seat))
  const sel = (seat: Seat) => (selected?.seat === seat ? selected.card : undefined)

  const railHand = (seat: Seat, orientation: 'west' | 'east', raise: Raise) =>
    allRevealed ? (
      <Hand
        hand={hand(seat)}
        orientation={orientation}
        onPlay={handleCard(seat)}
        selectedCard={sel(seat)}
        raise={raise}
      />
    ) : (
      <Hand faceDown orientation={orientation} />
    )

  const pendingMC =
    pending && pending.question.choiceType === 'multiple_choice'
      ? pending.question.options
      : undefined

  const message = playResult
    ? undefined
    : pending
      ? (pending.question.prompt ?? 'Your turn')
      : review
        ? 'Tap to continue'
        : allRevealed
          ? 'All hands shown — play freely'
          : undefined

  const am = buildAuction(problem, answers)

  return (
    <div className="play-root" onClick={() => setSelected(null)}>
      <BridgeTable
        className={allRevealed ? 'revealed' : ''}
        top={
          topFaceUp ? (
            <Hand
              hand={hand(topSeat)}
              orientation="horizontal"
              onPlay={clickable(topSeat) ? handleCard(topSeat) : undefined}
              selectedCard={sel(topSeat)}
              raise="down"
            />
          ) : (
            <Hand faceDown orientation="horizontal" />
          )
        }
        left={railHand(leftSeat, 'west', 'right')}
        right={railHand(rightSeat, 'east', 'left')}
        bottom={
          <Hand
            hand={hand('S')}
            orientation="horizontal"
            onPlay={clickable('S') ? handleCard('S') : undefined}
            selectedCard={sel('S')}
            raise="up"
          />
        }
        center={
          <PlayCenter
            problem={problem}
            contract={contract}
            trick={tableTrick}
            seatPos={seatPos}
            message={message}
            options={playResult ? undefined : pendingMC}
            onOption={(c) => answerPlay(c)}
            onContractClick={() => setShowAuction(true)}
            result={playResult}
            onDismissResult={dismissPlayResult}
          />
        }
      />

      {review && <div className="review-catch" onClick={() => proceed(review)} />}

      {showAuction && (
        <>
          <div className="explain-backdrop" onClick={() => setShowAuction(false)} />
          <div className="auction-overlay">
            <AuctionTable cols={am.cols} grid={am.grid} />
          </div>
        </>
      )}
    </div>
  )
}
