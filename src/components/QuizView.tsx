import type { Quiz } from '../types'
import { FlagIcon } from './FlagButton'

/**
 * One quiz's start screen: what it is (title + the source it came from), and the
 * ways to run it — in order, shuffled, just the flagged ones, or as a printable
 * PDF. The quizzes list is only a list now; every start button lives here.
 */
export function QuizView({
  quiz,
  sourceTitle,
  flaggedCount,
  onStart,
  onFlagged,
  onPdf,
}: {
  quiz: Quiz
  /** The source's display title, or undefined for a quiz with no source. */
  sourceTitle?: string
  /** How many of this quiz's problems are flagged for review. */
  flaggedCount: number
  onStart: (mode: 'order' | 'random') => void
  onFlagged: () => void
  onPdf: () => void
}) {
  const count = quiz.problemSlugs.length
  const empty = count === 0
  return (
    <div className="quiz-view">
      <h2 className="source-head-title">{quiz.title}</h2>
      <div className="quiz-view-sub">
        {sourceTitle && <span>{sourceTitle}</span>}
        <span className="chip">
          {count} problem{count === 1 ? '' : 's'}
        </span>
      </div>
      <div className="quiz-view-actions">
        <button className="quiz-btn" disabled={empty} onClick={() => onStart('order')}>
          In Order
        </button>
        <button className="quiz-btn" disabled={empty} onClick={() => onStart('random')}>
          Random
        </button>
        <button
          className="quiz-btn source-flagged"
          disabled={flaggedCount === 0}
          onClick={onFlagged}
          title="Retest this quiz's flagged problems, in random order"
        >
          <FlagIcon filled={flaggedCount > 0} /> Flagged ({flaggedCount})
        </button>
        <button
          className="quiz-btn"
          disabled={empty}
          onClick={onPdf}
          title="Download a printable PDF of this quiz"
        >
          PDF
        </button>
      </div>
    </div>
  )
}
