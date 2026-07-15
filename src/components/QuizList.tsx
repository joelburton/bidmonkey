import type { Quiz } from '../types'

/** The quizzes within a chosen source; clicking one starts it. */
export function QuizList({
  quizzes,
  onSelect,
}: {
  quizzes: Quiz[]
  onSelect: (slug: string) => void
}) {
  return (
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
  )
}
