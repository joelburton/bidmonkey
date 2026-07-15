import type { Source } from '../types'

/** Top-level list: the sources (books, etc.) to pick a quiz from. */
export function SourceList({
  sources,
  onSelect,
}: {
  sources: Source[]
  onSelect: (slug: string) => void
}) {
  return (
    <ul className="problem-list">
      {sources.map((src) => (
        <li key={src.slug}>
          <button className="problem-row" onClick={() => onSelect(src.slug)}>
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
  )
}
