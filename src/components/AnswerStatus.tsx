import type { ReactNode } from 'react'

/**
 * The verdict line at the top of the answer popup: what was entered, then how
 * it graded — "(A) 1NT — Not quite".
 *
 * Restating the choice matters because the popup covers the buttons that made
 * it, and on a wrong answer the auction hasn't moved, so nothing else on screen
 * records what was tried.
 *
 * The choice itself stays white while only the verdict takes the status colour:
 * green/orange/red is a judgement about the answer, not a property of it.
 */
export function AnswerStatus({
  correct,
  alternate,
  choice,
  letter,
}: {
  correct: boolean
  alternate: boolean
  /** What was entered, already rendered — a call, a card, or a plain phrase. */
  choice: ReactNode
  /** Its option letter, given only when the choice came from a visible list:
   * free entry (and a bid typed on the pad) has no letter to cite. */
  letter?: string
}) {
  return (
    <div className={`explain-status ${alternate ? 'alt' : correct ? 'ok' : 'no'}`}>
      <span className="explain-choice">
        {letter && <span className="explain-choice-letter">({letter})</span>}
        {choice}
      </span>
      {alternate ? 'Alternate' : correct ? 'Correct!' : 'Not quite'}
    </div>
  )
}
