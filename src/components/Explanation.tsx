import type { ReactNode } from 'react'
import { withSuits } from './suitText'

/**
 * Render an explanation body. Lines (split on the preserved newlines) become
 * paragraphs — the first flush-left, the rest first-line-indented and run
 * together with no blank space between — and any run of lines starting with "-"
 * becomes a bulleted list. Suit symbols are colored via withSuits.
 */
export function Explanation({ text }: { text: string }) {
  const out: ReactNode[] = []
  let bullets: string[] = []
  let paras = 0

  const flushBullets = () => {
    if (!bullets.length) return
    const items = bullets
    out.push(
      <ul className="explain-list" key={out.length}>
        {items.map((b, i) => (
          <li key={i}>{withSuits(b)}</li>
        ))}
      </ul>,
    )
    bullets = []
  }

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('-')) {
      bullets.push(line.replace(/^-\s*/, ''))
      continue
    }
    flushBullets()
    out.push(
      <p className={paras === 0 ? 'explain-para' : 'explain-para indent'} key={out.length}>
        {withSuits(line)}
      </p>,
    )
    paras++
  }
  flushBullets()
  return <>{out}</>
}
