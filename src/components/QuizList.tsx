import type { Quiz, Source } from '../types'
import { FlagIcon } from './FlagButton'

/** The quizzes within a chosen source: a plain list — tapping one opens its start
 * screen (`QuizView`), which is where In Order / Random / Flagged / PDF live. The
 * header above offers the two source-wide runs: **Random** across every problem
 * in the source, and **Flagged** across the ones on the review list. */
export function QuizList({
  source,
  problemCount,
  flaggedCount,
  quizzes,
  onSelect,
  onRandomSource,
  onFlaggedSource,
}: {
  source: Source
  problemCount: number
  /** How many of this source's problems are flagged for review. */
  flaggedCount: number
  quizzes: Quiz[]
  onSelect: (slug: string) => void
  onRandomSource: () => void
  onFlaggedSource: () => void
}) {
  return (
    <>
      <div className="source-head">
        <h2 className="source-head-title">{source.title}</h2>
        <div className="source-head-actions">
          <button
            className="quiz-btn source-random"
            disabled={problemCount === 0}
            onClick={onRandomSource}
            title="Start a random run over every problem in this source"
          >
            🎲 Random ({problemCount})
          </button>
          <button
            className="quiz-btn source-flagged"
            disabled={flaggedCount === 0}
            onClick={onFlaggedSource}
            title="Retest this source's flagged problems, in random order"
          >
            <FlagIcon filled={flaggedCount > 0} /> Flagged ({flaggedCount})
          </button>
        </div>
      </div>
      <ul className="problem-list">
        {quizzes.map((q) => (
          <li key={q.slug}>
            <button className="problem-row" onClick={() => onSelect(q.slug)}>
              <div className="problem-row-main">
                <span className="problem-title">{q.title}</span>
                <div className="problem-meta">
                  <span className="chip">
                    {q.problemSlugs.length} problem{q.problemSlugs.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
              <span className="problem-chevron" aria-hidden>
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
