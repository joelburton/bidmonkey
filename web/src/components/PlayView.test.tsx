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

describe('a played card lands in the trick slot under the hand that played it', () => {
  it('hero South: West → left, East → right, South → bottom', async () => {
    render(<PlayView problem={problem('S')} contract={contract} answers={[]} />)
    await waitFor(() => expect(screen.getByText(/play freely/i)).toBeInTheDocument())
    const user = userEvent.setup()

    await playCard(user, '2 of clubs') // West's card
    expect(screen.getByLabelText('2 of clubs').closest('.trick-l')).not.toBeNull()
    expect(screen.getByLabelText('2 of clubs').closest('.trick-r')).toBeNull()

    await playCard(user, 'king of clubs') // East's card
    expect(screen.getByLabelText('king of clubs').closest('.trick-r')).not.toBeNull()

    await playCard(user, 'queen of clubs') // South (hero) — bottom
    expect(screen.getByLabelText('queen of clubs').closest('.trick-b')).not.toBeNull()
  })

  it('hero West: South → right, North → left (orientation follows the hero)', async () => {
    render(<PlayView problem={problem('W')} contract={contract} answers={[]} />)
    await waitFor(() => expect(screen.getByText(/play freely/i)).toBeInTheDocument())
    const user = userEvent.setup()

    await playCard(user, 'queen of clubs') // South's card → right for hero West
    expect(screen.getByLabelText('queen of clubs').closest('.trick-r')).not.toBeNull()
    expect(screen.getByLabelText('queen of clubs').closest('.trick-l')).toBeNull()
  })
})
