// Minimal Supabase access over the PostgREST REST API — no SDK dependency, since
// all we need is a few reads and one insert. The anon key is public by design;
// RLS on the server governs what it can do. Config comes from Vite env
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
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in web/.env.',
    )
  }
}

/** GET rows from a PostgREST endpoint, e.g. `sbSelect('sources?select=slug,title')`. */
export async function sbSelect<T>(query: string): Promise<T> {
  ensureConfigured()
  const res = await fetch(`${URL}/rest/v1/${query}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`Supabase GET ${query} → ${res.status}: ${await res.text()}`)
  return (await res.json()) as T
}

/** INSERT a row into a table. RLS decides whether it's allowed. */
export async function sbInsert(table: string, row: unknown): Promise<void> {
  ensureConfigured()
  const res = await fetch(`${URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  })
  if (!res.ok) throw new Error(`Supabase POST ${table} → ${res.status}: ${await res.text()}`)
}
