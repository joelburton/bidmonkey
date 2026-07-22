// Minimal Supabase access over the PostgREST REST API — no SDK dependency, since
// all we need is a few reads. The anon key is public by design; RLS on the
// server governs what it can do. Config comes from Vite env
// (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY); see .env.example.

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = !!(URL && KEY)

function authHeaders(): Record<string, string> {
  return { apikey: KEY!, Authorization: `Bearer ${KEY!}` }
}

function ensureConfigured() {
  if (!supabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.',
    )
  }
}

// PostgREST silently caps every response at max_rows (1000 by default, both
// locally and hosted) — a 200 with the first 1000 rows, not an error. So a
// single GET would drop content the moment a table outgrows the cap.
const PAGE = 1000

/**
 * GET all rows from a PostgREST endpoint, e.g. `sbSelect('sources?select=slug,title')`.
 * Pages with Range headers until the Content-Range total is reached, so results
 * are complete regardless of the server's max_rows cap.
 */
export async function sbSelect<T extends unknown[]>(query: string): Promise<T> {
  ensureConfigured()
  const rows: unknown[] = []
  for (;;) {
    // The timeout turns a hung connection into the error/retry screen instead
    // of an indefinite "Loading…".
    const res = await fetch(`${URL}/rest/v1/${query}`, {
      headers: {
        ...authHeaders(),
        Range: `${rows.length}-${rows.length + PAGE - 1}`,
        Prefer: 'count=exact', // makes Content-Range's total exact, not "*"
      },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Supabase GET ${query} → ${res.status}: ${await res.text()}`)
    const page = (await res.json()) as unknown[]
    rows.push(...page)
    // Content-Range is "from-to/total" (or "*/0" when empty). The empty-page
    // check guards against looping forever if the total were ever wrong.
    const total = Number(res.headers.get('content-range')?.split('/')[1])
    if (page.length === 0 || !(rows.length < total)) return rows as T
  }
}
