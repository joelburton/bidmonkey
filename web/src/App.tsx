import { useState } from 'react'
import { problems } from './data/problems'
import { sources, quizzes, quizzesForSource } from './data/catalog'
import { SourceList } from './components/SourceList'
import { QuizList } from './components/QuizList'
import { ProblemView } from './components/ProblemView'

// Navigation: sources → quizzes (of a source) → quiz (a problem, in order).
type Nav =
  | { view: 'sources' }
  | { view: 'quizzes'; source: string }
  | { view: 'quiz'; quiz: string; index: number }

export default function App() {
  const [nav, setNav] = useState<Nav>({ view: 'sources' })
  const goHome = () => setNav({ view: 'sources' })

  // Running a quiz: one problem at a time, in order, with Home + Next.
  if (nav.view === 'quiz') {
    const quiz = quizzes.find((q) => q.slug === nav.quiz)!
    const problem = problems.find((p) => p.id === quiz.problemIds[nav.index])!
    const hasNext = nav.index < quiz.problemIds.length - 1
    const goNext = () =>
      hasNext && setNav({ view: 'quiz', quiz: nav.quiz, index: nav.index + 1 })

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
            sources={sources}
            onSelect={(source) => setNav({ view: 'quizzes', source })}
          />
        ) : (
          <QuizList
            quizzes={quizzesForSource(nav.source)}
            onSelect={(quiz) => setNav({ view: 'quiz', quiz, index: 0 })}
          />
        )}
      </main>
    </div>
  )
}
