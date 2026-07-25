// The review list: which problems are flagged for another look. Reads and writes
// the `problem_flags` table — the one table the app writes to (content is
// read-only). Row presence IS the flag; unflagging deletes the row.
import { sbDelete, sbSelect, sbUpsert } from '../lib/supabase'

/**
 * Why a problem is on the review list:
 * - `wrong` — answered with something that isn't the answer or an accepted one
 * - `alternate` — answered with an `accept` alternative: not wrong, but not the
 *   preferred call either, so still worth revisiting
 * - `manual` — flagged by hand (the ⚑ button or the `f` key)
 */
export type FlagReason = 'wrong' | 'alternate' | 'manual'

// No auth anywhere in this app, so the owner of a flag is a constant (it matches
// the problem_flags.player column default). The point of the column is that
// flags follow the person, not the browser: flag on the phone, review on the
// desktop. Real users later = fill this from a session instead of hard-coding it.
export const PLAYER = 'joel'

interface FlagRow {
  problem_slug: string
  reason: FlagReason
}

/** Every flag for this player, as problem slug → why it's flagged. */
export async function fetchFlags(): Promise<Map<string, FlagReason>> {
  const rows = await sbSelect<FlagRow[]>(
    `problem_flags?select=problem_slug,reason&player=eq.${encodeURIComponent(PLAYER)}`,
  )
  return new Map(rows.map((r) => [r.problem_slug, r.reason]))
}

/** Flag `slug` (or update why it's flagged). Leaves `note` untouched. */
export async function setFlag(slug: string, reason: FlagReason): Promise<void> {
  await sbUpsert(
    'problem_flags',
    [{ player: PLAYER, problem_slug: slug, reason }],
    'player,problem_slug',
  )
}

/** Unflag `slug` — the row goes away entirely. */
export async function clearFlag(slug: string): Promise<void> {
  await sbDelete(
    `problem_flags?player=eq.${encodeURIComponent(PLAYER)}&problem_slug=eq.${encodeURIComponent(slug)}`,
  )
}
