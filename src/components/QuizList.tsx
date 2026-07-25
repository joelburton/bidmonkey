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
  flaggedIn,
  onSelect,
  onRandomSource,
  onFlaggedSource,
}: {
  source: Source
  problemCount: number
  /** How many of this source's problems are flagged for review. */
  flaggedCount: number
  quizzes: Quiz[]
  /** How many of these problem slugs are on the review list. App owns the flags,
   * so it answers this per row. */
  flaggedIn: (problemSlugs: string[]) => number
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
        {quizzes.map((q, i) => {
          const flagged = flaggedIn(q.problemSlugs)
          return (
            <li key={q.slug}>
              <button className="problem-row" onClick={() => onSelect(q.slug)}>
                <div className="problem-row-main">
                  {/* Numbered by position, which *is* the chapter order: quizzes
                      come back ordered by slug (repo.ts) and the importer names
                      them with a zero-padded chapter number, so row 3 is
                      chapter 3. Titles are clipped to ~22 chars on import, so a
                      number in front of one is what makes it findable. */}
                  <span className="problem-title">
                    {i + 1}: {q.title}
                  </span>
                  <div className="problem-meta">
                    <span className="chip">
                      {q.problemSlugs.length} problem{q.problemSlugs.length === 1 ? '' : 's'}
                    </span>
                    {/* Only when there's something to review — a red "0 flagged"
                        on every row would warn about nothing. */}
                    {flagged > 0 && <span className="chip chip-flagged">{flagged} flagged</span>}
                  </div>
                </div>
                <span className="problem-chevron" aria-hidden>
                  ›
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}
