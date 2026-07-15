import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Problem, Seat } from '../types'
import type { Contract } from '../bidding'
import { PlayView } from './PlayView'

// A legal 52-card deal; each hand has a card unique to it (used to identify it).
const deal = {
  N: { S: 'T6', H: '7632', D: 'QT9', C: 'AJT9' },
  E: { S: 'AKQ84', H: 'A5', D: 'K72', C: 'K43' }, // king of clubs is East's only
  S: { S: '75', H: 'QJT9', D: 'J843', C: 'Q65' }, // queen of clubs is South's only
  W: { S: 'J932', H: 'K84', D: 'A65', C: '872' }, // 2 of clubs is West's only
}
function problem(hero: Seat): Problem {
  return { id: 1, tags: [], hero, dealer: 'E', vulnerability: 'none', deal, auction: [], play: [] }
}
// declarer East → dummy West; with no recorded play the table reveals immediately.
const contract: Contract = { level: 4, strain: 'S', declarer: 'E', doubled: '' }

// Two-tap: first click selects the card, second plays it.
async function playCard(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByLabelText(label))
  await user.click(screen.getByLabelText(label))
}

// Declarer East → opening leader is South (declarer's LHO), so a legal free-play
// trick goes South → West → North → East (clockwise), each following clubs.
describe('a played card lands in the trick slot under the hand that played it', () => {
  it('hero South: South → bottom, West → left, North → top, East → right', async () => {
    render(<PlayView problem={problem('S')} contract={contract} answers={[]} />)
    await waitFor(() => expect(screen.getByText(/play freely/i)).toBeInTheDocument())
    const user = userEvent.setup()

    await playCard(user, 'queen of clubs') // South (hero) leads — bottom
    expect(screen.getByLabelText('queen of clubs').closest('.trick-b')).not.toBeNull()

    await playCard(user, '2 of clubs') // West follows — left
    expect(screen.getByLabelText('2 of clubs').closest('.trick-l')).not.toBeNull()
    expect(screen.getByLabelText('2 of clubs').closest('.trick-r')).toBeNull()

    await playCard(user, 'ace of clubs') // North follows — top
    expect(screen.getByLabelText('ace of clubs').closest('.trick-t')).not.toBeNull()

    await playCard(user, 'king of clubs') // East follows — right
    expect(screen.getByLabelText('king of clubs').closest('.trick-r')).not.toBeNull()
  })

  it('hero West: South → right (orientation follows the hero)', async () => {
    render(<PlayView problem={problem('W')} contract={contract} answers={[]} />)
    await waitFor(() => expect(screen.getByText(/play freely/i)).toBeInTheDocument())
    const user = userEvent.setup()

    await playCard(user, 'queen of clubs') // South (opening leader) → right for hero West
    expect(screen.getByLabelText('queen of clubs').closest('.trick-r')).not.toBeNull()
    expect(screen.getByLabelText('queen of clubs').closest('.trick-l')).toBeNull()
  })
})

// The rules themselves let us assert what free play now forbids: you can't play
// out of turn, and you can't break suit while you can follow.
describe('free play enforces legal turn order and following suit', () => {
  it('only the seat on lead can be clicked first (out-of-turn hands are inert)', async () => {
    render(<PlayView problem={problem('S')} contract={contract} answers={[]} />)
    await waitFor(() => expect(screen.getByText(/play freely/i)).toBeInTheDocument())
    const user = userEvent.setup()

    // It is South's lead. West's 2♣ must not respond yet: clicking it twice
    // neither selects nor plays it (it stays in West's hand, out of the trick).
    await playCard(user, '2 of clubs')
    expect(screen.getByLabelText('2 of clubs').closest('.trick-l')).toBeNull()
    expect(screen.getByLabelText('2 of clubs').closest('.slot.selected')).toBeNull()

    // South can lead, and then it becomes West's turn to follow.
    await playCard(user, 'queen of clubs')
    expect(screen.getByLabelText('queen of clubs').closest('.trick-b')).not.toBeNull()
    await playCard(user, '2 of clubs')
    expect(screen.getByLabelText('2 of clubs').closest('.trick-l')).not.toBeNull()
  })

  it('a card that breaks suit while able to follow is inert', async () => {
    render(<PlayView problem={problem('S')} contract={contract} answers={[]} />)
    await waitFor(() => expect(screen.getByText(/play freely/i)).toBeInTheDocument())
    const user = userEvent.setup()

    await playCard(user, 'queen of clubs') // South leads clubs
    // West holds clubs (872), so its spade must not respond.
    await playCard(user, 'jack of spades') // West's ♠J — off suit, illegal
    expect(screen.getByLabelText('jack of spades').closest('.trick-l')).toBeNull()
    // The legal follow does respond.
    await playCard(user, '2 of clubs')
    expect(screen.getByLabelText('2 of clubs').closest('.trick-l')).not.toBeNull()
  })
})
