import type { Source } from '../types'
import { FlagIcon } from './FlagButton'

/** Top-level list: the sources (books, etc.) to pick a quiz from, over the two
 * library-wide runs — **Random** across every problem there is, and **Flagged**
 * across every problem on the review list, whatever source it came from. */
export function SourceList({
  sources,
  problemCount,
  flaggedCount,
  onSelect,
  onRandomAll,
  onFlaggedAll,
}: {
  sources: Source[]
  /** Every problem in the library, across all sources. */
  problemCount: number
  /** Every flagged problem, across all sources. */
  flaggedCount: number
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
        {sources.map((src) => (
          <li key={src.slug}>
            <button className="problem-row" onClick={() => onSelect(src.slug)}>
              {src.coverUrl && (
                <img className="source-cover" src={src.coverUrl} alt="" loading="lazy" />
              )}
              <div className="problem-row-main">
                <span className="problem-title">{src.title}</span>
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
