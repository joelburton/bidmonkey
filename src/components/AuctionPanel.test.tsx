import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Problem } from '../types'
import { AuctionPanel } from './AuctionPanel'

const problem: Problem = {
  slug: 'test-problem',
  tags: [],
  hero: 'S',
  dealer: 'N',
  vulnerability: 'none',
  deal: {},
  auction: [
    { call: '1H' },
    { call: 'P' },
    {
      question: {
        id: 'q1',
        choiceType: 'multiple_choice',
        prompt: 'Your call?',
        answer: '3H', // option b
        options: ['2H', '3H', '4H'],
        explanation: 'A limit raise.',
      },
    },
  ],
}

describe('AuctionPanel multiple-choice', () => {
  it('shows an option per choice; wrong lets you retry, correct advances on dismiss', async () => {
    const onAnswer = vi.fn()
    const { container } = render(
      <AuctionPanel
        problem={problem}
        answers={[]}
        onAnswer={onAnswer}
        onPlay={() => {}}
        onNext={() => {}}
        hasNext={false}
        canPlay={false}
      />,
    )
    const user = userEvent.setup()
    expect(container.querySelectorAll('.opt-btn')).toHaveLength(3)

    // wrong (a = 2H)
    await user.keyboard('a')
    expect(screen.getByText('Not quite')).toBeInTheDocument()
    expect(onAnswer).not.toHaveBeenCalled()

    await user.keyboard('{Escape}') // dismiss -> retry
    expect(screen.queryByText('Not quite')).toBeNull()

    // correct (b = 3H)
    await user.keyboard('b')
    expect(screen.getByText('Correct!')).toBeInTheDocument()
    expect(onAnswer).not.toHaveBeenCalled() // only on dismiss

    await user.keyboard('{Escape}')
    expect(onAnswer).toHaveBeenCalledWith('3H')
  })

  it('a key that dismisses the popup does not reopen it (answer buttons never hold focus)', async () => {
    const { container } = render(
      <AuctionPanel
        problem={problem}
        answers={[]}
        onAnswer={vi.fn()}
        onPlay={() => {}}
        onNext={() => {}}
        hasNext={false}
        canPlay={false}
      />,
    )
    const user = userEvent.setup()
    const opts = container.querySelectorAll('.opt-btn')

    await user.click(opts[0]) // wrong (2H) via mouse
    expect(screen.getByText('Not quite')).toBeInTheDocument()
    // The button must not have taken focus, or Enter/Space would re-click it.
    expect(document.activeElement).not.toBe(opts[0])

    await user.keyboard('{Enter}') // dismiss — must not re-trigger the answer
    expect(screen.queryByText('Not quite')).toBeNull()
  })
})
