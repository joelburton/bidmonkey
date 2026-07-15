import type { Source, Quiz } from '../types'

// The catalogue: sources (books, etc.) and the quizzes drawn from them. Mirrors
// the `sources`, `quizzes`, and `quizzes_problems` tables — the same data the
// seed generator (db/gen-seed.mjs) writes into SQLite, so the two stay in sync.
// Swap these arrays for a fetch once a backend exists.

export const sources: Source[] = [
  { slug: 'fakebook', title: 'FakeBook' },
]

export const quizzes: Quiz[] = [
  // QuizA and QuizB both draw from FakeBook; problem 3 is in both.
  { slug: 'quiz-a', title: 'QuizA', source: 'fakebook', problemIds: [1, 2, 3] },
  { slug: 'quiz-b', title: 'QuizB', source: 'fakebook', problemIds: [3, 4, 5] },
]

export const quizzesForSource = (sourceSlug: string): Quiz[] =>
  quizzes.filter((q) => q.source === sourceSlug)
