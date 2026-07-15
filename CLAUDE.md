# bidmonkey

A personal web app for quizzing myself on **bridge bidding & play**. It does NOT
play bridge or understand the rules — it presents pre-authored problems from a
database and checks my answers against stored solutions.

Single user, **no authentication of any kind**. Desktop + mobile (iPhone), but
the table view is designed portrait-first.

## Repo layout

```
/                     ← database (Postgres, hosted on Supabase)
  schema.sql          Postgres DDL: sources, problems (jsonb deal/auction/play), quizzes, quizzes_problems, RLS
  schema.v1.json      JSON Schema (draft 2020-12) validating the deal/auction/play JSON shapes
  seed.sql            generated one-time seed (do not hand-edit — see db/gen-seed.mjs)
  db/gen-seed.mjs     emits the initial seed from the frontend fixtures
web/                  ← the Vite + React + TS frontend (this is where the app lives)
```

The frontend is a **static site that talks straight to Supabase** (no custom
server): content is read via the PostgREST REST API. The anon key is public;
**RLS** on the server is the real access control.

### Database (Postgres / Supabase)

Content (`sources`, `problems`, `quizzes`, `quizzes_problems`) is authored in the
DB and read by the app. `quizzes_problems` is the m2m with a 1-based `ordinal` (a
problem may be in several quizzes). **RLS:** `anon` may only `SELECT` (you author
content via psql / the SQL editor, which bypasses RLS), so a leaked key can only
read. First-time
setup against a Supabase project:

```
# 1. run schema.sql in the Supabase SQL editor (or psql)
# 2. generate + run the initial seed:
node db/gen-seed.mjs > seed.sql        # reads web/src/data/{problems,catalog}.ts
#    then run seed.sql in the SQL editor
```

After that, **new problems are authored directly in the DB** (`insert into
problems …` via psql — no redeploy); `web/src/data/*` is only the initial seed
and the test fixtures, not read at runtime. Validate schema/seed changes locally
against the cached `supabase/postgres` Docker image before running them remotely.

## Running

```
cd web            # IMPORTANT: repo root has no package.json; everything is under web/
cp .env.example .env   # then fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm install
npm run dev       # vite dev server (usually http://localhost:5174) — needs .env
npm run build     # tsc -b && vite build  — run this to typecheck
npm test          # vitest run (unit + component tests)
npm run e2e       # playwright (stubs Supabase; run `npx playwright install chromium` once)
npm run lint      # oxlint
```

