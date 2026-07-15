import type { Source, Quiz } from '../types'

// Initial catalogue: the sources and quizzes for the one-time seed. This is the
// input to db/gen-seed.mjs (and a test fixture) — NOT read by the app at runtime,
// which loads everything from Supabase. New quizzes are authored in the DB.

export const sources: Source[] = [
  { slug: 'fakebook', title: 'FakeBook' },
]

export const quizzes: Quiz[] = [
  // QuizA and QuizB both draw from FakeBook; problem 3 is in both.
  { slug: 'quiz-a', title: 'QuizA', source: 'fakebook', problemIds: [1, 2, 3] },
  { slug: 'quiz-b', title: 'QuizB', source: 'fakebook', problemIds: [3, 4, 5] },
]
