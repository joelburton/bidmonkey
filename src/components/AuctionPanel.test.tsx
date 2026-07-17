import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

describe('AuctionPanel accepted alternative answers', () => {
  // Same question, but 4H is also accepted (option c). Picking it is graded
  // correct, yet the auction must advance with the canonical answer (3H) — not
  // the clicked call — since buildAuction replays the authored continuation
  // assuming `answer` was bid.
  const withAccept: Problem = {
    ...problem,
    auction: [
      { call: '1H' },
      { call: 'P' },
      {
        question: {
          id: 'q1',
          choiceType: 'multiple_choice',
          prompt: 'Your call?',
          answer: '3H', // option b
          accept: ['4H'], // option c, also correct
          options: ['2H', '3H', '4H'],
          explanation: 'A limit raise (game is fine too).',
        },
      },
    ],
  }

  it('grades the accepted alternative correct but advances with the canonical answer', async () => {
    const onAnswer = vi.fn()
    render(
      <AuctionPanel
        problem={withAccept}
        answers={[]}
        onAnswer={onAnswer}
        onPlay={() => {}}
        onNext={() => {}}
        hasNext={false}
        canPlay={false}
      />,
    )
    const user = userEvent.setup()

    // Answer with the accepted alternative 4H (option c).
    await user.keyboard('c')
    // An accepted-but-non-canonical answer reads "Alternate", not "Correct!".
    expect(screen.getByText('Alternate')).toBeInTheDocument()
    expect(screen.queryByText('Correct!')).not.toBeInTheDocument()
    expect(onAnswer).not.toHaveBeenCalled() // only on dismiss

    await user.keyboard('{Escape}')
    // Advances with the canonical 3H, NOT the clicked 4H.
    expect(onAnswer).toHaveBeenCalledWith('3H')
  })
})

describe('AuctionPanel answer popup dismissal', () => {
  it('a tap on the popup dismisses it; a drag (scroll) does not', async () => {
    const onAnswer = vi.fn()
    render(
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
    await user.keyboard('b') // correct (3H)
    const popup = screen.getByRole('dialog', { name: 'Answer' })

    // A drag on the popup (scrolling the explanation) must NOT dismiss.
    fireEvent.pointerDown(popup, { clientX: 100, clientY: 100 })
    fireEvent.pointerUp(popup, { clientX: 100, clientY: 170 })
    expect(onAnswer).not.toHaveBeenCalled()
    expect(screen.getByText('Correct!')).toBeInTheDocument()

    // A tap on the popup (negligible movement) dismisses and advances.
    fireEvent.pointerDown(popup, { clientX: 100, clientY: 100 })
    fireEvent.pointerUp(popup, { clientX: 101, clientY: 103 })
    expect(onAnswer).toHaveBeenCalledWith('3H')
  })
})
