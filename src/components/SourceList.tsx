import type { ReactNode } from 'react'
import type { Source } from '../types'
import type { Settings } from '../settings'
import { FlagIcon } from './FlagButton'
import { SuitGlyph } from './SuitGlyph'

/** One display setting: a switch, a name, and a line saying what it does. The
 * checkbox is the real control (label-wrapped, so the whole row is a hit
 * target); `.switch` is only its skin. */
function Toggle({
  checked,
  onChange,
  name,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  name: ReactNode
  hint: ReactNode
}) {
  return (
    <label className="setting">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch" aria-hidden />
      <span className="setting-text">
        <span className="setting-name">{name}</span>
        <span className="setting-hint">{hint}</span>
      </span>
    </label>
  )
}

/** Top-level list: the sources (books, etc.) to pick a quiz from, over the two
 * library-wide runs — **Random** across every problem there is, and **Flagged**
 * across every problem on the review list, whatever source it came from. The
 * display settings sit at the foot, below the list they don't belong to but
 * above nothing else — this is the only screen you always pass through. */
export function SourceList({
  sources,
  problemCount,
  flaggedCount,
  counts,
  onSelect,
  onRandomAll,
  onFlaggedAll,
  settings,
  onSetting,
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
  settings: Settings
  onSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => void
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

      <section className="settings-panel">
        <h2 className="settings-title">Display</h2>
        <Toggle
          checked={settings.fourColor}
          onChange={(v) => onSetting('fourColor', v)}
          name={
            <>
              Four-colour suits
              <span className="setting-swatch" aria-hidden>
                <SuitGlyph suit="D" />
                <SuitGlyph suit="C" />
              </span>
            </>
          }
          hint="Diamonds orange and clubs green, so no two suits share a colour."
        />
        <Toggle
          checked={settings.freeEntry}
          onChange={(v) => onSetting('freeEntry', v)}
          name="Enter answers, don’t choose"
          hint="Bid on the pad and play by tapping a card, even where the problem offers a list. Questions whose answer isn’t a call or a card stay multiple choice."
        />
      </section>
    </>
  )
}
