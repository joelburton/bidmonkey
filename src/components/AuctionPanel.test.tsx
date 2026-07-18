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
        answerKind: 'bid',
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

describe('AuctionPanel bid MC — typed bid entry', () => {
  // A bid multiple-choice question also accepts a typed bid (level then strain),
  // like the free bid pad, in addition to its a/b/c option letters.
  it('typing the answer bid ("3h") grades correct and advances', async () => {
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
    await user.keyboard('3') // level (no option 'c'/'d' ambiguity: level pending)
    await user.keyboard('h') // strain -> submits 3H
    expect(screen.getByText('Correct!')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(onAnswer).toHaveBeenCalledWith('3H')
  })

  it('typing a non-answer bid ("2h") grades wrong and lets you retry', async () => {
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
    await user.keyboard('2')
    await user.keyboard('h') // 2H — not the answer (3H)
    expect(screen.getByText('Not quite')).toBeInTheDocument()
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('still picks options by letter (a = 2H, wrong)', async () => {
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
    await user.keyboard('a') // option a = 2H (no level pending → letter shortcut)
    expect(screen.getByText('Not quite')).toBeInTheDocument()
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
          answerKind: 'bid',
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

describe('AuctionPanel free-form (text) question', () => {
  const textProblem: Problem = {
    slug: 'text-q',
    tags: [],
    hero: 'S',
    dealer: 'S',
    vulnerability: null,
    deal: {},
    auction: [
      {
        question: {
          id: 'q1',
          answerKind: 'text',
          choiceType: 'multiple_choice',
          prompt: 'At what vulnerability would you preempt 4♠?',
          answer: 'Only non-vulnerable', // option b
          options: ['Any vulnerability', 'Only non-vulnerable', 'Only vulnerable'],
          explanation: 'Best when not vulnerable.',
        },
      },
    ],
  }

  it('renders the prompt and phrase options, and grades the text answer', async () => {
    const onAnswer = vi.fn()
    render(
      <AuctionPanel
        problem={textProblem}
        answers={[]}
        onAnswer={onAnswer}
        onPlay={() => {}}
        onNext={() => {}}
        hasNext={false}
        canPlay={false}
      />,
    )
    const user = userEvent.setup()

    // The prompt shows and the options are the literal phrases (not bids).
    expect(screen.getByText('At what vulnerability would you preempt 4♠?')).toBeInTheDocument()
    expect(screen.getByText('Any vulnerability')).toBeInTheDocument()

    // Wrong phrase (a) → retry.
    await user.keyboard('a')
    expect(screen.getByText('Not quite')).toBeInTheDocument()
    await user.keyboard('{Escape}')

    // Correct phrase (b) → advances with the text answer verbatim on dismiss.
    await user.keyboard('b')
    expect(screen.getByText('Correct!')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(onAnswer).toHaveBeenCalledWith('Only non-vulnerable')
  })
})
