// App-facing play module: the pure bridge rules live in ./libs/play (re-exported
// here so existing imports keep working); this file adds the hero-relative screen
// layout, which is presentation, not bridge logic.
import type { Seat } from './types'
import { nextSeat, prevSeat, partnerOf } from './libs/play'

export * from './libs/play'

export type Pos = 'top' | 'bottom' | 'left' | 'right'

/**
 * Where each seat sits on screen, oriented to the hero: hero at the bottom,
 * partner across (top), left-hand opponent on the left, right-hand opponent on
 * the right. Hands AND the trick both use this so a played card lands under the
 * hand that played it — for any hero seat.
 */
export function seatLayout(hero: Seat): Record<Seat, Pos> {
  const m = {} as Record<Seat, Pos>
  m[hero] = 'bottom'
  m[partnerOf(hero)] = 'top'
  m[nextSeat(hero)] = 'left' // LHO
  m[prevSeat(hero)] = 'right' // RHO
  return m
}
