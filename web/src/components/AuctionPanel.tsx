import { useCallback, useEffect, useRef, useState } from 'react'
import type { Problem, Suit } from '../types'
import { SEAT_NAME } from '../types'
import type { Strain } from '../bidding'
import {
  buildAuction,
  doubleState,
  levelLegal,
  bidLegal,
  parseBid,
  VUL_SHORT,
  LEVELS,
} from '../bidding'
import { SuitGlyph } from './SuitGlyph'
import { withSuits } from './suitText'

/** Render a single call (bid / pass / double) with a suit pip. */
function CallText({ call }: { call: string }) {
  if (call === 'P') return <>Pass</>
  if (call === 'X') return <>X</>
  if (call === 'XX') return <>XX</>
  const b = parseBid(call)
  if (!b) return <>{call}</>
  if (b.strain === 'NT') return <>{b.level}NT</>
  return (
    <>
      {b.level}
      <SuitGlyph suit={b.strain as Suit} />
    </>
  )
}

const SUIT_ORDER: Strain[] = ['C', 'D', 'H', 'S']
const KEY_STRAIN: Record<string, Strain> = { c: 'C', d: 'D', h: 'H', s: 'S', n: 'NT' }

/**
 * Center panel during the auction. Controlled by ProblemView: `answers` holds
 * the correct bids given so far; a right bid calls `onAnswer` (advancing the
 * auction), a wrong bid shows the explanation popup. When the auction is
 * complete it offers "Play the hand" (if all four hands are known) or a way back.
 */
export function AuctionPanel({
  problem,
  answers,
  onAnswer,
  onPlay,
  onDone,
  canPlay,
}: {
  problem: Problem
  answers: string[]
  onAnswer: (call: string) => void
  onPlay: () => void
  onDone: () => void
  canPlay: boolean
}) {
  const model = buildAuction(problem, answers)
  const [level, setLevel] = useState<number | null>(null)
  const [entered, setEntered] = useState<string | null>(null) // a wrong bid, shown in the "?"
  const [showResult, setShowResult] = useState(false)
  const [pressed, setPressed] = useState<string | null>(null)

  const q = model.question
  const dbl = doubleState(model.prior, model.actingSeat)

  const submit = useCallback(
    (call: string) => {
      if (!q) return
      const correct = call === q.answer || q.accept?.includes(call)
      if (correct) {
        onAnswer(call)
      } else {
        setEntered(call)
        setShowResult(true)
        setLevel(null)
      }
    },
    [q, onAnswer],
  )
  const pickStrain = (s: Strain) => {
    if (level == null || !bidLegal(level, s, model.priorCalls)) return
    submit(`${level}${s}`)
  }

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flash = useCallback((id: string) => {
    setPressed(id)
    if (pressTimer.current) clearTimeout(pressTimer.current)
    pressTimer.current = setTimeout(() => setPressed(null), 150)
  }, [])

  // Keyboard bidding. Latest values through a ref so the listener binds once.
  const ref = useRef({ level, showResult, dbl, model, submit })
  ref.current = { level, showResult, dbl, model, submit }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { level, showResult, dbl, model, submit } = ref.current
      if (!model.actingSeat) return
      if (showResult) {
        setShowResult(false)
        setEntered(null)
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k >= '1' && k <= '7') {
        const l = Number(k)
        if (levelLegal(l, model.priorCalls)) {
          setLevel(l)
          flash(`L${l}`)
        }
        e.preventDefault()
      } else if (k in KEY_STRAIN) {
        const s = KEY_STRAIN[k]
        if (level != null && bidLegal(level, s, model.priorCalls)) {
          submit(`${level}${s}`)
          flash(s === 'NT' ? 'NT' : `S${s}`)
        }
        e.preventDefault()
      } else if (k === 'p') {
        submit('P')
        flash('PASS')
        e.preventDefault()
      } else if (k === 'x') {
        if (dbl) {
          submit(dbl === 'redouble' ? 'XX' : 'X')
          flash('DBL')
        }
        e.preventDefault()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [flash])

  const dismiss = () => {
    setShowResult(false)
    setEntered(null)
  }

  return (
    <div className="auction-panel">
      <div className="auction-head">
        <span>Problem {problem.id}</span>
        <span>Vul: {VUL_SHORT[problem.vulnerability]}</span>
      </div>

      <table className="auction-table">
        <thead>
          <tr>
            {model.cols.map((c) => (
              <th key={c}>{SEAT_NAME[c]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {model.grid.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci}>
                  {cell?.question ? (
                    entered ? (
                      <CallText call={entered} />
                    ) : (
                      <span className="ask">?</span>
                    )
                  ) : cell?.call ? (
                    <CallText call={cell.call} />
                  ) : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {model.actingSeat ? (
        <div className="bidpad">
          <div className="bid-grid">
            {LEVELS.map((l) => (
              <button
                key={l}
                className={`bid-btn ${level === l ? 'sel' : ''} ${
                  pressed === `L${l}` ? 'pressed' : ''
                }`}
                disabled={!levelLegal(l, model.priorCalls)}
                onClick={() => setLevel(l)}
              >
                {l}
              </button>
            ))}
            <button
              className={`bid-btn ${pressed === 'NT' ? 'pressed' : ''}`}
              disabled={level != null && !bidLegal(level, 'NT', model.priorCalls)}
              onClick={() => pickStrain('NT')}
            >
              NT
            </button>
            {SUIT_ORDER.map((s) => (
              <button
                key={s}
                className={`bid-btn ${pressed === `S${s}` ? 'pressed' : ''}`}
                disabled={level != null && !bidLegal(level, s, model.priorCalls)}
                onClick={() => pickStrain(s)}
              >
                <SuitGlyph suit={s as Suit} />
              </button>
            ))}
          </div>
          <div className="bid-actions">
            <button
              className={`bid-btn ${pressed === 'DBL' ? 'pressed' : ''}`}
              disabled={!dbl}
              onClick={() => dbl && submit(dbl === 'redouble' ? 'XX' : 'X')}
            >
              {dbl === 'redouble' ? 'Redouble' : 'Double'}
            </button>
            <button
              className={`bid-btn ${pressed === 'PASS' ? 'pressed' : ''}`}
              onClick={() => submit('P')}
            >
              Pass
            </button>
          </div>
        </div>
      ) : (
        <div className="bidpad">
          <button className="play-btn" onClick={canPlay ? onPlay : onDone}>
            {canPlay ? 'Play the hand ▸' : 'Back to problems'}
          </button>
        </div>
      )}

      {showResult && q && (
        <>
          <div className="explain-backdrop" onClick={dismiss} />
          <div className="explain-popup" role="dialog" aria-label="Answer">
            <div className="explain-status no">Not quite</div>
            {q.explanation && (
              <p className="explain-body">{withSuits(q.explanation)}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
