import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Explanation } from './Explanation'

describe('Explanation', () => {
  it('renders "-" lines as a bulleted list and indents paragraphs after the first', () => {
    const { container } = render(<Explanation text={'Intro.\n- one\n- two\nAfter.'} />)

    const items = container.querySelectorAll('li')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toBe('one')

    const paras = container.querySelectorAll('p')
    expect(paras).toHaveLength(2) // "Intro." and "After."
    expect(paras[0].className).not.toContain('indent') // first flush-left
    expect(paras[1].className).toContain('indent') // later paragraphs indented
  })

  it('renders a single line as one un-indented paragraph', () => {
    const { container } = render(<Explanation text={'Just one line.'} />)
    const paras = container.querySelectorAll('p')
    expect(paras).toHaveLength(1)
    expect(paras[0].className).not.toContain('indent')
    expect(container.querySelectorAll('li')).toHaveLength(0)
  })
})
