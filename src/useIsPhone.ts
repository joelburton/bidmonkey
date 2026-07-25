import { useEffect, useState } from 'react'

// Phone-width viewports: at/below the app's 30rem max-width the table is full-
// bleed, so it sits in the screen's rounded corners. Above it, the app is a
// centered column clear of the edges.
const QUERY = '(max-width: 480px)'

/** True on phone-width viewports. Updates on resize / orientation change. Used to
 * give the bottom (South) hand a little extra card height so a real phone's
 * rounded bottom corners clip only blank white, never a rank or pip. */
export function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const on = () => setIsPhone(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return isPhone
}
