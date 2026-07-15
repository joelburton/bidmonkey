import { execSync } from 'node:child_process'
import { resolve } from 'node:path'

// Before the e2e run, reset the local Supabase DB to migrations + seed so tests
// see a known state. Requires the stack to be up (`supabase start` in the repo
// root). Runs against the real local PostgREST — no stubbing — so the queries,
// row mapping, and RLS are actually exercised.
export default function globalSetup() {
  const root = resolve(import.meta.dirname, '..', '..')
  try {
    execSync('supabase db reset', { cwd: root, stdio: 'inherit' })
  } catch {
    throw new Error(
      'e2e needs the local Supabase stack running. Start it first:\n' +
        '  (in the repo root) supabase start',
    )
  }
}
