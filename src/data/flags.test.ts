import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearFlag, fetchFlags, PLAYER, setFlag } from './flags'
import { sbDelete, sbSelect, sbUpsert } from '../lib/supabase'

// The PostgREST calls themselves are exercised for real by the e2e suite (which
// runs against the local stack); here we pin the queries and payloads, since a
// wrong filter would silently read or delete another player's rows.
vi.mock('../lib/supabase', () => ({
  sbSelect: vi.fn(),
  sbUpsert: vi.fn(),
  sbDelete: vi.fn(),
}))

beforeEach(() => vi.clearAllMocks())

describe('flags repo', () => {
  it("reads this player's flags into slug -> reason", async () => {
    vi.mocked(sbSelect).mockResolvedValue([
      { problem_slug: 'a', reason: 'wrong' },
      { problem_slug: 'b', reason: 'manual' },
    ])
    const flags = await fetchFlags()
    expect(vi.mocked(sbSelect).mock.calls[0][0]).toBe(
      `problem_flags?select=problem_slug,reason&player=eq.${PLAYER}`,
    )
    expect(flags.get('a')).toBe('wrong')
    expect(flags.get('b')).toBe('manual')
    expect(flags.has('c')).toBe(false)
  })

  it('upserts on (player, problem_slug) so re-flagging updates the reason', async () => {
    vi.mocked(sbUpsert).mockResolvedValue(undefined)
    await setFlag('two-decisions', 'alternate')
    expect(sbUpsert).toHaveBeenCalledWith(
      'problem_flags',
      [{ player: PLAYER, problem_slug: 'two-decisions', reason: 'alternate' }],
      'player,problem_slug',
    )
  })

  it("unflagging deletes only this player's row for that problem", async () => {
    vi.mocked(sbDelete).mockResolvedValue(undefined)
    await clearFlag('two-decisions')
    expect(sbDelete).toHaveBeenCalledWith(
      `problem_flags?player=eq.${PLAYER}&problem_slug=eq.two-decisions`,
    )
  })
})
