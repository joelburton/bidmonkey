import type { Problem } from '../types'
import { SEAT_NAME, VULN_LABEL } from '../types'

export function ProblemList({
  problems,
  onSelect,
}: {
  problems: Problem[]
  onSelect: (id: number) => void
}) {
  return (
    <ul className="problem-list">
      {problems.map((p) => (
        <li key={p.id}>
          <button className="problem-row" onClick={() => onSelect(p.id)}>
            <div className="problem-row-main">
              <span className="problem-title">{p.title ?? `Problem ${p.id}`}</span>
              <div className="problem-meta">
                <span className="chip">{SEAT_NAME[p.dealer]} deals</span>
                <span className="chip">{VULN_LABEL[p.vulnerability]}</span>
                {p.difficulty != null && (
                  <span className="chip chip-diff">
                    {'●'.repeat(p.difficulty)}
                    <span className="chip-diff-off">
                      {'●'.repeat(Math.max(0, 5 - p.difficulty))}
                    </span>
                  </span>
                )}
              </div>
              {p.tags.length > 0 && (
                <div className="tag-row">
                  {p.tags.map((t) => (
                    <span className="tag" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
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
