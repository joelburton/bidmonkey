import { useEffect, useState } from 'react'
import type { Catalog } from './data/repo'
import { fetchCatalog } from './data/repo'
import { SourceList } from './components/SourceList'
import { QuizList } from './components/QuizList'
import { ProblemView } from './components/ProblemView'

// Navigation: sources → quizzes (of a source) → quiz (a problem, in order).
type Nav =
  | { view: 'sources' }
  | { view: 'quizzes'; source: string }
  | { view: 'quiz'; quiz: string; index: number }

export default function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [nav, setNav] = useState<Nav>({ view: 'sources' })

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

  // Running a quiz: one problem at a time, in order, with Home + Next.
  if (nav.view === 'quiz') {
    const quiz = catalog.quizzes.find((q) => q.slug === nav.quiz)
    const problem =
      quiz && catalog.problems.find((p) => p.slug === quiz.problemSlugs[nav.index])
    // A quiz can exist with no problems linked yet (content is authored by hand
    // in the DB) — show a note instead of crashing on the missing problem.
    if (!quiz || !problem) {
      return (
        <div className="app list">
          <header className="app-header">
            <button className="back" onClick={goHome}>
              ‹ Sources
            </button>
          </header>
          <main className="app-main list">
            <div className="screen-msg">This quiz has no problems yet.</div>
          </main>
        </div>
      )
    }
    const hasNext = nav.index < quiz.problemSlugs.length - 1
    const hasPrev = nav.index > 0
    const goNext = () =>
      hasNext && setNav({ view: 'quiz', quiz: nav.quiz, index: nav.index + 1 })
    const goPrev = () =>
      hasPrev && setNav({ view: 'quiz', quiz: nav.quiz, index: nav.index - 1 })

    return (
      <div className="app detail">
        <header className="app-header quiz-header">
          <button className="back" onClick={goHome} aria-label="Home">
            ‹
          </button>
          <span className="quiz-title">
            {quiz.title} #{nav.index + 1}
          </span>
          <button
            className="back prev"
            onClick={goPrev}
            disabled={!hasPrev}
            aria-label="Previous problem"
          >
            ‹
          </button>
          <button
            className="back next"
            onClick={goNext}
            disabled={!hasNext}
            aria-label="Next problem"
          >
            Next ›
          </button>
        </header>
        <main className="app-main detail">
          <ProblemView
            key={`${quiz.slug}-${nav.index}`}
            problem={problem}
            onNext={goNext}
            hasNext={hasNext}
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
            quizzes={catalog.quizzes.filter((q) => q.source === nav.source)}
            onSelect={(quiz) => setNav({ view: 'quiz', quiz, index: 0 })}
          />
        )}
      </main>
    </div>
  )
}
