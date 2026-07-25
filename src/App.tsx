import { useEffect, useState } from 'react'
import type { Catalog } from './data/repo'
import { fetchCatalog } from './data/repo'
import { SourceList } from './components/SourceList'
import { QuizList } from './components/QuizList'
import { ProblemView } from './components/ProblemView'
import { downloadQuizPdf } from './lib/quizPdf'
import { useFlags } from './useFlags'

// Navigation: sources → quizzes (of a source) → run. A `run` is a sequence of
// problems presented one at a time — a quiz (in order or shuffled) or a random
// draw across a whole source. `order` is the slug sequence, `title` labels the
// run in the header, and `index` walks it, so Prev/Next follow the chosen order,
// not the real ordinals. A run remembers the `source` it came from so the header's
// back button returns one level (to that source's quizzes), not all the way home;
// it's optional because a quiz needn't belong to a source.
type Nav =
  | { view: 'sources' }
  | { view: 'quizzes'; source: string }
  | { view: 'run'; title: string; index: number; order: string[]; source?: string }

/** Fisher–Yates shuffle into a fresh array. */
function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [nav, setNav] = useState<Nav>({ view: 'sources' })
  // The review list (problem_flags). Loaded independently of the catalogue: a
  // flags failure must not cost us the problems.
  const { flags, toggle: toggleFlag, flagAnswer } = useFlags()

  // Content lives in Supabase; load it on mount and on each retry.
  useEffect(() => {
    let alive = true
    setError(null)
    setCatalog(null)
    fetchCatalog()
      .then((c) => alive && setCatalog(c))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      alive = false
    }
  }, [reloadKey])

  // This app is driven by clicks + its own key handling (a-d to answer, any key
  // to dismiss a popup); no button should be Space/Enter-activatable. Preventing
  // mousedown's default keeps focus off buttons, so a stray key can't re-fire the
  // last one clicked.
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) e.preventDefault()
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  if (error) {
    return (
      <div className="app list">
        <header className="app-header">
          <span className="brand">🐵 bidmonkey</span>
        </header>
        <main className="app-main list">
          <div className="screen-msg">
            <p>Couldn’t load problems.</p>
            <p className="screen-msg-detail">{error}</p>
            <button className="back" onClick={() => setReloadKey((k) => k + 1)}>
              Retry
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (!catalog) {
    return (
      <div className="app list">
        <header className="app-header">
          <span className="brand">🐵 bidmonkey</span>
        </header>
        <main className="app-main list">
          <div className="screen-msg">Loading…</div>
        </main>
      </div>
    )
  }

  const goHome = () => setNav({ view: 'sources' })
  const startQuiz = (slug: string, mode: 'order' | 'random') => {
    const quiz = catalog.quizzes.find((q) => q.slug === slug)
    if (!quiz) return
    const order = mode === 'random' ? shuffle(quiz.problemSlugs) : quiz.problemSlugs
    setNav({ view: 'run', title: quiz.title, index: 0, order, source: quiz.source })
  }
  // A random draw over every problem in a source (not just one of its quizzes) —
  // problems carry a source FK, so filter by it rather than unioning the quizzes.
  const startSourceRandom = (sourceSlug: string) => {
    const source = catalog.sources.find((s) => s.slug === sourceSlug)
    const slugs = catalog.problems.filter((p) => p.source === sourceSlug).map((p) => p.slug)
    if (!source || slugs.length === 0) return
    setNav({
      view: 'run',
      title: `${source.title} · random`,
      index: 0,
      order: shuffle(slugs),
      source: sourceSlug,
    })
  }
  // A random draw over just this source's flagged problems — the retest pass.
  // The order is snapshotted at the start, so unflagging as you go doesn't
  // reshuffle the run under you.
  const startSourceFlagged = (sourceSlug: string) => {
    const source = catalog.sources.find((s) => s.slug === sourceSlug)
    const slugs = catalog.problems
      .filter((p) => p.source === sourceSlug && flags.has(p.slug))
      .map((p) => p.slug)
    if (!source || slugs.length === 0) return
    setNav({
      view: 'run',
      title: `${source.title} · flagged`,
      index: 0,
      order: shuffle(slugs),
      source: sourceSlug,
    })
  }
  const exportPdf = (slug: string) => {
    const quiz = catalog.quizzes.find((q) => q.slug === slug)
    if (quiz) downloadQuizPdf(quiz, catalog.problems)
  }

  // Running a set of problems: one at a time, in `order`, with Back + Prev/Next.
  if (nav.view === 'run') {
    // Back goes one level up — to the quizzes of the source this run came from,
    // so you land back where you launched it. Only a source-less quiz falls
    // through to the sources list.
    const runSource = nav.source
    const goBack = () =>
      setNav(runSource ? { view: 'quizzes', source: runSource } : { view: 'sources' })
    const problem = catalog.problems.find((p) => p.slug === nav.order[nav.index])
    // A run can point at a slug with no matching problem (e.g. an empty quiz, or
    // stale content) — show a note instead of crashing on the missing problem.
    if (!problem) {
      return (
        <div className="app list">
          <header className="app-header">
            <button className="back" onClick={goBack}>
              ‹ {runSource ? 'Quizzes' : 'Sources'}
            </button>
          </header>
          <main className="app-main list">
            <div className="screen-msg">No problems to show.</div>
          </main>
        </div>
      )
    }
    const hasNext = nav.index < nav.order.length - 1
    const hasPrev = nav.index > 0
    const goNext = () => hasNext && setNav({ ...nav, index: nav.index + 1 })
    const goPrev = () => hasPrev && setNav({ ...nav, index: nav.index - 1 })

    return (
      <div className="app detail">
        <header className="app-header quiz-header">
          <button
            className="qbtn"
            onClick={goBack}
            aria-label={runSource ? 'Back to quizzes' : 'Home'}
          >
            <span className="chev">‹</span>
            <span className="qbtn-label">
              {nav.title} #{nav.index + 1}
            </span>
          </button>
          <div className="qnav">
            <button
              className="qbtn qbtn-nav"
              onClick={goPrev}
              disabled={!hasPrev}
              aria-label="Previous problem"
            >
              <span className="chev">‹</span>
            </button>
            <button
              className="qbtn qbtn-nav"
              onClick={goNext}
              disabled={!hasNext}
              aria-label="Next problem"
            >
              <span className="chev">›</span>
            </button>
          </div>
        </header>
        <main className="app-main detail">
          <ProblemView
            key={problem.slug}
            problem={problem}
            onNext={goNext}
            hasNext={hasNext}
            flagged={flags.has(problem.slug)}
            onToggleFlag={() => toggleFlag(problem.slug)}
            onFlagAnswer={(reason) => flagAnswer(problem.slug, reason)}
          />
        </main>
        {/* Shown (via CSS) instead of the table on landscape phones, where the
            fixed-height portrait table can't fit. */}
        <div className="rotate-note">Rotate your phone — bidmonkey plays in portrait.</div>
      </div>
    )
  }

  // List views: sources, or the quizzes within a chosen source.
  return (
    <div className="app list">
      <header className="app-header">
        {nav.view === 'quizzes' ? (
          <button className="back" onClick={goHome}>
            ‹ Sources
          </button>
        ) : (
          <span className="brand">🐵 bidmonkey</span>
        )}
      </header>
      <main className="app-main list">
        {nav.view === 'sources' ? (
          <SourceList
            sources={catalog.sources}
            onSelect={(source) => setNav({ view: 'quizzes', source })}
          />
        ) : (
          <QuizList
            source={
              catalog.sources.find((s) => s.slug === nav.source) ?? {
                slug: nav.source,
                title: nav.source,
              }
            }
            problemCount={catalog.problems.filter((p) => p.source === nav.source).length}
            flaggedCount={
              catalog.problems.filter((p) => p.source === nav.source && flags.has(p.slug)).length
            }
            quizzes={catalog.quizzes.filter((q) => q.source === nav.source)}
            onStart={startQuiz}
            onPdf={exportPdf}
            onRandomSource={() => startSourceRandom(nav.source)}
            onFlaggedSource={() => startSourceFlagged(nav.source)}
          />
        )}
      </main>
    </div>
  )
}
