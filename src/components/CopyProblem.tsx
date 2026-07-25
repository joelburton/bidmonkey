import { useEffect, useRef, useState } from 'react'
import type { Problem } from '../types'
import { problemToText } from '../lib/problemText'

type State = 'idle' | 'copied' | 'failed'

/**
 * Copies the problem, written out as text (see lib/problemText.ts), to the
 * clipboard to paste into a Claude conversation.
 *
 * No preview panel: the clipboard is the whole point, so the button just does
 * it. That leaves nothing appearing on screen to confirm the tap, hence the
 * 1.4s fill — it borrows the flag's on-state look rather than inventing a third
 * one. A failed write says so instead of pretending; the text is gone and there
 * is no panel left to select it from by hand.
 */
export function CopyProblem({ problem, answers }: { problem: Problem; answers: string[] }) {
  const [state, setState] = useState<State>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The problem can be navigated away from mid-flash (Prev/Next remount this).
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const flash = (s: State) => {
    setState(s)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 1400)
  }

  const copy = () => {
    // writeText is called straight out of the click, with no await in front of
    // it: Safari only allows a clipboard write inside the gesture that asked
    // for it. The try/catch is for `navigator.clipboard` being absent, which is
    // what an insecure origin gives you — that throws rather than rejecting.
    try {
      navigator.clipboard.writeText(problemToText(problem, answers)).then(
        () => flash('copied'),
        () => flash('failed'),
      )
    } catch {
      flash('failed')
    }
  }

  const label =
    state === 'copied'
      ? 'Problem copied'
      : state === 'failed'
        ? 'Could not copy the problem'
        : 'Copy the problem, to paste into Claude'

  return (
    <button
      className={`id-btn info-btn${state === 'idle' ? '' : ` ${state}`}`}
      aria-label={label}
      aria-live="polite"
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={copy}
    >
      {/* U+FE0E forces text presentation: bare ✓ renders as an emoji on iOS,
          which ignores the colour the state is supposed to signal. */}
      {state === 'copied' ? '✓︎' : state === 'failed' ? '!' : 'i'}
    </button>
  )
}
