import { describe, it, expect } from 'vitest'
import type { Seat } from '../types'
import {
  handToCards,
  ledSuit,
  legalCards,
  isLegalPlay,
  seatToAct,
} from './play'

const trick = (...cards: string[]) => cards.map((card) => ({ card }))

describe('handToCards', () => {
  it('lists every card in display order (S, H, C, D)', () => {
    expect(handToCards({ S: 'AK', H: '2', C: '9', D: 'QJ' })).toEqual([
      'SA', 'SK', 'H2', 'C9', 'DQ', 'DJ',
    ])
  })
  it('skips absent and empty suits', () => {
    expect(handToCards({ S: '', H: 'A' })).toEqual(['HA'])
  })
})

describe('ledSuit', () => {
  it('is null when the trick is empty (nobody has led)', () => {
    expect(ledSuit(trick())).toBeNull()
  })
  it('is the suit of the first card played', () => {
    expect(ledSuit(trick('HQ', 'H4'))).toBe('H')
    expect(ledSuit(trick('C7'))).toBe('C')
  })
})

describe('legalCards / isLegalPlay', () => {
  const hand = { S: 'AK', H: 'Q2', D: '5' }

  it('leading: every card is legal', () => {
    expect(legalCards(hand, trick())).toEqual(['SA', 'SK', 'HQ', 'H2', 'D5'])
    expect(isLegalPlay(hand, trick(), 'D5')).toBe(true)
  })

  it('must follow the led suit when holding it', () => {
    expect(legalCards(hand, trick('H7'))).toEqual(['HQ', 'H2'])
    expect(isLegalPlay(hand, trick('H7'), 'HQ')).toBe(true)
    expect(isLegalPlay(hand, trick('H7'), 'SA')).toBe(false) // can follow, so can't break suit
    expect(isLegalPlay(hand, trick('H7'), 'D5')).toBe(false)
  })

  it('may play anything when void in the led suit', () => {
    expect(legalCards(hand, trick('C7'))).toEqual(['SA', 'SK', 'HQ', 'H2', 'D5'])
    expect(isLegalPlay(hand, trick('C7'), 'SA')).toBe(true)
  })
})

describe('seatToAct', () => {
  it('is the leader when no card is down yet', () => {
    expect(seatToAct('S', trick())).toBe('S')
  })
  it('advances clockwise as the trick fills (N → E → S → W)', () => {
    const seq = (['N', 'E', 'S', 'W'] as Seat[]).map((_, i) =>
      seatToAct('N', trick(...Array(i).fill('C2'))),
    )
    expect(seq).toEqual(['N', 'E', 'S', 'W'])
  })
  it('wraps around the table from any leader', () => {
    expect(seatToAct('E', trick('C2'))).toBe('S')
    expect(seatToAct('W', trick('C2', 'C3'))).toBe('E') // W → N → E
  })
})
