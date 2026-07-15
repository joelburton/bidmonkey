import { describe, it, expect } from 'vitest'
import type { Problem } from './types'
import {
  parseBid,
  bidRank,
  levelLegal,
  bidLegal,
  doubleState,
  buildAuction,
  finalContract,
  auctionQuestionCount,
} from './bidding'

describe('parseBid / bidRank', () => {
  it('parses bids (NT as N or NT) and rejects non-bids', () => {
    expect(parseBid('1C')).toEqual({ level: 1, strain: 'C' })
    expect(parseBid('3NT')).toEqual({ level: 3, strain: 'NT' })
    expect(parseBid('1N')).toEqual({ level: 1, strain: 'NT' })
    expect(parseBid('P')).toBeNull()
    expect(parseBid('X')).toBeNull()
  })
  it('ranks bids in bridge order', () => {
    expect(bidRank(1, 'C')).toBeLessThan(bidRank(1, 'D'))
    expect(bidRank(1, 'S')).toBeLessThan(bidRank(1, 'NT'))
    expect(bidRank(1, 'NT')).toBeLessThan(bidRank(2, 'C'))
    expect(bidRank(3, 'NT')).toBeLessThan(bidRank(4, 'C'))
  })
})

describe('legality', () => {
  it('allows only bids that outrank the auction', () => {
    const prior = ['1H', 'P']
    expect(levelLegal(1, prior)).toBe(true) // 1S / 1NT still available
    expect(bidLegal(1, 'S', prior)).toBe(true)
    expect(bidLegal(1, 'C', prior)).toBe(false) // 1C < 1H
    expect(bidLegal(1, 'H', prior)).toBe(false) // equal, not higher
  })
  it('disables whole levels below the auction', () => {
    const prior = ['3NT']
    expect(levelLegal(3, prior)).toBe(false)
    expect(levelLegal(4, prior)).toBe(true)
  })
})

describe('doubleState', () => {
  it('doubles an opponent bid, not partner; redoubles their double', () => {
    expect(doubleState([{ seat: 'E', call: '3NT' }], 'S')).toBe('double')
    expect(doubleState([{ seat: 'N', call: '1H' }], 'S')).toBe(null)
    expect(
      doubleState([{ seat: 'N', call: '1H' }, { seat: 'E', call: 'X' }], 'S'),
    ).toBe('redouble')
    expect(doubleState([{ seat: 'E', call: 'P' }], 'S')).toBe(null)
  })
})

const twoQ: Problem = {
  slug: 'p1',
  tags: [],
  hero: 'S',
  dealer: 'N',
  vulnerability: 'none',
  deal: {},
  auction: [
    { call: '1H' },
    { call: 'P' },
    { question: { id: 'q1', choiceType: 'multiple_choice', answer: '1S', options: ['1S', '1NT'] } },
    { call: 'P' },
    { call: '2C' },
    { call: 'P' },
    { question: { id: 'q2', choiceType: 'multiple_choice', answer: '2NT', options: ['2NT', '3C'] } },
  ],
}

describe('buildAuction (multi-question)', () => {
  it('counts questions', () => {
    expect(auctionQuestionCount(twoQ)).toBe(2)
  })
  it('reveals up to the current question and advances with answers', () => {
    const m0 = buildAuction(twoQ, [])
    expect(m0.complete).toBe(false)
    expect(m0.actingSeat).toBe('S')
    expect(m0.question?.answer).toBe('1S')
    expect(m0.priorCalls).toEqual(['1H', 'P'])

    const m1 = buildAuction(twoQ, ['1S'])
    expect(m1.actingSeat).toBe('S')
    expect(m1.question?.answer).toBe('2NT')
    expect(m1.priorCalls).toEqual(['1H', 'P', '1S', 'P', '2C', 'P'])

    const m2 = buildAuction(twoQ, ['1S', '2NT'])
    expect(m2.complete).toBe(true)
    expect(m2.actingSeat).toBeNull()
    expect(m2.question).toBeNull()
  })
})

describe('finalContract', () => {
  const p4: Problem = {
    slug: 'p4',
    tags: [],
    hero: 'S',
    dealer: 'E',
    vulnerability: 'none',
    deal: {},
    auction: [
      { call: '1S' },
      { call: 'P' },
      { call: '3S' },
      { call: 'P' },
      { call: '4S' },
      { call: 'P' },
      { call: 'P' },
      { call: 'P' },
    ],
  }
  it('declarer is the first of the winning side to name the strain', () => {
    expect(finalContract(p4, [])).toEqual({
      level: 4,
      strain: 'S',
      declarer: 'E',
      doubled: '',
    })
  })
  it('is null when passed out', () => {
    const passed: Problem = { ...p4, auction: [{ call: 'P' }, { call: 'P' }, { call: 'P' }, { call: 'P' }] }
    expect(finalContract(passed, [])).toBeNull()
  })
})
