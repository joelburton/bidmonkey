import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import type { Problem, Suit } from '../types'
import type { Strain } from '../bidding'
import {
  buildAuction,
  doubleState,
  levelLegal,
  bidLegal,
  stripAlert,
  VUL_SHORT,
  LEVELS,
} from '../bidding'
import { SuitGlyph } from './SuitGlyph'
import { AuctionTable, CallText } from './AuctionTable'
import { Explanation } from './Explanation'
import { FlagButton } from './FlagButton'
import { ProblemInfo } from './ProblemInfo'
import { withSuits } from './suitText'
import { problemToText } from '../lib/problemText'
import { useTapDismiss } from '../tapDismiss'

const SUIT_ORDER: Strain[] = ['C', 'D', 'H', 'S']
const KEY_STRAIN: Record<string, Strain> = { c: 'C', d: 'D', h: 'H', s: 'S', n: 'NT' }
// Option hotkeys. Plain `f` stays an option letter — the flag toggle is Shift+F
// precisely so a six-option question can't collide with it.
const OPT_LETTERS = 'abcdef'

// Answer buttons must not take focus: otherwise a key pressed to dismiss the
// explanation popup also activates the still-focused button (Space/Enter) and
// reopens the popup. Preventing mousedown's default keeps focus off them.
const preventFocus = (e: MouseEvent) => e.preventDefault()

/**
 * Center during the auction. Controlled by ProblemView via `answers`/`onAnswer`.
 * Multiple-choice questions show a button per option; free bid questions
 * (choiceType 'free') show the bid pad. A 'text' question (answerKind 'text') is
 * a free-form multiple-choice — options are plain words, not calls. Every answer
 * shows the explanation popup; dismissing a correct answer advances the auction,
 * a wrong one lets you retry.
 *
 * Answering with anything but the preferred call also flags the problem for
 * review (`onFlagAnswer`), and the ⚑ button / `f` key flag it by hand.
 */
