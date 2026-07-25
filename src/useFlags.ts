import { useCallback, useEffect, useRef, useState } from 'react'
import type { FlagReason } from './data/flags'
import { clearFlag, fetchFlags, setFlag } from './data/flags'

export interface FlagState {
  /** problem slug → why it's flagged. Absent = not flagged. */
  flags: Map<string, FlagReason>
  /** Flag ⇄ unflag by hand (the ⚑ button / `f`). */
  toggle: (slug: string) => void
  /** Flag because an answer wasn't the preferred one. Never unflags. */
  flagAnswer: (slug: string, reason: 'wrong' | 'alternate') => void
}

/**
 * The review list, loaded once and then kept in memory. Writes are optimistic:
 * the UI flips immediately and the row is written behind it, so tapping ⚑ never
 * waits on the network. A failed write reverts the flag rather than leaving the
 * UI claiming something was saved.
 *
 * Deliberately loaded separately from the catalogue (App's fetchCatalog): flags
 * are an extra, and losing them must not take out the problems.
 */
export function useFlags(): FlagState {
  const [flags, setFlags] = useState<Map<string, FlagReason>>(new Map())
  // Read-only mirror, so the callbacks below can see the current flags without
  // being re-created (they're passed all the way down to the panels).
  const ref = useRef(flags)
  ref.current = flags

  useEffect(() => {
    let alive = true
    fetchFlags()
      .then((f) => alive && setFlags(f))
      .catch((e) => console.error('Could not load flags', e))
    return () => {
      alive = false
    }
  }, [])

  const write = useCallback((slug: string, reason: FlagReason | null) => {
    const before = ref.current.get(slug)
    const apply = (r: FlagReason | undefined) =>
      setFlags((prev) => {
        const next = new Map(prev)
        if (r) next.set(slug, r)
        else next.delete(slug)
        return next
      })
    apply(reason ?? undefined)
    const done = reason ? setFlag(slug, reason) : clearFlag(slug)
    done.catch((e) => {
      console.error('Could not save flag', e)
      apply(before) // springs back — a failed write must not look saved
    })
  }, [])

  const toggle = useCallback(
    (slug: string) => write(slug, ref.current.has(slug) ? null : 'manual'),
    [write],
  )

  const flagAnswer = useCallback(
    (slug: string, reason: 'wrong' | 'alternate') => {
      const cur = ref.current.get(slug)
      // 'wrong' is the strongest reason and an unchanged reason isn't worth a
      // round trip — otherwise every retry of a wrong answer would re-write.
      if (cur === 'wrong' || cur === reason) return
      write(slug, reason)
    },
    [write],
  )

  return { flags, toggle, flagAnswer }
}
