import { useState } from 'react'

/**
 * The problem written out as text, over the whole screen, for copying into a
 * Claude conversation (see lib/problemText.ts for why it's plain text).
 *
 * Covers the app header too — unlike every other overlay here, which sits under
 * it. This is a reading surface with one way out, so leaving Prev/Next live
 * behind it would only offer a way to change the problem the text describes.
 * It's also drawn on the light list surface rather than the felt: it's a
 * document, not part of the table, and a wall of small type wants paper.
 */
export function ProblemInfo({ text, onClose }: { text: string; onClose: () => void }) {
  // 'copied' is a transient acknowledgement, not state anyone else needs; the
  // panel is unmounted on close, which resets it.
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // No clipboard permission (or an insecure origin): the text is selectable
      // right there, so say nothing and let them select it by hand.
    }
  }

  return (
    <div className="info-panel" role="dialog" aria-label="Problem details">
      <pre className="info-text">{text}</pre>
      <div className="info-actions">
        <button className="quiz-btn" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button className="quiz-btn info-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
