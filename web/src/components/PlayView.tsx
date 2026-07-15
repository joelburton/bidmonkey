import { useEffect, useMemo, useRef, useState } from 'react'
import type { CardQuestion, Problem, Seat } from '../types'
import type { Contract } from '../bidding'
import { buildAuction } from '../bidding'
import type { Pos } from '../play'
import { flattenPlay, handRemaining, partnerOf, seatLayout, trickWinner } from '../play'
import { BridgeTable } from './BridgeTable'
import { Hand } from './Hand'
import { PlayCenter } from './PlayCenter'
import { AuctionTable } from './AuctionTable'

type Orientation = 'horizontal' | 'west' | 'east'
type Raise = 'up' | 'down' | 'left' | 'right'
const POS_ORIENT: Record<Pos, Orientation> = {
  bottom: 'horizontal',
  top: 'horizontal',
  left: 'west',
  right: 'east',
}
const POS_RAISE: Record<Pos, Raise> = {
  bottom: 'up',
  top: 'down',
  left: 'right',
  right: 'left',
}

/**
 * Play phase, oriented to the hero. Steps through the recorded play: auto-plays
 * cards (1s pause each), stops at questions for the hero, reveals the dummy
 * after the opening lead, and pauses for a click after any trick the hero didn't
 * play the last card to. When the recorded play runs out it reveals every hand.
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
  const hero = problem.hero
  const moves = useMemo(() => flattenPlay(problem.play ?? []), [problem])
  const trump = contract?.strain ?? 'NT'
  const declarer = contract?.declarer ?? hero
  const dummy = partnerOf(declarer)

  const [plays, setPlays] = useState<{ seat: Seat; card: string }[]>([])
  const [moveIndex, setMoveIndex] = useState(0)
  const [tableTrick, setTableTrick] = useState<{ seat: Seat; card: string }[]>([])
  const [dummyRevealed, setDummyRevealed] = useState(false)
  const [allRevealed, setAllRevealed] = useState(false)
  const [pending, setPending] = useState<{ seat: Seat; question: CardQuestion } | null>(null)
  const [review, setReview] = useState<Seat | null>(null)
  const [selected, setSelected] = useState<{ seat: Seat; card: string } | null>(null)
  const [playResult, setPlayResult] = useState<
    { correct: boolean; question: CardQuestion; card: string; seat: Seat } | null
  >(null)
  const [showAuction, setShowAuction] = useState(false)
  const lastHuman = useRef(false)

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
    void winner
  }

  useEffect(() => {
    if (plays.length >= 1) setDummyRevealed(true)
  }, [plays.length])

  // Completed trick: pause for a click unless the hero played the last card.
  useEffect(() => {
    if (tableTrick.length !== 4) return
    const winner = trickWinner(tableTrick, trump)
    if (lastHuman.current) {
      const t = setTimeout(() => proceed(winner), 1200)
      return () => clearTimeout(t)
    }
    setReview(winner)
  }, [tableTrick, trump])

  // Recorded-play engine.
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

  // A keypress does the same as the click we're waiting for: dismiss the answer
  // popup, or advance past a completed trick.
  useEffect(() => {
    if (!playResult && !review) return
    const onKey = () => {
      if (playResult) dismissPlayResult()
      else if (review) proceed(review)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playResult, review])

  // A hand is clickable when freely playing (all revealed) or when it's the seat
  // to act on an *enter_card* question. Multiple-choice questions are answered
  // with the option buttons, not by free card clicks.
  const clickable = (seat: Seat) =>
    allRevealed ||
    (pending?.seat === seat && pending.question.choiceType !== 'multiple_choice')
  const faceUp = (seat: Seat) =>
    seat === hero || allRevealed || (seat === dummy && dummyRevealed)
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

  const layout = seatLayout(hero) // seat -> position
  const seatAt = {} as Record<Pos, Seat>
  for (const s of Object.keys(layout) as Seat[]) seatAt[layout[s]] = s

  const hand = (seat: Seat) => handRemaining(problem.deal[seat] ?? {}, playedBy(seat))
  const sel = (seat: Seat) => (selected?.seat === seat ? selected.card : undefined)

  const slot = (pos: Pos) => {
    const seat = seatAt[pos]
    if (!faceUp(seat)) return <Hand faceDown orientation={POS_ORIENT[pos]} />
    return (
      <Hand
        hand={hand(seat)}
        orientation={POS_ORIENT[pos]}
        onPlay={clickable(seat) ? handleCard(seat) : undefined}
        selectedCard={sel(seat)}
        raise={POS_RAISE[pos]}
      />
    )
  }

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
        top={slot('top')}
        left={slot('left')}
        right={slot('right')}
        bottom={slot('bottom')}
        center={
          <PlayCenter
            problem={problem}
            contract={contract}
            trick={tableTrick}
            seatPos={layout}
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
