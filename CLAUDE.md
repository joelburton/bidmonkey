# bidmonkey

A personal web app for quizzing myself on **bridge bidding & play**. It does NOT
play bridge or understand the rules — it presents pre-authored problems from a
database and checks my answers against stored solutions.

Single user, **no authentication of any kind**. Desktop + mobile (iPhone), but
the table view is designed portrait-first.

## Repo layout

```
/                     ← database design (Postgres) — no server yet
  schema.sql          Postgres DDL: one `problems` row per problem; JSONB for deal/auction/play
  schema.v1.json      JSON Schema (draft 2020-12) validating the deal/auction/play JSONB shapes
  seed.sql            one sample INSERT
web/                  ← the Vite + React + TS frontend (this is where the app lives)
```

There is **no backend**. The frontend reads sample data from
`web/src/data/problems.ts`, whose objects match the `schema.v1.json` shapes — so
it can later be swapped for a `fetch` against a real API/DB.

## Running

```
cd web            # IMPORTANT: repo root has no package.json; everything is under web/
npm install
npm run dev       # vite dev server (usually http://localhost:5174)
npm run build     # tsc -b && vite build  — run this to typecheck
npm run lint      # oxlint
```

Stack: **Vite 8, React 19, TypeScript 6**. No react-router, no Next (deliberate —
routing is a single `useState` in `App.tsx` toggling list ⇄ detail). Fonts come
from **Google Fonts** (Roboto for UI, Roboto Flex for card text).

## Status / phases

- **Phase 1 (done):** database design — `schema.sql`, `schema.v1.json`, `seed.sql`.
- **Phase 2 (done):** problem list; portrait bridge table showing the 4 hands as
  playing-card faces.
- **Phase 3 (done):** auction table + bid-entry pad + answer checking with an
  explanation popup; mouse and keyboard entry.
- **Out of scope so far:** card play, any backend/DB connection, revealing the
  rest of the auction after a correct answer, multiple questions per problem,
  per-question attempt tracking.

## Frontend architecture

- `App.tsx` — `selectedId` state; renders `ProblemList` or the detail view.
- `types.ts` — mirrors `schema.v1.json` (Seat, Suit, Deal, Hand, Problem, …).
- `data/problems.ts` — 3 sample problems. **Problem 1 "Limit raise or game?"** is
  the fully worked one (a game-try auction `1♥ - 1♠; 2♦` with a real explanation).
- `bidding.ts` — auction logic. Columns are **W→N→E→S** (a clockwise cycle, so
  filling left-to-right from the dealer's column works for any dealer). Also bid
  ranking, legality (`levelLegal`/`bidLegal`), and `doubleState`
  (double vs redouble vs none).
- `components/`
  - `BridgeTable.tsx` — the full-bleed portrait table (N/S top/bottom, E/W side
    rails, center = auction/bid area).
  - `Hand.tsx` — a hand as overlapping card faces. Horizontal fan for N/S;
    rotated vertical rails for E/W (`west`/`east` orientations; East is a mirror
    via `column-reverse` + opposite rotation).
  - `Card.tsx` — one card face (rank + corner pip + center pip).
  - `SuitGlyph.tsx` — the four **Wikimedia "Anglo-American card suits"** paths
    (public domain) + an inline-SVG `SuitGlyph` for HTML (bid buttons, auction).
  - `AuctionPanel.tsx` — center panel: header (problem id + vulnerability),
    auction table with `?` at the seat to act, bid pad, and the answer popup.
  - `ProblemList.tsx` — the clickable list.
- `index.css` — all styling (no CSS framework). Global, plus component classes.

## Conventions & non-obvious decisions

- **Data:** prefer JSON fields over deep normalization; one row per whole problem.
  Deals/play are authored, not edited in-app. Every question object has a stable
  `id` — the intended seam for a future `attempts` table.
- **Suit display order is S-H-C-D** (clubs separates the two red suits so ♥/♦ are
  never adjacent). Set in `Hand.tsx` `SUIT_ORDER`.
- **Layout:** the detail view is a fixed-height (`100dvh`) full-bleed table that
  **never scrolls** — tall E/W rails clip (`grid-template-rows: auto minmax(0,1fr) auto`)
  instead of pushing the page. N/S fans are edge-to-edge and auto-fill their width
  via a percentage-margin formula, so card size (`--card-w`, set per rail) is the
  only knob. E/W rails are pushed mostly off-screen, showing only an inner sliver.
- **Card size vs. legibility:** with 13 cards across the width, each visible sliver
  = `(width − cardW)/12`. Bigger cards ⇒ thinner slivers. `--card-w` on
  `.rail-south`/`.rail-north` is tuned so the "10" index stays readable.
- **Suit pips / colors:**
  - Card faces: pips are nested SVGs of the Wikimedia paths, solid fill via `.red`/`.black`.
  - On the dark baize (`--felt: #14532d`): UI pips (`SuitGlyph`) get a **white
    outline** (`.suit-glyph path { stroke }`, `overflow: visible`) so red/black read
    against the green; black suits stay truly black.
  - Explanation-popup text: Unicode suit symbols are colored (`.suit-red-text` red,
    `.suit-black-text` light) with a `U+FE0E` variation selector to force text (not
    emoji) presentation so color applies.
- **Fonts:** UI = Roboto; card ranks/pips = **Roboto Flex at `font-stretch: 75%`,
  weight 400** (condensed, so "10" fits). Relies on the Roboto Flex width axis from
  Google Fonts; degrades to normal width if the font fails to load.
- **Bid entry (`AuctionPanel`):** two-tap — level (1–7) then strain (♣♦♥♠/NT);
  Double/Pass one-tap. Illegal levels/strains disable; Double↔Redouble is
  context-aware. Entering a bid checks it vs the question's `answer` (+ optional
  `accept`) and opens the popup ("Correct!" / "Not quite" + explanation).
  - **Keyboard:** `1`–`7` = level, `c/d/h/s/n` = strain (n=NT), `p` = pass,
    `x` = double/redouble (redouble only when the last live call was an opponent's
    double). Handled keys flash the button (`.pressed`). **Any key closes the
    answer popup.**
  - The popup covers only the center (cards stay visible), is scrollable, and
    dismisses on any click outside (transparent full-screen catcher).

## Verifying visual changes

There are no automated tests. To check UI work I drive the running dev server
with **Playwright** (Chromium), screenshotting at iPhone (390×844) and desktop
widths. Playwright is not a project dependency — install it ad-hoc under `web/`
(`npm i -D playwright`) and uninstall when done. This caught real bugs (clipped
hands, cramped "10", the emoji-colored ♠ in the popup).

## Preferences

- Readable over authentic/detailed for card visuals.
- Keep dependencies minimal; no framework/router unless it earns its place.
- Confirm outward-facing / hard-to-reverse actions before doing them.
