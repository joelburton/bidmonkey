import type { Problem } from '../types'

// Sample data for phase 2. Shapes match schema.v1.json so this drops in behind
// a real API later (replace this array with a fetch). Some problems intentionally
// omit hands — those seats render face-down.

export const problems: Problem[] = [
  {
    id: 1,
    title: 'Limit raise or game?',
    source: 'seed',
    difficulty: 2,
    tags: ['game-try', 'major-suit-raise', 'responder'],
    hero: 'S',
    dealer: 'N',
    vulnerability: 'none',
    deal: {
      N: { S: '43', H: 'AKJ85', D: 'AQ72', C: 'K5' },
      E: { S: '875', H: '632', D: '854', C: 'T432' },
      S: { S: 'KQ62', H: 'QT4', D: 'KJ63', C: '97' },
      W: { S: 'AJT9', H: '97', D: 'T9', C: 'AQJ86' },
    },
    auction: [
      { call: '1H' },
      { call: 'P' },
      { call: '1S' },
      { call: 'P' },
      { call: '2D' },
      { call: 'P' },
      {
        question: {
          id: 'q1',
          choiceType: 'multiple_choice',
          prompt: 'Partner opened 1H and reversed into 2D. Your call?',
          options: ['2NT', '3D', '3H', '4H'],
          answer: '3H',
          explanation:
            'The bidding starts 1♥ - 1♠; 2♦. You are too strong to sign off and not strong enough to insist on game. You should make a game try, leaving the final decision to your partner. You have good support for both hearts and diamonds, but you should bid 3♥, showing your fit in the major. Eleven tricks is a tough target, so bidding game in a minor suit is something you should seek to avoid. Answer: (c) 3♥.',
        },
      },
    ],
  },

  {
    id: 2,
    title: 'Your call as responder',
    source: 'seed',
    difficulty: 1,
    tags: ['responder', 'one-level-response'],
    hero: 'S',
    dealer: 'N',
    vulnerability: 'ns',
    // Only your hand is shown — partner and opponents are hidden.
    deal: {
      S: { S: 'AQJ95', H: 'KQ', D: 'A83', C: '742' },
    },
    auction: [
      { call: '1S' },
      { call: 'P' },
      {
        question: {
          id: 'q1',
          choiceType: 'multiple_choice',
          prompt: 'Partner opened 1S. Your call?',
          options: ['2S', '3S', '4S', '2NT'],
          answer: '4S',
          explanation: 'Placeholder — not checked yet.',
        },
      },
    ],
    commentary: 'Bidding-only; other hands hidden during the auction.',
  },

  {
    id: 3,
    title: 'Partnership slam try',
    source: 'seed',
    difficulty: 3,
    tags: ['slam', 'partnership'],
    hero: 'S',
    dealer: 'W',
    vulnerability: 'both',
    // North and South shown; East and West hidden.
    deal: {
      N: { S: 'KQ4', H: 'A32', D: 'KQJ5', C: 'A98' },
      S: { S: 'A32', H: 'KQ4', D: 'A98', C: 'KQJ5' },
    },
    auction: [
      { call: 'P' },
      { call: '1D' },
      { call: 'P' },
      {
        question: {
          id: 'q1',
          choiceType: 'multiple_choice',
          prompt: 'Partner opened 1D. Your call?',
          options: ['1NT', '2NT', '3NT', '2C'],
          answer: '3NT',
          explanation: 'Placeholder — not checked yet.',
        },
      },
    ],
    commentary: 'Two balanced powerhouses — how high can you go?',
  },
]
