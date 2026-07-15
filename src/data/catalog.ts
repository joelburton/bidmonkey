import type { Source, Quiz } from '../types'

// Initial catalogue: the sources and quizzes for the one-time seed. This is the
// input to db/gen-seed.mjs (and a test fixture) — NOT read by the app at runtime,
// which loads everything from Supabase. New quizzes are authored in the DB.

export const sources: Source[] = [
  { slug: 'fakebook', title: 'FakeBook' },
]

export const quizzes: Quiz[] = [
  // QuizA and QuizB both draw from FakeBook; partnership-slam-try is in both.
  {
    slug: 'quiz-a',
    title: 'QuizA',
    source: 'fakebook',
    problemSlugs: ['limit-raise-or-game', 'your-call-as-responder', 'partnership-slam-try'],
  },
  {
    slug: 'quiz-b',
    title: 'QuizB',
    source: 'fakebook',
    problemSlugs: ['partnership-slam-try', 'choose-your-opening-lead', 'two-decisions'],
  },
]
