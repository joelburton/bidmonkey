import type { Suit } from '../types'
import { SuitGlyph } from './SuitGlyph'

const CHAR_TO_SUIT: Record<string, Suit> = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C' }

/** Render explanation text with the same SVG suit pips used everywhere else
 * (SuitGlyph) instead of Unicode glyphs. The pips carry a white outline, so on
 * the dark popup the black suits (♠ ♣) render truly black — not the washed-out
 * light grey the Unicode text needed to stay visible. */
export function withSuits(text: string) {
  return text.split(/([♥♦♠♣])/).map((part, i) => {
    const suit = CHAR_TO_SUIT[part]
    if (suit) return <SuitGlyph key={i} suit={suit} />
    return <span key={i}>{part}</span>
  })
}
