import { useCallback, useEffect, useState } from 'react'

/**
 * Display settings — the two toggles on the sources page.
 *
 * These are *display* preferences, not content, so unlike the review flags
 * (which live in Supabase so they follow the person from phone to desktop) they
 * are kept per-browser in localStorage. There's no server round-trip and no
 * migration; the worst case of losing them is that the deck goes back to
 * red/black.
 */
export interface Settings {
  /** Four-colour deck: ♦ orange and ♣ green, so no two suits share a colour. */
  fourColor: boolean
  /**
   * Answer bid and card questions by entering the call / clicking the card,
   * even where the problem authored them as multiple choice. Only questions
   * whose answer *is* a call or a card can be entered this way — a 'text'
   * question ("at what vulnerability?") has nothing to type on the bid pad, so
   * it stays multiple choice whatever this says.
   */
  freeEntry: boolean
}

export const DEFAULT_SETTINGS: Settings = { fourColor: false, freeEntry: false }

const KEY = 'bidmonkey.settings'

function load(): Settings {
  // Anything unreadable (private-mode localStorage, hand-edited junk, a key
  // written by an older shape) falls back to the defaults rather than throwing
  // on the way up to the first render.
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    const saved = JSON.parse(raw) as Partial<Settings>
    return {
      fourColor: saved.fourColor === true,
      freeEntry: saved.freeEntry === true,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

/** The settings, plus a setter for one key. Persists on every change. */
export function useSettings(): [
  Settings,
  <K extends keyof Settings>(k: K, v: Settings[K]) => void,
] {
  const [settings, setSettings] = useState<Settings>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings))
    } catch {
      // A full or disabled store just means the choice doesn't outlive the tab.
    }
  }, [settings])

  const set = useCallback(<K extends keyof Settings>(k: K, v: Settings[K]) => {
    setSettings((s) => ({ ...s, [k]: v }))
  }, [])

  return [settings, set]
}
