import { useRef } from 'react'
import type { PointerEvent } from 'react'

// A tap moves the pointer less than this (px) between press and release; more
// than this is a drag/scroll, not a tap.
const TAP_SLOP = 10

/**
 * Handlers that fire `onTap` on a tap/click but NOT on a drag or scroll: we
 * record the pointer-down position and only fire if the pointer barely moved
 * before release. This lets the answer popup be dismissed by tapping anywhere on
 * it while a touch-drag to scroll its (scrollable) content still scrolls instead
 * of dismissing. A plain onClick would mostly work — the browser suppresses
 * click after a touch-scroll — but this makes the intent explicit and also
 * covers a mouse click-drag on desktop.
 */
export function useTapDismiss(onTap: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null)
  return {
    onPointerDown: (e: PointerEvent) => {
      start.current = { x: e.clientX, y: e.clientY }
    },
    onPointerUp: (e: PointerEvent) => {
      const s = start.current
      start.current = null
      if (!s) return
      if (Math.abs(e.clientX - s.x) < TAP_SLOP && Math.abs(e.clientY - s.y) < TAP_SLOP) onTap()
    },
  }
}
