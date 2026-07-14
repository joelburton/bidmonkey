-- Seed problem: a bidding-only limit-raise decision.
-- Dealer North, none vulnerable, hero South.
-- Full 52-card deal (each card appears exactly once).

INSERT INTO problems
    (title, source, difficulty, tags, hero, dealer, vulnerability,
     deal, auction, play, contract, commentary)
VALUES (
    'Limit raise or game?',
    'seed',
    2,
    ARRAY['limit-raise', 'major-suit-raise', 'responder'],
    'S', 'N', 'none',

    -- deal
    $json$
    {
      "N": { "S": "AQ3",  "H": "AK952", "D": "Q4",   "C": "K83"  },
      "E": { "S": "T754", "H": "63",    "D": "7632", "C": "T65"  },
      "S": { "S": "862",  "H": "QT84",  "D": "KJ9",  "C": "A72"  },
      "W": { "S": "KJ9",  "H": "J7",    "D": "AT85", "C": "QJ94" }
    }
    $json$::jsonb,

    -- auction (dealer N, clockwise)
    $json$
    [
      { "call": "1H" },
      { "call": "P" },
      { "question": {
          "id": "q1",
          "type": "multiple_choice",
          "prompt": "Partner opened 1H. What is your call?",
          "options": ["1S", "2H", "3H", "4H"],
          "answer": "3H",
          "explanation": "Four trumps and 10 support points: an invitational limit raise. 2H underbids, 4H overbids, 1S ignores the fit."
        }
      },
      { "call": "P" },
      { "call": "4H" },
      { "call": "P" },
      { "call": "P" },
      { "call": "P" }
    ]
    $json$::jsonb,

    NULL,                    -- play: bidding-only problem

    '4H by N',
    'With 18 HCP opposite an invitation, North accepts and bids game.'
);
