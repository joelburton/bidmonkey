import { describe, it, expect } from 'vitest'
import type { Problem } from '../types'
import { problemToText } from './problemText'

// Problems are built inline rather than taken from data/problems.ts: these
// assertions are about the *format*, so they shouldn't move when a fixture's
// content is edited.
const base: Problem = {
  slug: 'p1',
  tags: [],
  hero: 'S',
  dealer: 'N',
  vulnerability: 'none',
  deal: {},
  auction: [],
}
const make = (p: Partial<Problem>): Problem => ({ ...base, ...p })

/** The one line starting with `prefix`, for asserting without pinning layout. */
const line = (text: string, prefix: string) =>
  text.split('\n').find((l) => l.trimStart().startsWith(prefix))

describe('problemToText — hands', () => {
  it('writes suits S-H-D-C with ranks spaced and T as 10', () => {
    const text = problemToText(make({ deal: { N: { S: 'AKT', H: '9', D: 'Q2', C: '3' } } }), [])
    expect(line(text, 'North')).toBe('  North       ♠ A K 10   ♥ 9   ♦ Q 2   ♣ 3')
  })

  it('shows a void as a dash rather than omitting the suit', () => {
    const text = problemToText(make({ deal: { N: { S: 'AK', D: 'Q', C: '32' } } }), [])
    expect(line(text, 'North')).toContain('♥ —')
  })

  it('marks the hero beside the seat name, not at the end of the line', () => {
    const text = problemToText(make({ hero: 'S', deal: { S: { S: 'A' } } }), [])
    expect(line(text, 'South')).toMatch(/^ {2}South \(me\) /)
    expect(text).not.toContain('<- me')
  })

  it('names the hands the problem does not give, agreeing in number', () => {
    const one = problemToText(make({ deal: { N: { S: 'A' }, E: { S: 'K' }, S: { S: 'Q' } } }), [])
    expect(one).toContain('(West is not given.)')
    const three = problemToText(make({ deal: { S: { S: 'A' } } }), [])
    expect(three).toContain('(North, East and West are not given.)')
  })
})

describe('problemToText — auction', () => {
  const auctionProblem = make({
    dealer: 'N',
    deal: { S: { S: 'A' } },
    auction: [
      { call: '1H' },
      { call: 'P' },
      { call: '1S' },
      { call: 'P' },
      { call: '2D*' },
      { call: 'X' },
      {
        question: {
          id: 'q1',
          answerKind: 'bid',
          choiceType: 'multiple_choice',
          prompt: 'Your call?',
          options: ['2NT', '3H'],
          answer: '3H',
          accept: ['2NT'],
          explanation: 'Show the major.',
        },
      },
    ],
  })

  it('lays the auction out in W-N-E-S columns, blank before the dealer', () => {
    const rows = problemToText(auctionProblem, []).split('\n')
    const head = rows.findIndex((r) => r === 'Auction:')
    expect(rows[head + 1]).toBe('  West   North  East   South')
    // North dealt, so West's cell on the first row is empty, not a call.
    expect(rows[head + 2]).toBe('         1♥     Pass   1♠')
    expect(rows[head + 3]).toBe('  Pass   2♦!    Dbl    ?')
  })

  it('explains the alert mark only when a call carries one', () => {
    expect(problemToText(auctionProblem, [])).toContain('(! marks an alertable call.)')
    const noAlert = problemToText(make({ deal: { S: { S: 'A' } }, auction: [{ call: '1H' }] }), [])
    expect(noAlert).not.toContain('alertable')
  })

  it('hides the calls after the current question', () => {
    const text = problemToText(
      make({
        deal: { S: { S: 'A' } },
        auction: [
          { call: '1H' },
          { question: { id: 'q', answerKind: 'bid', choiceType: 'free', answer: 'X' } },
          { call: '4S' },
        ],
      }),
      [],
    )
    expect(text).not.toContain('4♠')
  })

  it('states the contract once the auction is answered out', () => {
    const text = problemToText(auctionProblem, ['3H'])
    expect(text).toContain('Final contract: 3♥ by North.')
    expect(text).not.toContain("It is South's turn")
  })

  it('gives the stored contract, and no auction verdict, when there is no auction', () => {
    const text = problemToText(
      make({ deal: { S: { S: 'A' } }, contract: '4S by E', play: [{ cards: [] }] }),
      [],
    )
    expect(text).toContain('Contract: 4S by E (no auction given).')
    expect(text).not.toContain('passed out')
    expect(text).not.toContain('Auction:')
  })

  it('reports a passed-out auction rather than a contract', () => {
    const text = problemToText(
      make({ auction: [{ call: 'P' }, { call: 'P' }, { call: 'P' }, { call: 'P' }] }),
      [],
    )
    expect(text).toContain('The auction is over (passed out).')
  })
})

