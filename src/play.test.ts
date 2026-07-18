import { describe, it, expect } from 'vitest'
import type { Seat } from './types'
import {
  nextSeat,
  prevSeat,
  partnerOf,
  seatLayout,
  trickWinner,
  handRemaining,
  flattenPlay,
} from './play'

describe('seating', () => {
  it('next / prev / partner are clockwise-consistent', () => {
    expect(nextSeat('S')).toBe('W')
    expect(prevSeat('S')).toBe('E')
    expect(partnerOf('S')).toBe('N')
    expect(nextSeat('W')).toBe('N')
    expect(partnerOf('E')).toBe('W')
  })
  it('seatLayout orients to the hero (bottom / partner top / LHO left / RHO right)', () => {
    expect(seatLayout('S')).toEqual({ S: 'bottom', N: 'top', W: 'left', E: 'right' })
    expect(seatLayout('W')).toEqual({ W: 'bottom', E: 'top', N: 'left', S: 'right' })
    expect(seatLayout('N')).toEqual({ N: 'bottom', S: 'top', E: 'left', W: 'right' })
  })
})

describe('trickWinner', () => {
  const t = (...cards: [Seat, string][]) => cards.map(([seat, card]) => ({ seat, card }))
  it('highest of the led suit wins at notrump', () => {
    expect(trickWinner(t(['S', 'HQ'], ['W', 'H4'], ['N', 'H2'], ['E', 'HA']), 'NT')).toBe('E')
  })
  it('a trump beats the led suit', () => {
    expect(trickWinner(t(['S', 'HA'], ['W', 'S2'], ['N', 'H3'], ['E', 'HK']), 'S')).toBe('W')
  })
  it('an off-suit discard cannot win', () => {
    expect(trickWinner(t(['S', 'HA'], ['W', 'CK'], ['N', 'H2'], ['E', 'H5']), 'S')).toBe('S')
  })
  it('highest trump wins when several trump', () => {
    expect(trickWinner(t(['S', 'D2'], ['W', 'S9'], ['N', 'SK'], ['E', 'D3']), 'S')).toBe('N')
  })
})

describe('handRemaining', () => {
  it('removes played cards, keeping only the suits present', () => {
    expect(handRemaining({ S: 'AKQ', H: '32' }, ['SK', 'H2'])).toEqual({ S: 'AQ', H: '3' })
    expect(handRemaining({ S: 'A' }, ['SA'])).toEqual({ S: '' })
  })
})

describe('flattenPlay', () => {
  it('flattens tricks into ordered moves with trick indices', () => {
    const moves = flattenPlay([
      {
        cards: [
          { seat: 'S', question: { id: 'p1', answerKind: 'card', choiceType: 'multiple_choice', answer: 'HQ' } },
          { seat: 'W', card: 'H4' },
        ],
      },
      { cards: [{ seat: 'E', card: 'SA' }] },
    ])
    expect(moves).toHaveLength(3)
    expect(moves[0]).toMatchObject({ seat: 'S', trickIndex: 0, lastInTrick: false })
    expect(moves[0].question).toBeDefined()
    expect(moves[1]).toMatchObject({ seat: 'W', card: 'H4', trickIndex: 0, lastInTrick: true })
    expect(moves[2]).toMatchObject({ seat: 'E', card: 'SA', trickIndex: 1, lastInTrick: true })
  })
})
