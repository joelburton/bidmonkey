// Attempt persistence — pass/fail per problem, stored in Supabase. The `attempts`
// table + RLS (anon may insert & read, never update/delete) already exist; this
// is the client seam. Not yet wired into gameplay — the "review my failures"
// feature will call these.
import { sbInsert, sbSelect } from '../lib/supabase'

export interface Attempt {
  problemId: number
  passed: boolean
  createdAt: string
}

/** Record one attempt at a problem. */
export async function recordAttempt(problemId: number, passed: boolean): Promise<void> {
  await sbInsert('attempts', { problem_id: problemId, passed })
}

/** Problem ids that have at least one failed attempt (for a future review mode). */
export async function fetchFailedProblemIds(): Promise<number[]> {
  const rows = await sbSelect<{ problem_id: number }[]>(
    'attempts?select=problem_id&passed=eq.false',
  )
  return [...new Set(rows.map((r) => r.problem_id))]
}
