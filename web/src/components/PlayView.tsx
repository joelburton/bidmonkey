import { useEffect, useMemo, useRef, useState } from 'react'
import type { CardQuestion, Problem, Seat } from '../types'
import { SEAT_NAME } from '../types'
import type { Contract } from '../bidding'
import { flattenPlay, handRemaining, partnerOf, trickWinner } from '../play'
import { BridgeTable } from './BridgeTable'
import { Hand } from './Hand'
import { PlayCenter } from './PlayCenter'

const ALL_SEATS: Seat[] = ['N', 'E', 'S', 'W']

/**
 * Play phase. Steps through the recorded play: auto-plays cards (1s pause each),
 * stops at questions for the hero, reveals the dummy after the opening lead, and
 * pauses for a click after an all-auto trick. When the recorded play runs out it
 * reveals every hand for free study/play.
 */
export function PlayView({
  problem,
  contract,
}: {
  problem: Problem
  contract: Contract | null
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
  const [wrong, setWrong] = useState<CardQuestion | null>(null)
  const [review, setReview] = useState<Seat | null>(null) // winner of an all-auto trick, awaiting a click
  const trickHadInput = useRef(false)

  const playedBy = (seat: Seat) =>
    plays.filter((p) => p.seat === seat).map((p) => p.card)

  const playCard = (seat: Seat, card: string) => {
    setPlays((p) => [...p, { seat, card }])
    setTableTrick((t) => [...t, { seat, card }])
  }

  const proceed = (winner: Seat) => {
    setTableTrick([])
    setReview(null)
    trickHadInput.current = false
    void winner // winner leads next; free-play doesn't enforce turn order
  }

  // Reveal the dummy once the opening lead hits the table.
  useEffect(() => {
    if (plays.length >= 1) setDummyRevealed(true)
  }, [plays.length])

  // A completed trick: pause for a click if it was all auto, else auto-clear.
  useEffect(() => {
    if (tableTrick.length !== 4) return
    const winner = trickWinner(tableTrick, trump)
    if (trickHadInput.current) {
      const t = setTimeout(() => proceed(winner), 1200)
      return () => clearTimeout(t)
    }
    setReview(winner)
  }, [tableTrick, trump])

  // Recorded-play engine: auto-play cards, stop at questions, then reveal all.
  useEffect(() => {
    if (allRevealed || review || pending || wrong) return
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
      playCard(move.seat, move.card!)
      setMoveIndex((i) => i + 1)
    }, 1000)
    return () => clearTimeout(t)
  }, [moveIndex, allRevealed, review, pending, wrong, tableTrick.length, moves])

  const answerPlay = (card: string) => {
    if (!pending) return
    const q = pending.question
    const ok = card === q.answer || q.accept?.includes(card)
    if (!ok) {
      setWrong(q)
      return
    }
    trickHadInput.current = true
    setPending(null)
    playCard(pending.seat, card)
    setMoveIndex((i) => i + 1)
  }

  const sandboxPlay = (seat: Seat) => (card: string) => {
    if (tableTrick.length >= 4) return
    trickHadInput.current = true
    playCard(seat, card)
  }

  // South is always at the bottom. The dummy is shown horizontally (never in a
  // rotated rail): at the top when it isn't us, otherwise the top shows North
  // (declarer / partner across). The remaining two seats fill the side rails.
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

  const southOnPlay = allRevealed
    ? sandboxPlay('S')
    : pending?.seat === 'S'
      ? answerPlay
      : undefined

  const tag = (seat: Seat, role?: string) => (
    <div className="seat-tag">
      {SEAT_NAME[seat]}
      {role ? ` · ${role}` : ''}
    </div>
  )

  return (
    <>
      <BridgeTable
        className={allRevealed ? 'revealed' : ''}
        top={
          <div className="seat-slot">
            {tag(topSeat, topSeat === dummy ? 'dummy' : undefined)}
            {topFaceUp ? (
              <Hand
                hand={hand(topSeat)}
                orientation="horizontal"
                onPlay={allRevealed ? sandboxPlay(topSeat) : undefined}
              />
            ) : (
              <Hand faceDown orientation="horizontal" />
            )}
          </div>
        }
        left={
          allRevealed ? (
            <div className="seat-slot">
              {tag(leftSeat)}
              <Hand hand={hand(leftSeat)} orientation="west" onPlay={sandboxPlay(leftSeat)} />
            </div>
          ) : (
            <Hand faceDown orientation="west" />
          )
        }
        right={
          allRevealed ? (
            <div className="seat-slot">
              {tag(rightSeat)}
              <Hand hand={hand(rightSeat)} orientation="east" onPlay={sandboxPlay(rightSeat)} />
            </div>
          ) : (
            <Hand faceDown orientation="east" />
          )
        }
        bottom={
          <div className="seat-slot">
            {tag('S', 'you')}
            <Hand hand={hand('S')} orientation="horizontal" onPlay={southOnPlay} />
          </div>
        }
        center={
          <PlayCenter
            problem={problem}
            contract={contract}
            trick={tableTrick}
            seatPos={seatPos}
            wrong={wrong}
            onDismissWrong={() => setWrong(null)}
            message={
              wrong
                ? undefined
                : pending?.seat === 'S'
                  ? (pending.question.prompt ?? 'Your turn')
                  : review
                    ? 'Tap to continue'
                    : allRevealed
                      ? 'All hands shown — play freely'
                      : undefined
            }
          />
        }
      />

      {review && (
        <div className="review-catch" onClick={() => proceed(review)} />
      )}
    </>
  )
}
