import { useEffect, useMemo, useRef, useState } from 'react'
import type { CardQuestion, Problem, Seat } from '../types'
import type { Contract } from '../bidding'
import { buildAuction } from '../bidding'
import type { Pos } from '../play'
import { seatLayout } from '../play'
import {
  flattenPlay,
  handRemaining,
  handToCards,
  isLegalPlay,
  nextSeat,
  partnerOf,
  seatToAct,
  trickWinner,
} from '../lib/play'
import { BridgeTable } from './BridgeTable'
import { Hand } from './Hand'
import { PlayCenter } from './PlayCenter'
import { AuctionTable } from './AuctionTable'

// Hotkeys for the multiple-choice option buttons (matches their labels and the
// auction's a–d keys).
const OPT_LETTERS = 'abcdef'

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

// Rotate the base down-arrow so it points outward at the hand in each position.
const ARROW_ROT: Record<Pos, number> = { bottom: 0, top: 180, left: 90, right: -90 }

/** An arrow next to a hand, pointing at it, shown when that seat is expected to
 * play a card (an enter-card question, or its turn in free play). */
function PlayArrow({ pos }: { pos: Pos }) {
  return (
    <span className={`play-arrow play-arrow-${pos}`}>
      <svg
        viewBox="0 0 24 24"
        role="img"
        aria-label="play from this hand"
        style={{ transform: `rotate(${ARROW_ROT[pos]}deg)` }}
      >
        <path
          d="M12 4 L12 17 M6 12 L12 18 L18 12"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
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
  onNext,
  hasNext,
}: {
  problem: Problem
  contract: Contract | null
  answers: string[]
  onNext: () => void
  hasNext: boolean
}) {
  const hero = problem.hero
  const moves = useMemo(() => flattenPlay(problem.play ?? []), [problem])
  const trump = contract?.strain ?? 'NT'
  const declarer = contract?.declarer ?? hero
  const dummy = partnerOf(declarer)
  // Are all four hands known? A "what's your lead" / "win this trick" problem
  // gives only the hero's hand (plus the specific cards authored in the play), so
  // once the record runs out we simply stop — no dummy reveal, no free play, no
  // revealing hands we don't have.
  const fullDeal = (['N', 'E', 'S', 'W'] as Seat[]).every((s) => problem.deal[s] != null)

  const [plays, setPlays] = useState<{ seat: Seat; card: string }[]>([])
  const [moveIndex, setMoveIndex] = useState(0)
  const [tableTrick, setTableTrick] = useState<{ seat: Seat; card: string }[]>([])
  // Who leads the current trick: the opening leader (declarer's LHO) to start,
  // then the winner of each completed trick. With the cards already down this
  // gives whose turn it is, so free play can only proceed clockwise, in order.
  const [leader, setLeader] = useState<Seat>(nextSeat(declarer))
  const [dummyRevealed, setDummyRevealed] = useState(false)
  const [allRevealed, setAllRevealed] = useState(false)
  const [done, setDone] = useState(false) // recorded play exhausted — offer "Next"
  const [pending, setPending] = useState<{ seat: Seat; question: CardQuestion } | null>(null)
  const [review, setReview] = useState<Seat | null>(null)
  const [selected, setSelected] = useState<{ seat: Seat; card: string } | null>(null)
  const [playResult, setPlayResult] = useState<
    { correct: boolean; alternate: boolean; question: CardQuestion; card: string; seat: Seat } | null
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
    setLeader(winner) // the trick winner leads the next one
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
      // With every hand known, reveal them all for free study; otherwise the
      // record is all we have, so just stop where it ends. Either way the play
      // is over — offer "Next".
      if (fullDeal) setAllRevealed(true)
      setDone(true)
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
  }, [moveIndex, allRevealed, review, pending, playResult, tableTrick.length, moves, fullDeal])

  const answerPlay = (card: string) => {
    if (!pending) return
    const q = pending.question
    const isCanonical = card === q.answer
    const correct = isCanonical || (q.accept?.includes(card) ?? false)
    // Accepted but non-canonical: shown as "Alternate" (orange), not "Correct!".
    const alternate = correct && !isCanonical
    setPlayResult({ correct, alternate, question: q, card, seat: pending.seat })
  }
  const dismissPlayResult = () => {
    const r = playResult
    setPlayResult(null)
    setSelected(null)
    if (r?.correct) {
      setPending(null)
      // Always continue with the canonical answer, even if the user picked an
      // accepted alternative (q.accept): the recorded continuation was authored
      // around `answer`, so playing the clicked card instead would desync the
      // rest of the hand (trick winner, whose turn, cards remaining). The click
      // was still graded correct (r.correct) — a future scoring/attempts feature
      // keys off that boolean, not off which card landed, so the player is not
      // dinged for choosing an alternative.
      playCard(r.seat, r.question.answer, true)
      setMoveIndex((i) => i + 1)
    }
  }

  const pendingMC =
    pending && pending.question.choiceType === 'multiple_choice'
      ? pending.question.options
      : undefined

  // A keypress does the same as the click we're waiting for: dismiss the answer
  // popup, advance past a completed trick, (a–d, as in the auction) pick a
  // multiple-choice option, or — once the play is over — press "Next".
  useEffect(() => {
    if (!playResult && !review && !pendingMC && !done) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return // leave browser shortcuts alone
      if (playResult) dismissPlayResult()
      else if (review) proceed(review)
      else if (pendingMC) {
        const idx = OPT_LETTERS.indexOf(e.key.toLowerCase())
        if (idx >= 0 && idx < pendingMC.length) {
          answerPlay(pendingMC[idx])
          e.preventDefault()
        }
      } else if (done && (e.key === 'Enter' || e.key === ' ')) {
        if (hasNext) onNext()
        e.preventDefault()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playResult, review, pendingMC, done])

  // The seat on turn during free play: clockwise from the trick's leader. Only
  // its hand is clickable, so free play can't jump seats or play out of order.
  const toAct = seatToAct(leader, tableTrick)

  // A hand is clickable when it's that seat's turn in free play (and the trick
  // isn't already full), or when it's the seat to act on an *enter_card*
  // question. Multiple-choice questions are answered with the option buttons.
  const clickable = (seat: Seat) =>
    (allRevealed && tableTrick.length < 4 && seat === toAct) ||
    (pending?.seat === seat && pending.question.choiceType !== 'multiple_choice')
  const faceUp = (seat: Seat) =>
    seat === hero ||
    allRevealed ||
    (seat === dummy && dummyRevealed && problem.deal[dummy] != null)
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
  // Backs to show for a concealed hand: the real remaining count when we know the
  // hand, else 13 minus whatever that seat has played (so an unknown opponent
  // still shows a plausible fan rather than nothing).
  const faceDownCount = (seat: Seat) =>
    problem.deal[seat] != null ? handToCards(hand(seat)).length : 13 - playedBy(seat).length
  const sel = (seat: Seat) => (selected?.seat === seat ? selected.card : undefined)
  // Follow-suit rule: of the clickable hand, only cards legal against the
  // current trick respond. Applies to free play and enter-card questions alike.
  const canPlay = (seat: Seat) => (card: string) =>
    isLegalPlay(hand(seat), tableTrick, card)

  const slot = (pos: Pos) => {
    const seat = seatAt[pos]
    if (!faceUp(seat))
      return (
        <Hand faceDown count={faceDownCount(seat)} orientation={POS_ORIENT[pos]} />
      )
    const playable = clickable(seat)
    return (
      <>
        <Hand
          hand={hand(seat)}
          orientation={POS_ORIENT[pos]}
          onPlay={playable ? handleCard(seat) : undefined}
          canPlay={playable ? canPlay(seat) : undefined}
          selectedCard={sel(seat)}
          raise={POS_RAISE[pos]}
        />
        {playable && <PlayArrow pos={pos} />}
      </>
    )
  }

  // Whose turn it is to play is shown by an arrow at that hand (see PlayArrow,
  // driven by `clickable`), not by center text. A question's authored prompt
  // still shows (a multiple-choice question falls back to "Your turn"); the
  // "tap to continue" / "all hands shown" statuses are gone — needless, and they
  // reserved vertical space.
  const message =
    !playResult && pending
      ? (pending.question.prompt ??
        (pending.question.choiceType === 'multiple_choice' ? 'Your turn' : undefined))
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
            showNext={done}
            onNext={onNext}
            hasNext={hasNext}
          />
        }
      />

      {review && <div className="review-catch" onClick={() => proceed(review)} />}

      {showAuction && (
        <>
          <div className="explain-backdrop" onClick={() => setShowAuction(false)} />
          <div className="auction-overlay">
            {problem.auction.length ? (
              <AuctionTable cols={am.cols} grid={am.grid} />
            ) : (
              <div className="no-auction">No auction supplied</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