Without `.env` filled in, the app shows a "Couldn't load problems" error (it
can't reach Supabase) — that's expected, not a crash.

Stack: **Vite 8, React 19, TypeScript 6**. No react-router, no Next (deliberate —
routing is a single `Nav` union in `App.tsx`: `sources` → `quizzes` → `quiz`).
Fonts come from **Google Fonts** (Roboto for UI, Roboto Flex for card text).

## Status / phases

- **Phase 1 (done):** database design — `schema.sql`, `schema.v1.json`, `seed.sql`.
- **Phase 2 (done):** problem list; portrait bridge table showing the 4 hands as
  playing-card faces.
- **Phase 3 (done):** auction (multi-question — the auction continues after each
  correct bid, only stopping where the data poses a question), answer checking
  with an explanation popup, mouse + keyboard entry.
- **Phase 4 (done):** card play. After the auction: if not all four hands are
  known, the problem is bidding-only; otherwise play the hand — deal out the recorded play,
  reveal the dummy after the opening lead, auto-play with pauses, stop at
  questions for the hero, then reveal all hands for free study.
- **Phase 5 (done):** sources/quizzes + navigation. sources → quizzes → a quiz
  run in order. Quiz nav (Home `‹` / Next `›`) lives in the app header, available
  in every phase; header center is the non-link `QuizTitle #ordinal`.
- **Phase 6 (done):** content moved to **Supabase/Postgres**. The app fetches the
  catalogue on load (async, with loading/error/retry).
- **Out of scope so far:** any backend beyond Supabase reads, per-question attempt
  tracking / scoring, contract-result scoring.

## Frontend architecture

- `App.tsx` — fetches the catalogue from Supabase on mount (`fetchCatalog`), with
  loading / error+retry screens, then drives a `Nav` union (`sources` | `quizzes`
  | `quiz`): `SourceList`, `QuizList`, or the quiz runner (header + `ProblemView`).
  The quiz header holds Home (`‹`, → sources), the `QuizTitle #ordinal` label, and
  Next (`›`, → next problem; disabled on the last). Nav is header-only so it works
  during the auction, play, and free study alike.
- `lib/supabase.ts` — tiny PostgREST client over `fetch` (`sbSelect`), no SDK;
  config from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
- `data/repo.ts` — `fetchCatalog()`: reads sources/problems/quizzes and maps the
  PostgREST rows → app types. **The app's only runtime data source.**
- `types.ts` — mirrors `schema.v1.json` / tables (Seat, Suit, Deal, Hand, Problem,
  Source, Quiz, BidQuestion, CardQuestion, Trick, …).
- `data/problems.ts` + `data/catalog.ts` — the **initial seed + test fixtures**
  only (not read at runtime): 5 sample problems and the FakeBook / QuizA / QuizB
  catalogue. `db/gen-seed.mjs` and the e2e stubs consume them.
- `components/SourceList.tsx` / `QuizList.tsx` — the two list levels.
- `bidding.ts` — auction logic. Columns are **W→N→E→S** (a clockwise cycle, so
  filling left-to-right from the dealer's column works for any dealer). Bid
  ranking, legality (`levelLegal`/`bidLegal`), `doubleState`, and:
  - `buildAuction(problem, answers)` — reveals calls up to the next unanswered
    question; `complete` once all are answered.
  - `finalContract(problem, answers)` — level/strain/declarer/doubled.
- `libs/play.ts` — pure bridge rules (no React/layout): `nextSeat`/`partnerOf`,
  `trickWinner(cards, trump)`, `flattenPlay`, `handRemaining`, and legal-play
  (`ledSuit`, `legalCards`/`isLegalPlay`, `seatToAct`). `play.ts` re-exports these
  and adds the hero-relative `seatLayout`.
- `components/`
  - `ProblemView.tsx` — the per-problem phase machine (auction → play). Quiz nav
    is in the app header, not here.
  - `BridgeTable.tsx` — layout shell: `top`/`bottom`/`left`/`right`/`center`
    slots (N/S span top+bottom, E/W are the rails). Content chosen per phase.
  - `AuctionPanel.tsx` — center during the auction. Controlled by `answers` +
    `onAnswer`; correct bid advances, wrong bid shows the explanation popup;
    when done, "Play the hand ▸" (playable) or a "Bidding complete." note
    (bidding-only; nav is the header's Home/Next).
  - `PlayView.tsx` — the play state machine (see below).
  - `PlayCenter.tsx` — center during play: contract + current trick (placed to
    match the hand positions) + the wrong-answer popup.
  - `Hand.tsx` — overlapping card faces. Horizontal fan for N/S and the dummy;
    rotated rails for E/W (`west`/`east`; East mirrors via `column-reverse`).
    `onPlay` makes cards clickable.
  - `Card.tsx` / `SuitGlyph.tsx` — a card face / the Wikimedia suit pips (public
    domain) as an inline SVG for HTML.
  - `suitText.tsx` — `withSuits(text)` colors suit symbols in explanations.
  - `SourceList.tsx` / `QuizList.tsx` — the sources and quizzes list levels
    (both reuse the `.problem-list` / `.problem-row` styling).
- `index.css` — all styling (no CSS framework). Global, plus component classes.

### Play phase (`PlayView`)

- **Layout is hero-relative** (`seatLayout(hero)` in `play.ts`): the hero is at
  the bottom, partner across (top), LHO on the left rail, RHO on the right —
  works for any hero/declarer/dummy. **Hands and the trick use the same mapping**
  so a played card lands under the hand that played it (don't split them, or you
  get the W/E swap `PlayView.test.tsx` guards against). Consequence: when the
  hero is a defender the **dummy shows as a rotated side rail**, not a horizontal
  top fan — the two can't both hold (dummy is adjacent to a defender, not across).
- Engine: a `useEffect` steps `moveIndex` through the flattened recorded moves —
  auto-plays a card after a 1s pause, or stops at a question (`pending`; the hero
  clicks a card, checked vs the answer, wrong → popup, retry). The dummy is
  revealed once the first card is played. When a trick completes: if it had no
  player input, pause for a click (`review`); else auto-clear. When the recorded
  moves run out, `allRevealed` reveals every hand for free play.

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
- **Scaling (desktop = phone, larger):** everything is sized in **rem**; the root
  font-size steps 16→20→24px via `(min-width) and (min-height)` media queries, and
  `.app { max-width: 30rem }` keeps a centered portrait column on desktop.
- **Pin grid tracks that hold the fans.** `.table` sets
  `grid-template-columns: minmax(0, 1fr)` — leave the column implicit (`auto`) and
  **real Safari** sizes the track from the fans' *intrinsic* width (the %-margin
  overlap counts as 0 in intrinsic sizing → 13 un-overlapped cards ≈ 2× the app),
  blowing the whole table out sideways and clipping it on the right. Chrome
  resolves the same cyclic percentage at the app width, so it hides the bug. Rule:
  the percentage-overlap fan must never sit in a container whose size content can
  dictate.
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

## Tests

- **Unit / component** (`npm test`, Vitest + Testing Library): `*.test.ts(x)`
  next to the source — bidding/play logic and the auction/play components.
- **E2E** (`npm run e2e`, Playwright, in `e2e/`): full flows in a browser. The
  config auto-starts the dev server in **test mode** (`npm run dev:test`, which
  loads `.env.test` — Supabase URL points at the app's own origin) and runs at a
  **short 390×680 viewport** on purpose — that's the size where the play options
  were pushed off-screen; the test asserts they stay on-screen.
- **E2E never touches real Supabase.** `e2e/fixtures.ts` `stubSupabase(page)`
  intercepts the PostgREST GETs and serves the `data/*` fixtures — call it before
  `page.goto`. So tests are hermetic and never hit a real project. Use a local
  Supabase stack (separate `project_id` + ports in `config.toml`) for real
  read/RLS integration checks instead.
- For quick visual checks, use `@playwright/test`'s `chromium` in a throwaway
  script and screenshot; **always screenshot at a short height (~680), not just
  844** — the 844 height hid the off-screen-options bug.
- **Playwright WebKit is NOT real Safari.** The Safari track-sizing bug above
  rendered byte-identically to Chromium in Playwright's WebKit. After layout
  changes, have a human sanity-check actual macOS Safari — screenshots and
  console probes from there are the only reliable signal.

## Preferences

- Readable over authentic/detailed for card visuals.
- Keep dependencies minimal; no framework/router unless it earns its place.
- Confirm outward-facing / hard-to-reverse actions before doing them.
