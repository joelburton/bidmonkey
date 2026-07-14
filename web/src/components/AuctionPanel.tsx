import { useCallback, useEffect, useRef, useState } from 'react'
import type { Problem, Suit } from '../types'
import type { Strain } from '../bidding'
import {
  buildAuction,
  doubleState,
  levelLegal,
  bidLegal,
  VUL_SHORT,
  LEVELS,
} from '../bidding'
import { SuitGlyph } from './SuitGlyph'
import { AuctionTable, CallText } from './AuctionTable'
import { withSuits } from './suitText'

const SUIT_ORDER: Strain[] = ['C', 'D', 'H', 'S']
const KEY_STRAIN: Record<string, Strain> = { c: 'C', d: 'D', h: 'H', s: 'S', n: 'NT' }
const OPT_LETTERS = 'abcdef'

/**
 * Center during the auction. Controlled by ProblemView via `answers`/`onAnswer`.
 * Multiple-choice questions show a button per option; free (enter_bid) questions
 * show the bid pad. Every answer shows the explanation popup; dismissing a
 * correct answer advances the auction, a wrong one lets you retry.
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
  const q = model.question
  const isMC = !!(q && q.choiceType === 'multiple_choice' && q.options?.length)
  const dbl = doubleState(model.prior, model.actingSeat)

  const [level, setLevel] = useState<number | null>(null)
  const [result, setResult] = useState<{ correct: boolean; call: string } | null>(null)
  const [pressed, setPressed] = useState<string | null>(null)

  const doSubmit = useCallback((call: string) => {
    const cur = ref.current.model.question
    if (!cur) return
    const correct = call === cur.answer || (cur.accept?.includes(call) ?? false)
    setResult({ correct, call })
    setLevel(null)
  }, [])
  const dismiss = useCallback(() => {
    const r = ref.current.result
    if (!r) return
    if (r.correct) ref.current.onAnswer(r.call)
    else setResult(null)
  }, [])
  const pickStrain = (s: Strain) => {
    if (level == null || !bidLegal(level, s, model.priorCalls)) return
    doSubmit(`${level}${s}`)
  }

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flash = useCallback((id: string) => {
    setPressed(id)
    if (pressTimer.current) clearTimeout(pressTimer.current)
    pressTimer.current = setTimeout(() => setPressed(null), 150)
  }, [])

  // Keyboard: any key dismisses the popup; a-d pick MC options; the pad keys
  // (1-7, c/d/h/s/n, p, x) drive a free bid.
  const ref = useRef({ level, result, dbl, model, isMC, onAnswer })
  ref.current = { level, result, dbl, model, isMC, onAnswer }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = ref.current
      if (!st.model.actingSeat) return
      if (st.result) {
        dismiss()
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (st.isMC) {
        const opts = st.model.question?.options ?? []
        const idx = OPT_LETTERS.indexOf(k)
        if (idx >= 0 && idx < opts.length) {
          doSubmit(opts[idx])
          e.preventDefault()
        }
        return
      }
      if (k >= '1' && k <= '7') {
        const l = Number(k)
        if (levelLegal(l, st.model.priorCalls)) {
          setLevel(l)
          flash(`L${l}`)
        }
        e.preventDefault()
      } else if (k in KEY_STRAIN) {
        const s = KEY_STRAIN[k]
        if (st.level != null && bidLegal(st.level, s, st.model.priorCalls)) {
          doSubmit(`${st.level}${s}`)
          flash(s === 'NT' ? 'NT' : `S${s}`)
        }
        e.preventDefault()
      } else if (k === 'p') {
        doSubmit('P')
        flash('PASS')
        e.preventDefault()
      } else if (k === 'x') {
        if (st.dbl) {
          doSubmit(st.dbl === 'redouble' ? 'XX' : 'X')
          flash('DBL')
        }
        e.preventDefault()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [dismiss, doSubmit, flash])

  return (
    <div className="auction-panel">
      <div className="auction-head">
        <span>Problem {problem.id}</span>
        <span>Vul: {VUL_SHORT[problem.vulnerability]}</span>
      </div>

      <AuctionTable cols={model.cols} grid={model.grid} entered={result?.call} />

      {!model.actingSeat ? (
        <div className="bidpad">
          <button className="play-btn" onClick={canPlay ? onPlay : onDone}>
            {canPlay ? 'Play the hand ▸' : 'Back to problems'}
          </button>
        </div>
      ) : isMC ? (
        <div className="bidpad">
          <div className="opt-grid">
            {q!.options!.map((opt, i) => (
              <button key={opt} className="opt-btn" onClick={() => doSubmit(opt)}>
                <span className="opt-letter">{OPT_LETTERS[i]}</span>
                <CallText call={opt} />
              </button>
            ))}
          </div>
        </div>
      ) : (
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
              onClick={() => dbl && doSubmit(dbl === 'redouble' ? 'XX' : 'X')}
            >
              {dbl === 'redouble' ? 'Redouble' : 'Double'}
            </button>
            <button
              className={`bid-btn ${pressed === 'PASS' ? 'pressed' : ''}`}
              onClick={() => doSubmit('P')}
            >
              Pass
            </button>
          </div>
        </div>
      )}

      {result && q && (
        <>
          <div className="explain-backdrop" onClick={dismiss} />
          <div className="explain-popup" role="dialog" aria-label="Answer">
            <div className={`explain-status ${result.correct ? 'ok' : 'no'}`}>
              {result.correct ? 'Correct!' : 'Not quite'}
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
