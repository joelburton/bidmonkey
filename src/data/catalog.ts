import type { Source, Quiz } from '../types'

// Initial catalogue: the sources and quizzes for the one-time seed. This is the
// input to db/gen-seed.mjs (and a test fixture) — NOT read by the app at runtime,
// which loads everything from Supabase. New quizzes are authored in the DB.

export const sources: Source[] = [
  // No real book cover exists for the fixture source, so it points at the shared
  // monkey-in-a-frame placeholder in the book-covers bucket.
  {
    slug: 'fakebook',
    title: 'FakeBook',
    coverUrl:
      'https://drczvcgytwmmyzesohwm.supabase.co/storage/v1/object/public/book-covers/placeholder.png',
  },
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
    problemSlugs: [
      'partnership-slam-try',
      'choose-your-opening-lead',
      'two-decisions',
      'defend-four-spades',
    ],
  },
  {
    slug: 'quiz-c',
    title: 'QuizC',
    source: 'fakebook',
    // Demonstrates the free-form (text) multiple-choice question.
    problemSlugs: ['preempt-which-vulnerability'],
  },
]
