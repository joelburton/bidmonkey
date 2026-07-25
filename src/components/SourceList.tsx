import type { Source } from '../types'
import { FlagIcon } from './FlagButton'

/** Top-level list: the sources (books, etc.) to pick a quiz from, over the two
 * library-wide runs — **Random** across every problem there is, and **Flagged**
 * across every problem on the review list, whatever source it came from. */
export function SourceList({
  sources,
  problemCount,
  flaggedCount,
  counts,
  onSelect,
  onRandomAll,
  onFlaggedAll,
}: {
  sources: Source[]
  /** Every problem in the library, across all sources. */
  problemCount: number
  /** Every flagged problem, across all sources. */
  flaggedCount: number
  /** One source's own totals, for its row's pills. App owns both the problems and
   * the flags, so it answers this per row. */
  counts: (sourceSlug: string) => { problems: number; flagged: number }
  onSelect: (slug: string) => void
  onRandomAll: () => void
  onFlaggedAll: () => void
}) {
  return (
    <>
      <div className="source-head">
        <div className="source-head-actions">
          <button
            className="quiz-btn source-random"
            disabled={problemCount === 0}
            onClick={onRandomAll}
            title="Start a random run over every problem, from every source"
          >
            🎲 Random ({problemCount})
          </button>
          <button
            className="quiz-btn source-flagged"
            disabled={flaggedCount === 0}
            onClick={onFlaggedAll}
            title="Retest every flagged problem, from every source, in random order"
          >
            <FlagIcon filled={flaggedCount > 0} /> Flagged ({flaggedCount})
          </button>
        </div>
      </div>
      <ul className="problem-list">
        {sources.map((src) => {
          const n = counts(src.slug)
          return (
            <li key={src.slug}>
              <button className="problem-row" onClick={() => onSelect(src.slug)}>
                {src.coverUrl && (
                  <img className="source-cover" src={src.coverUrl} alt="" loading="lazy" />
                )}
                <div className="problem-row-main">
                  <span className="problem-title">{src.title}</span>
                  <div className="problem-meta">
                    <span className="chip">
                      {n.problems} problem{n.problems === 1 ? '' : 's'}
                    </span>
                    {/* As on the quizzes list: only when there's something to review. */}
                    {n.flagged > 0 && (
                      <span className="chip chip-flagged">{n.flagged} flagged</span>
                    )}
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
