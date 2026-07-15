import type { Page } from '@playwright/test'
import { problems } from '../src/data/problems'
import { sources, quizzes } from '../src/data/catalog'

// Serve the seed data in place of Supabase. With .env.test pointing the Supabase
// URL at the app's own origin, the PostgREST GETs are same-origin and these
// routes fulfil them — so e2e exercises the real fetch/render path with no
// network and no real project. Call before page.goto().
export async function stubSupabase(page: Page): Promise<void> {
  const quizRows = quizzes.map((q) => ({
    slug: q.slug,
    title: q.title,
    source: q.source ?? null,
    quizzes_problems: q.problemIds.map((problem_id, i) => ({ problem_id, ordinal: i + 1 })),
  }))
  await page.route(/\/rest\/v1\/sources/, (r) => r.fulfill({ json: sources }))
  await page.route(/\/rest\/v1\/problems/, (r) => r.fulfill({ json: problems }))
  await page.route(/\/rest\/v1\/quizzes/, (r) => r.fulfill({ json: quizRows }))
}