describe('problemToText — the question', () => {
  it('gives the prompt, the choices, the answer and the reasoning', () => {
    // South deals and the question is the first call, so the hero is on lead.
    const text = problemToText(
      make({
        dealer: 'S',
        deal: { S: { S: 'A' } },
        auction: [
          {
            question: {
              id: 'q',
              answerKind: 'bid',
              choiceType: 'multiple_choice',
              prompt: 'Your call?',
              options: ['3H', '4H'],
              answer: '3H',
              accept: ['4H'],
              explanation: 'Because.',
            },
          },
        ],
      }),
      [],
    )
    expect(text).toContain("It is South's turn, and that is the question.")
    expect(text).toContain('Prompt: Your call?')
    expect(text).toContain('Choices offered: 3♥ / 4♥')
    expect(text).toContain("The book's answer: 3♥")
    expect(text).toContain('Also accepted: 4♥')
    expect(text).toContain("The book's reasoning: Because.")
  })

  it('leaves a text answer as written, rather than reading it as a call', () => {
    const text = problemToText(
      make({
        deal: { S: { S: 'A' } },
        auction: [
          {
            question: {
              id: 'q',
              answerKind: 'text',
              choiceType: 'multiple_choice',
              prompt: 'At what vulnerability?',
              options: ['Any vulnerability', 'Only non-vulnerable'],
              answer: 'Only non-vulnerable',
            },
          },
        ],
      }),
      [],
    )
    expect(text).toContain('Choices offered: Any vulnerability / Only non-vulnerable')
    expect(text).toContain("The book's answer: Only non-vulnerable")
  })

  it('omits the choices line for a free question', () => {
    const text = problemToText(
      make({
        deal: { S: { S: 'A' } },
        auction: [{ question: { id: 'q', answerKind: 'bid', choiceType: 'free', answer: '4NT' } }],
      }),
      [],
    )
    expect(text).not.toContain('Choices offered')
    expect(text).toContain("The book's answer: 4NT")
  })
})

describe('problemToText — play and trimmings', () => {
  it('lists the tricks and stars the cards the problem asks for', () => {
    const text = problemToText(
      make({
        deal: { S: { S: 'A' } },
        play: [
          {
            cards: [
              {
                seat: 'S',
                question: { id: 'c1', answerKind: 'card', choiceType: 'free', answer: 'HQ' },
              },
              { seat: 'W', card: 'HT' },
            ],
          },
          { cards: [{ seat: 'E', card: 'SA' }] },
        ],
      }),
      [],
    )
    expect(line(text, 'Trick 1:')).toBe('  Trick 1: S ♥Q*, W ♥10')
    expect(line(text, 'Trick 2:')).toBe('  Trick 2: E ♠A')
    expect(text).toContain('(* marks a card the problem asks me to choose.)')
  })

  it('says so when the problem states no vulnerability', () => {
    expect(problemToText(make({ vulnerability: null }), [])).toContain('Vulnerability: not stated.')
    expect(problemToText(make({ vulnerability: 'both' }), [])).toContain('Vulnerability: Both.')
  })

  it('opens with framing and ends with exactly one newline, no blank runs', () => {
    const text = problemToText(make({ deal: { S: { S: 'A' } }, commentary: 'A note.' }), [])
    expect(text.startsWith("Here's a bridge problem I'm working through.")).toBe(true)
    expect(text).toContain('Commentary: A note.')
    expect(text.endsWith('\n')).toBe(true)
    expect(text.endsWith('\n\n')).toBe(false)
    expect(text).not.toMatch(/\n{3}/)
  })
})