export function AuctionPanel({
  problem,
  answers,
  onAnswer,
  onPlay,
  onNext,
  hasNext,
  canPlay,
  flagged = false,
  onToggleFlag = () => {},
  onFlagAnswer = () => {},
  freeEntry = false,
  showId = false,
  onToggleShowId = () => {},
}: {
  problem: Problem
  answers: string[]
  onAnswer: (call: string) => void
  onPlay: () => void
  onNext: () => void
  hasNext: boolean
  canPlay: boolean
  // The flag props default to inert so tests can render the panel on its own;
  // ProblemView always passes them.
  flagged?: boolean
  onToggleFlag?: () => void
  onFlagAnswer?: (reason: 'wrong' | 'alternate') => void
  /** "Enter answers, don't choose": a multiple-choice question whose answer is
   * a *call* is shown on the bid pad instead, hiding the options that give the
   * game away. A 'text' question has no call to enter, so it ignores this. */
  freeEntry?: boolean
  /** Whether the problem id is revealed. Owned by ProblemView, because this
   * panel is remounted on every answer and the reveal must outlive that. */
  showId?: boolean
  onToggleShowId?: () => void
}) {
  const model = buildAuction(problem, answers)
  const q = model.question
  const isText = q?.answerKind === 'text'
  // Show the option buttons only for a question that has some *and* isn't being
  // demoted to free entry. Grading is untouched either way: doSubmit checks
  // whatever was entered against answer/accept exactly as before, and a typed
  // bid was already accepted on a bid MC (see the key handler), so this only
  // takes the list of options off the screen.
  const isMC = !!(
    q &&
    q.choiceType === 'multiple_choice' &&
    q.options?.length &&
    !(freeEntry && q.answerKind === 'bid')
  )
  const dbl = doubleState(model.prior, model.actingSeat)

  const [level, setLevel] = useState<number | null>(null)
  const [result, setResult] = useState<{
    correct: boolean
    alternate: boolean
    call: string
    answer: string
  } | null>(null)
  const [pressed, setPressed] = useState<string | null>(null)
  // Local, unlike showId: opening this can't advance the auction, so it never
  // has to survive the remount that answering causes.
  const [showInfo, setShowInfo] = useState(false)

  const doSubmit = useCallback((call: string) => {
    const cur = ref.current.model.question
    if (!cur) return
    // Bid/card answers may be alertable ("2D*"), so match ignoring the alert
    // marker; a text answer is graded as a trimmed exact string.
    const norm = (s: string) => (cur.answerKind === 'text' ? s.trim() : stripAlert(s))
    const entered = norm(call)
    const isCanonical = entered === norm(cur.answer)
    const isAccepted = cur.accept?.some((a) => norm(a) === entered) ?? false
    const correct = isCanonical || isAccepted
    // An accepted alternative is correct but not the canonical answer — marked
    // so the popup reads "Alternate" (orange) rather than "Correct!" (green).
    const alternate = correct && !isCanonical
    setResult({ correct, alternate, call, answer: cur.answer })
    setLevel(null)
    // Anything but the preferred answer goes on the review list. An accepted
    // alternative counts: it isn't wrong, but it isn't what this problem is
    // teaching either, so it's worth seeing again (recorded as 'alternate', so a
    // later pass can tell the two apart). Grading itself is unaffected.
    if (!correct) ref.current.onFlagAnswer('wrong')
    else if (alternate) ref.current.onFlagAnswer('alternate')
  }, [])
  const dismiss = useCallback(() => {
    const r = ref.current.result
    if (!r) return
    // Advance the auction with the canonical answer, even when the user picked
    // an accepted alternative (cur.accept): buildAuction replays the authored
    // continuation from `answers`, which assumes `answer` was bid. The click was
    // still graded correct (r.correct) — see PlayView for the same rule.
    if (r.correct) ref.current.onAnswer(r.answer)
    else setResult(null)
  }, [])
  // Tap anywhere on the popup or backdrop dismisses; a drag to scroll does not.
  const tapDismiss = useTapDismiss(dismiss)
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

  // Keyboard: any key dismisses the popup; a-f pick MC options; the pad keys
  // (1-7, c/d/h/s/n, p, x) drive a free bid — and also a *bid* MC (type "1c"),
  // in addition to its option letters.
  // The ref mirror is deliberate, not a leftover: the keydown listener is
  // registered once (deps below are the stable callbacks only) and reads fresh
  // state/props through ref.current instead of re-subscribing every render.
  // (PlayView takes the other route — a plain re-subscribing effect.)
  const ref = useRef({
    level,
    result,
    dbl,
    model,
    isMC,
    showInfo,
    onAnswer,
    onPlay,
    onNext,
    hasNext,
    canPlay,
    onToggleFlag,
    onFlagAnswer,
  })
  ref.current = {
    level,
    result,
    dbl,
    model,
    isMC,
    showInfo,
    onAnswer,
    onPlay,
    onNext,
    hasNext,
    canPlay,
    onToggleFlag,
    onFlagAnswer,
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = ref.current
      // Leave browser shortcuts alone — Cmd+C on the explanation text must not
      // dismiss the popup (checked before every branch on purpose).
      if (e.metaKey || e.ctrlKey || e.altKey) return
      // A bare modifier isn't "a key" for the any-key-dismisses rule below —
      // otherwise the Shift held for Shift+F would close the popup, and the F
      // would then land as a flag toggle.
      if (e.key === 'Shift' || e.key === 'CapsLock') return
      // The details panel swallows everything: it covers the auction, so a key
      // that fell through would enter a bid against a question the player can't
      // see. Escape closes it, as the Close button does.
      if (st.showInfo) {
        if (e.key === 'Escape') {
          setShowInfo(false)
          e.preventDefault()
        }
        return
      }
      // Shift+F flags/unflags this problem, in every auction state — but with the
      // answer popup up it only closes it, like any other key: a wrong answer has
      // just flagged the problem, so toggling here would silently undo that.
      // (Shift, not plain `f`, so a six-option question keeps its `f` letter.)
      if (e.shiftKey && e.key.toLowerCase() === 'f') {
        if (st.result) dismiss()
        else {
          st.onToggleFlag()
          flash('FLAG')
        }
        e.preventDefault()
        return
      }
      if (!st.model.actingSeat) {
        // Auction over: Space/Enter presses the primary button (Play if the hand
        // is playable, otherwise Next).
        if (e.key === 'Enter' || e.key === ' ') {
          if (st.canPlay) st.onPlay()
          else if (st.hasNext) st.onNext()
          e.preventDefault()
        }
        return
      }
      if (st.result) {
        dismiss()
        return
      }
      const k = e.key.toLowerCase()
      if (st.isMC) {
        const opts = st.model.question?.options ?? []
        // A bid MC also accepts a typed bid ("1c" for 1♣), like a free bid pad.
        // While a level is pending, keys route to the pad below so c/d read as
        // strains, not the option letters c/d.
        const bidMC = st.model.question?.answerKind === 'bid'
        if (!(bidMC && st.level != null)) {
          const idx = OPT_LETTERS.indexOf(k)
          if (idx >= 0 && idx < opts.length) {
            doSubmit(opts[idx])
            e.preventDefault()
            return
          }
        }
        if (!bidMC) return // a text MC has no bid to type
        // else fall through to the bid-pad keys below
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
        <span className="head-left">
          <FlagButton flagged={flagged} onToggle={onToggleFlag} pressed={pressed === 'FLAG'} />
          {/* Writes the whole problem out as text to paste into Claude. Sits
              between the two existing circles and matches them; like them it
              must not take focus, or the next keypress would re-open it. */}
          <button
            className="id-btn info-btn"
            aria-label="Show problem details"
            title="Problem details, to paste into Claude"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowInfo(true)}
          >
            i
          </button>
          {/* The id names the convention ("…-drury.3"), which hands over the
              answer, so it hides behind this toggle instead of sitting on the
              felt. Like every button here it must not take focus, or the next
              keypress would re-activate it instead of entering a bid. */}
          <button
            className="id-btn"
            aria-expanded={showId}
            aria-label={showId ? 'Hide problem id' : 'Show problem id'}
            title={showId ? 'Hide problem id' : 'Show problem id'}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onToggleShowId}
          >
            ?
          </button>
          {showId && <span className="problem-id">#{problem.slug}</span>}
        </span>
        {problem.vulnerability && <span>Vul: {VUL_SHORT[problem.vulnerability]}</span>}
      </div>

      <div className="auction-scroll">
        {/* A text answer is a phrase, not a call — don't render it into the
            auction grid's "?" cell while the popup is up. */}
        <AuctionTable
          cols={model.cols}
          grid={model.grid}
          entered={isText ? undefined : result?.call}
        />
      </div>

      {!model.actingSeat ? (
        <div className="bidpad">
          {canPlay ? (
            <div className="play-actions">
              <button className="play-btn" onClick={onPlay}>
                Play
              </button>
              <button className="play-btn" onClick={onNext} disabled={!hasNext}>
                Skip
              </button>
            </div>
          ) : (
            <>
              <div className="auction-done">Bidding complete.</div>
              <button className="play-btn" onClick={onNext} disabled={!hasNext}>
                Next ▸
              </button>
            </>
          )}
        </div>
      ) : isMC ? (
        <div className="bidpad">
          {/* Suit symbols in the prompt become SVG pips (withSuits), like the
              explanation text — Unicode ♠/♣ on the felt need a washed-out grey
              to stay readable, the outlined pips can be truly black. */}
          {q!.prompt && <div className="mc-prompt">{withSuits(q!.prompt)}</div>}
          <div className={`opt-grid${isText ? ' opt-grid-text' : ''}`}>
            {q!.options!.map((opt, i) => (
              <button
                key={opt}
                className={`opt-btn${isText ? ' opt-btn-text' : ''}`}
                onMouseDown={preventFocus}
                onClick={() => doSubmit(opt)}
              >
                <span className="opt-letter">{OPT_LETTERS[i]}</span>
                {isText ? opt : <CallText call={opt} />}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="bidpad">
          {/* Free bid entry carries a prompt too, when the problem needs standing
              context the auction can't show — e.g. a chapter that starts at
              partner's RKCB 4NT with the trump-agreeing auction left unseen. */}
          {q!.prompt && <div className="mc-prompt">{withSuits(q!.prompt)}</div>}
          <div className="bid-grid">
            {LEVELS.map((l) => (
              <button
                key={l}
                className={`bid-btn ${level === l ? 'sel' : ''} ${
                  pressed === `L${l}` ? 'pressed' : ''
                }`}
                disabled={!levelLegal(l, model.priorCalls)}
                onMouseDown={preventFocus}
                onClick={() => setLevel(l)}
              >
                {l}
              </button>
            ))}
            <button
              className={`bid-btn ${pressed === 'NT' ? 'pressed' : ''}`}
              disabled={level != null && !bidLegal(level, 'NT', model.priorCalls)}
              onMouseDown={preventFocus}
              onClick={() => pickStrain('NT')}
            >
              NT
            </button>
            {SUIT_ORDER.map((s) => (
              <button
                key={s}
                className={`bid-btn ${pressed === `S${s}` ? 'pressed' : ''}`}
                disabled={level != null && !bidLegal(level, s, model.priorCalls)}
                onMouseDown={preventFocus}
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
              onMouseDown={preventFocus}
              onClick={() => dbl && doSubmit(dbl === 'redouble' ? 'XX' : 'X')}
            >
              {dbl === 'redouble' ? 'Redouble' : 'Double'}
            </button>
            <button
              className={`bid-btn ${pressed === 'PASS' ? 'pressed' : ''}`}
              onMouseDown={preventFocus}
              onClick={() => doSubmit('P')}
            >
              Pass
            </button>
          </div>
        </div>
      )}

      {showInfo && (
        <ProblemInfo text={problemToText(problem, answers)} onClose={() => setShowInfo(false)} />
      )}

      {result && q && (
        <>
          <div className="explain-backdrop" {...tapDismiss} />
          <div className="explain-popup" role="dialog" aria-label="Answer" {...tapDismiss}>
            <div
              className={`explain-status ${
                result.alternate ? 'alt' : result.correct ? 'ok' : 'no'
              }`}
            >
              {result.alternate ? 'Alternate' : result.correct ? 'Correct!' : 'Not quite'}
            </div>
            {q.explanation && <Explanation text={q.explanation} />}
            <p className="explain-answer">
              Answer: {isText ? q.answer : <CallText call={q.answer} />}
              {!!q.accept?.length && (
                <>
                  {' '}
                  (accepted:{' '}
                  {q.accept.map((a, i) => (
                    <span key={a}>
                      {i > 0 ? ', ' : ''}
                      {isText ? a : <CallText call={a} />}
                    </span>
                  ))}
                  )
                </>
              )}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
