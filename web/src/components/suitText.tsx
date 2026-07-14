/** Render explanation text, coloring red suits (♥ ♦) red and black suits (♠ ♣)
 * light so both read on the dark popup. U+FE0E forces text (non-emoji)
 * presentation so the color reliably applies. */
export function withSuits(text: string) {
  const TP = '︎'
  return text.split(/([♥♦♠♣])/).map((part, i) => {
    if (part === '♥' || part === '♦')
      return (
        <span key={i} className="suit-red-text">
          {part + TP}
        </span>
      )
    if (part === '♠' || part === '♣')
      return (
        <span key={i} className="suit-black-text">
          {part + TP}
        </span>
      )
    return <span key={i}>{part}</span>
  })
}
