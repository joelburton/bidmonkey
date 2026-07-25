import type { Quiz, Source } from '../types'

/** The quizzes within a chosen source, under a source header that offers a
 * **Random** run across every problem in the whole source (not just one quiz).
 * Each quiz then offers "In Order" / "Random" (a shuffle of its own problems)
 * plus a printable PDF export. */
export function QuizList({
  source,
  problemCount,
  quizzes,
  onStart,
  onPdf,
  onRandomSource,
}: {
  source: Source
  problemCount: number
  quizzes: Quiz[]
  onStart: (slug: string, mode: 'order' | 'random') => void
  onPdf: (slug: string) => void
  onRandomSource: () => void
}) {
  return (
    <>
      <div className="source-head">
        <h2 className="source-head-title">{source.title}</h2>
        <button
          className="quiz-btn source-random"
          disabled={problemCount === 0}
          onClick={onRandomSource}
          title="Start a random run over every problem in this source"
        >
          🎲 Random — all {problemCount} problem{problemCount === 1 ? '' : 's'}
        </button>
      </div>
      <ul className="problem-list">
        {quizzes.map((q) => {
          const empty = q.problemSlugs.length === 0
          return (
            <li key={q.slug} className="quiz-row">
              <div className="problem-row-main">
                <span className="problem-title">{q.title}</span>
                <div className="problem-meta">
                  <span className="chip">
                    {q.problemSlugs.length} problem{q.problemSlugs.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
              <div className="quiz-actions">
                <button
                  className="quiz-btn"
                  disabled={empty}
                  onClick={() => onStart(q.slug, 'order')}
                >
                  In Order
                </button>
                <button
                  className="quiz-btn"
                  disabled={empty}
                  onClick={() => onStart(q.slug, 'random')}
                >
                  Random
                </button>
                <button
                  className="quiz-btn"
                  disabled={empty}
                  onClick={() => onPdf(q.slug)}
                  title="Download a printable PDF of this quiz"
                >
                  PDF
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
