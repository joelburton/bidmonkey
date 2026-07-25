import { useEffect, useState } from 'react'
import type { Catalog } from './data/repo'
import { fetchCatalog } from './data/repo'
import { SourceList } from './components/SourceList'
import { QuizList } from './components/QuizList'
import { QuizView } from './components/QuizView'
import { ProblemView } from './components/ProblemView'
import { downloadQuizPdf } from './lib/quizPdf'
import { useFlags } from './useFlags'
import { useSettings } from './settings'

// Navigation: sources → quizzes (of a source) → quiz → run. Each level is a
// plain list; the buttons that *start* something live on the level below it (a
// quiz's In Order / Random / Flagged / PDF are on its own screen), except the
// wider runs — random-or-flagged over a whole source, or over everything — which
// sit at the top of the list they cover.
//
// A `run` is a sequence of problems presented one at a time. `order` is the slug
// sequence, `title` labels the run in the header, and `index` walks it, so
// Prev/Next follow the chosen order, not the real ordinals. It also remembers
// where it was launched from (`quiz`, else `source`) so the header's back button
// returns exactly one level rather than all the way home; both are optional,
// since a library-wide run has neither and a quiz needn't belong to a source.
type Nav =
  | { view: 'sources' }
  | { view: 'quizzes'; source: string }
  | { view: 'quiz'; quiz: string }
  | {
      view: 'run'
      title: string
      index: number
      order: string[]
      source?: string
      quiz?: string
    }

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
  // Display preferences (the two switches at the foot of the sources list).
  const [settings, setSetting] = useSettings()

  // The four-colour deck is pure CSS: one attribute on <html> repaints every
  // pip on a card face and on the felt, so nothing between here and Card has to
  // know the setting exists. (Free entry can't work that way — it changes which
  // control is rendered — so that one is threaded down as a prop.)
  useEffect(() => {
    const root = document.documentElement
    if (settings.fourColor) root.setAttribute('data-deck', '4color')
    else root.removeAttribute('data-deck')
  }, [settings.fourColor])

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
  const flagged = (slug: string) => flags.has(slug)

  // Every "start" funnels through here: a header title, the slug order to walk,
  // and where back should land (see the Nav comment). An empty order is a no-op,
  // which is also why the buttons that would produce one are disabled.
  const startRun = (
    title: string,
    order: string[],
    from: { source?: string; quiz?: string } = {},
  ) => {
    if (order.length === 0) return
    setNav({ view: 'run', title, index: 0, order, ...from })
  }

  // --- One quiz (from its own screen) ---
  const startQuiz = (slug: string, mode: 'order' | 'random') => {
    const quiz = catalog.quizzes.find((q) => q.slug === slug)
    if (!quiz) return
    startRun(quiz.title, mode === 'random' ? shuffle(quiz.problemSlugs) : quiz.problemSlugs, {
      source: quiz.source,
      quiz: slug,
    })
  }
  const startQuizFlagged = (slug: string) => {
    const quiz = catalog.quizzes.find((q) => q.slug === slug)
    if (!quiz) return
    startRun(`${quiz.title} · flagged`, shuffle(quiz.problemSlugs.filter(flagged)), {
      source: quiz.source,
      quiz: slug,
    })
  }

  // --- A whole source (not just one of its quizzes): problems carry a source FK,
  // so filter by that rather than unioning the quizzes. ---
  const sourceProblems = (sourceSlug: string, flaggedOnly = false) =>
    catalog.problems
      .filter((p) => p.source === sourceSlug && (!flaggedOnly || flagged(p.slug)))
      .map((p) => p.slug)
  const startSourceRandom = (sourceSlug: string) => {
    const source = catalog.sources.find((s) => s.slug === sourceSlug)
    if (source) {
      startRun(`${source.title} · random`, shuffle(sourceProblems(sourceSlug)), {
        source: sourceSlug,
      })
    }
  }
  // The retest pass. Its order is snapshotted at the start, so unflagging as you
  // go doesn't reshuffle the run under you (true of every flagged run here).
  const startSourceFlagged = (sourceSlug: string) => {
    const source = catalog.sources.find((s) => s.slug === sourceSlug)
    if (source) {
      startRun(`${source.title} · flagged`, shuffle(sourceProblems(sourceSlug, true)), {
        source: sourceSlug,
      })
    }
  }

  // --- The whole library: every problem, or every flagged one, any source. ---
  const allSlugs = catalog.problems.map((p) => p.slug)
  const allFlagged = allSlugs.filter(flagged)
  const startAllRandom = () => startRun('All · random', shuffle(allSlugs))
  const startAllFlagged = () => startRun('All · flagged', shuffle(allFlagged))

  const exportPdf = (slug: string) => {
    const quiz = catalog.quizzes.find((q) => q.slug === slug)
    if (quiz) downloadQuizPdf(quiz, catalog.problems)
  }

  // Running a set of problems: one at a time, in `order`, with Back + Prev/Next.
  if (nav.view === 'run') {
    // Back goes exactly one level up, to wherever this run was started: a quiz's
    // screen, else the source's quizzes, else (a library-wide run) the sources.
    const from = nav.quiz
      ? ({ view: 'quiz', quiz: nav.quiz } as const)
      : nav.source
        ? ({ view: 'quizzes', source: nav.source } as const)
        : ({ view: 'sources' } as const)
    const backLabel =
      from.view === 'quiz' ? 'Back to quiz' : from.view === 'quizzes' ? 'Back to quizzes' : 'Home'
    const goBack = () => setNav(from)
    const problem = catalog.problems.find((p) => p.slug === nav.order[nav.index])
    // A run can point at a slug with no matching problem (e.g. an empty quiz, or
    // stale content) — show a note instead of crashing on the missing problem.
    if (!problem) {
      return (
        <div className="app list">
          <header className="app-header">
            <button className="qbtn" onClick={goBack}>
              <span className="chev">‹</span>
              <span className="qbtn-label">Back</span>
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
        <header className="app-header">
          <button className="qbtn" onClick={goBack} aria-label={backLabel}>
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
            freeEntry={settings.freeEntry}
          />
        </main>
        {/* Shown (via CSS) instead of the table on landscape phones, where the
            fixed-height portrait table can't fit. */}
        <div className="rotate-note">Rotate your phone — bidmonkey plays in portrait.</div>
      </div>
    )
  }

  // One quiz's start screen. Back returns to its source's quizzes (labelled with
  // the source, so it reads as one step up) — or to the sources for a quiz that
  // belongs to none.
  if (nav.view === 'quiz') {
    const quiz = catalog.quizzes.find((q) => q.slug === nav.quiz)
    const source = catalog.sources.find((s) => s.slug === quiz?.source)
    const quizSource = quiz?.source
    return (
      <div className="app list">
        <header className="app-header">
          <button
            className="qbtn"
            onClick={() =>
              setNav(quizSource ? { view: 'quizzes', source: quizSource } : { view: 'sources' })
            }
          >
            <span className="chev">‹</span>
            <span className="qbtn-label">{source?.title ?? 'Sources'}</span>
          </button>
        </header>
        <main className="app-main list">
          {quiz ? (
            <QuizView
              quiz={quiz}
              sourceTitle={source?.title}
              flaggedCount={quiz.problemSlugs.filter(flagged).length}
              onStart={(mode) => startQuiz(quiz.slug, mode)}
              onFlagged={() => startQuizFlagged(quiz.slug)}
              onPdf={() => exportPdf(quiz.slug)}
            />
          ) : (
            <div className="screen-msg">That quiz is no longer here.</div>
          )}
        </main>
      </div>
    )
  }

  // The two list levels: every source, or the quizzes within a chosen source.
  return (
    <div className="app list">
      <header className="app-header">
        {nav.view === 'quizzes' ? (
          <button className="qbtn" onClick={goHome}>
            <span className="chev">‹</span>
            <span className="qbtn-label">Sources</span>
          </button>
        ) : (
          <span className="brand">🐵 bidmonkey</span>
        )}
      </header>
      <main className="app-main list">
        {nav.view === 'sources' ? (
          <SourceList
            sources={catalog.sources}
            problemCount={allSlugs.length}
            flaggedCount={allFlagged.length}
            counts={(source) => ({
              problems: sourceProblems(source).length,
              flagged: sourceProblems(source, true).length,
            })}
            onSelect={(source) => setNav({ view: 'quizzes', source })}
            onRandomAll={startAllRandom}
            onFlaggedAll={startAllFlagged}
            settings={settings}
            onSetting={setSetting}
          />
        ) : (
          <QuizList
            source={
              catalog.sources.find((s) => s.slug === nav.source) ?? {
                slug: nav.source,
                title: nav.source,
              }
            }
            problemCount={sourceProblems(nav.source).length}
            flaggedCount={sourceProblems(nav.source, true).length}
            quizzes={catalog.quizzes.filter((q) => q.source === nav.source)}
            flaggedIn={(slugs) => slugs.filter(flagged).length}
            onSelect={(quiz) => setNav({ view: 'quiz', quiz })}
            onRandomSource={() => startSourceRandom(nav.source)}
            onFlaggedSource={() => startSourceFlagged(nav.source)}
          />
        )}
      </main>
    </div>
  )
}
