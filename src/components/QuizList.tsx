import type { Quiz } from '../types'

/** The quizzes within a chosen source. Each offers two ways to start: "In Order"
 * (by problem ordinal) or "Random" (a shuffle of its problems), plus a printable
 * PDF export of the whole quiz. */
export function QuizList({
  quizzes,
  onStart,
  onPdf,
}: {
  quizzes: Quiz[]
  onStart: (slug: string, mode: 'order' | 'random') => void
  onPdf: (slug: string) => void
}) {
  return (
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
  )
}
