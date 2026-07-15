import type { Problem } from '../types'

// Sample data for phase 2. Shapes match schema.v1.json so this drops in behind
// a real API later (replace this array with a fetch). Some problems intentionally
// omit hands — those seats render face-down.

export const problems: Problem[] = [
  {
    slug: 'limit-raise-or-game',
    title: 'Limit raise or game?',
    source: 'fakebook',
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
      { call: 'P' },
      { call: '4H' },
      { call: 'P' },
      { call: 'P' },
      { call: 'P' },
    ],
  },

  {
    slug: 'your-call-as-responder',
    title: 'Your call as responder',
    source: 'fakebook',
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
    slug: 'partnership-slam-try',
    title: 'Partnership slam try',
    source: 'fakebook',
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

  {
    slug: 'choose-your-opening-lead',
    title: 'Choose your opening lead',
    source: 'fakebook',
    difficulty: 2,
    tags: ['opening-lead', 'defense', 'play'],
    hero: 'S',
    dealer: 'E',
    vulnerability: 'none',
    deal: {
      N: { S: 'T6', H: '7632', D: 'QT9', C: 'AJT9' },
      E: { S: 'AKQ84', H: 'A5', D: 'K72', C: 'K43' },
      S: { S: '75', H: 'QJT9', D: 'J843', C: 'Q65' },
      W: { S: 'J932', H: 'K84', D: 'A65', C: '872' },
    },
    // Full recorded auction, no questions — given to us; we click to play.
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
    play: [
      {
        cards: [
          {
            seat: 'S',
            question: {
              id: 'p1',
              choiceType: 'multiple_choice',
              prompt: 'Choose your opening lead.',
              answer: 'HQ',
              options: ['HQ', 'S7', 'DJ', 'C5'],
              explanation:
                'Lead the top of your ♥ sequence (♥QJT) — safe and attacking against 4♠. Answer: ♥Q.',
            },
          },
          { seat: 'W', card: 'H4' },
          { seat: 'N', card: 'H2' },
          { seat: 'E', card: 'HA' },
        ],
      },
      {
        cards: [
          { seat: 'E', card: 'SA' },
          { seat: 'S', card: 'S5' },
          { seat: 'W', card: 'S2' },
          { seat: 'N', card: 'S6' },
        ],
      },
    ],
  },

  {
    slug: 'defend-four-spades',
    title: 'Defend 4♠ (card-entry demo)',
    source: 'fakebook',
    difficulty: 2,
    tags: ['defense', 'play', 'card-entry'],
    hero: 'S',
    dealer: 'E',
    vulnerability: 'none',
    deal: {
      N: { S: 'T6', H: '7632', D: 'QT9', C: 'AJT9' },
      E: { S: 'AKQ84', H: 'A5', D: 'K72', C: 'K43' },
      S: { S: '75', H: 'QJT9', D: 'J843', C: 'Q65' },
      W: { S: 'J932', H: 'K84', D: 'A65', C: '872' },
    },
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
    // enter_card questions with NO prompt → the turn arrow points at your hand.
    play: [
      {
        cards: [
          {
            seat: 'S',
            question: {
              id: 'p1',
              choiceType: 'enter_card',
              answer: 'HQ',
              accept: ['HJ'], // ♥J is accepted, but the canonical ♥Q is what lands
              explanation:
                'Lead the top of your ♥ sequence (♥QJT) against 4♠. ♥J is graded correct too — but ♥Q is the card that actually goes on the table.',
            },
          },
          { seat: 'W', card: 'H4' },
          { seat: 'N', card: 'H2' },
          { seat: 'E', card: 'HA' },
        ],
      },
      {
        cards: [
          { seat: 'E', card: 'SA' },
          {
            seat: 'S',
            question: {
              id: 'p2',
              choiceType: 'enter_card',
              answer: 'S5',
              explanation: 'Follow suit — nothing to gain by splitting. Answer: ♠5.',
            },
          },
          { seat: 'W', card: 'S2' },
          { seat: 'N', card: 'S6' },
        ],
      },
    ],
    commentary:
      'Card-entry demo: when it is your turn to play, an arrow points at your hand. On the lead, ♥J is accepted but ♥Q is what lands.',
  },

  {
    slug: 'two-decisions',
    title: 'Two decisions',
    source: 'fakebook',
    difficulty: 2,
    tags: ['responder', 'two-decisions'],
    hero: 'S',
    dealer: 'N',
    vulnerability: 'ew',
    // Bidding-only (only our hand): two questions, then back to the list.
    deal: {
      S: { S: 'AQT4', H: '53', D: 'KJ92', C: 'K84' },
    },
    auction: [
      { call: '1H' },
      { call: 'P' },
      {
        question: {
          id: 'q1',
          choiceType: 'multiple_choice',
          prompt: 'Partner opened 1♥. Your response?',
          options: ['1S', '1NT', '2D', '2H'],
          answer: '1S',
          explanation: 'Bid your four-card spade suit up the line. Answer: (a) 1♠.',
        },
      },
      { call: 'P' },
      { call: '2C' },
      { call: 'P' },
      {
        question: {
          id: 'q2',
          choiceType: 'multiple_choice',
          prompt: 'Partner rebid 2♣. Your call?',
          options: ['2D', '2NT', '3C', '2H'],
          answer: '2NT',
          explanation:
            'With a balanced hand and stoppers everywhere, describe an invitation. Answer: (b) 2NT.',
        },
      },
    ],
  },
]
