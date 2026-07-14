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

// Keyboard → strain.
const KEY_STRAIN: Record<string, Strain> = {
  c: 'C',
  d: 'D',
  h: 'H',
  s: 'S',
  n: 'NT',
}

/** Render explanation text, coloring red suits (♥ ♦) red and black suits (♠ ♣)
 * light so both read on the dark popup. The ︎ forces text (non-emoji)
 * presentation so the color reliably applies. */
function withSuits(text: string) {
  const TEXT_PRESENTATION = '︎' // force non-emoji rendering so color applies
  return text.split(/([♥♦♠♣])/).map((part, i) => {
    if (part === '♥' || part === '♦')
      return (
        <span key={i} className="suit-red-text">
          {part + TEXT_PRESENTATION}
        </span>
      )
    if (part === '♠' || part === '♣')
      return (
        <span key={i} className="suit-black-text">
          {part + TEXT_PRESENTATION}
        </span>
      )
    return <span key={i}>{part}</span>
  })
}

/**
 * The center panel: problem id + vulnerability, the auction table with a "?" at
 * the seat to act, and a bid-entry pad. Entering a bid checks it against the
 * answer; an explanation popup appears (over the panel, cards still visible).
 */
export function AuctionPanel({ problem }: { problem: Problem }) {
  const model = buildAuction(problem)
  const [level, setLevel] = useState<number | null>(null)
  const [entered, setEntered] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [pressed, setPressed] = useState<string | null>(null)

  const q = model.question
  const dbl = doubleState(model.prior, model.actingSeat)
  const isCorrect = !!(
    entered &&
    q &&
    (entered === q.answer || q.accept?.includes(entered))
  )

  const commit = useCallback((call: string) => {
    setEntered(call)
    setLevel(null)
    setShowResult(true)
  }, [])
  const pickStrain = (s: Strain) => {
    if (level == null || !bidLegal(level, s, model.priorCalls)) return
    commit(`${level}${s}`)
  }

  // Briefly light up a button id, as if it were pressed.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flash = useCallback((id: string) => {
    setPressed(id)
    if (pressTimer.current) clearTimeout(pressTimer.current)
    pressTimer.current = setTimeout(() => setPressed(null), 150)
  }, [])

  // Keyboard bidding. Latest state is read through a ref so the listener binds
  // once. Keys: 1-7 (level), c/d/h/s/n (strain), p (pass), x (double/redouble).
  const stateRef = useRef({ level, showResult, dbl, model })
  stateRef.current = { level, showResult, dbl, model }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { level, showResult, dbl, model } = stateRef.current
      if (!model.actingSeat) return
      // Any keystroke dismisses the answer popup (and nothing else).
      if (showResult) {
        setShowResult(false)
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
          commit(`${level}${s}`)
          flash(s === 'NT' ? 'NT' : `S${s}`)
        }
        e.preventDefault()
      } else if (k === 'p') {
        commit('P')
        flash('PASS')
        e.preventDefault()
      } else if (k === 'x') {
        if (dbl) {
          commit(dbl === 'redouble' ? 'XX' : 'X')
          flash('DBL')
        }
        e.preventDefault()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [commit, flash])

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

      {model.actingSeat && (
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
              onClick={() => dbl && commit(dbl === 'redouble' ? 'XX' : 'X')}
            >
              {dbl === 'redouble' ? 'Redouble' : 'Double'}
            </button>
            <button
              className={`bid-btn ${pressed === 'PASS' ? 'pressed' : ''}`}
              onClick={() => commit('P')}
            >
              Pass
            </button>
          </div>
        </div>
      )}

      {showResult && q && (
        <>
          <div className="explain-backdrop" onClick={() => setShowResult(false)} />
          <div className="explain-popup" role="dialog" aria-label="Answer">
            <div className={`explain-status ${isCorrect ? 'ok' : 'no'}`}>
              {isCorrect ? 'Correct!' : 'Not quite'}
            </div>
            {q.explanation && (
              <p className="explain-body">{withSuits(q.explanation)}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
