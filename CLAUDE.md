# bidmonkey

A personal web app for quizzing myself on **bridge bidding & play**. It does NOT
play bridge or understand the rules — it presents pre-authored problems from a
database and checks my answers against stored solutions.

Single user, **no authentication of any kind**. Desktop + mobile (iPhone), but
the table view is designed portrait-first.

## Repo layout

Everything is at the repo root (Vite + React + TS app + Supabase), like the
sibling `codenames` project — no `web/` subdir.

```
src/                       the app (App.tsx, components/, lib/, data/, …)
e2e/                       Playwright specs + global-setup
public/  index.html  vite.config.ts  tsconfig*.json  playwright.config.ts
supabase/config.toml       local stack config — bidmonkey is the SECOND stack
                           (custom 5433x/8383 ports so it coexists with another)
supabase/migrations/*.sql  the schema (source of truth; `db reset`/`db push`)
supabase/seed.sql          generated seed (do not hand-edit — see db/gen-seed.mjs)
schema.v1.json             JSON Schema validating the deal/auction/play shapes
db/gen-seed.mjs            emits supabase/seed.sql from the frontend fixtures
netlify.toml               deploy config (env vars set in the Netlify UI)
```

The frontend is a **static site that talks straight to Supabase** (no custom
server): content is read via the PostgREST REST API. The anon/publishable key is
public; **RLS** on the server is the real access control.

### Database (Postgres / Supabase, via the CLI)

Content (`sources`, `problems`, `quizzes`, `quizzes_problems`) is authored in the
DB and read by the app. `quizzes_problems` is the m2m with a 1-based `ordinal` (a
problem may be in several quizzes). Use the **Supabase CLI, not the web GUI** —
schema changes are migrations. On the **content** tables `anon` gets
`SELECT`-only, enforced by **RLS + table grants** — note both are required: an
RLS `select` policy is useless without `grant select … to anon` (the GUI adds the
grant implicitly; a migration must be explicit, or reads 401/"permission
denied").

`problem_flags` is the **one table the app writes to** (see "Review flags"
below): `anon` has insert/update/delete on it, with open policies, because with
no auth there is nothing to check a row against. Deliberate — it's one person's
review list, pointing at already-public content.

**Grants don't start where you'd think on the remote project.** Its DEFAULT
PRIVILEGES in `public` hand `anon` full DML on every table postgres creates
(`anon=arwdDxtm`), where a fresh local stack hands out only `Dxtm`. So for months
`anon` held insert/update/delete on all four content tables on remote and
SELECT-only locally, from the same migrations — invisible because RLS (no
write policies) refused every attempt anyway. `20260724110000` revokes those
grants *and* the defaults, so both layers hold and a new table doesn't reopen it.
Lesson: after adding a table, check the **remote** grants
(`information_schema.role_table_grants where grantee='anon'`), not just local.
(`authenticated` still carries the wide defaults — no part of this app uses that
role, since there's no auth.) Local:

```
supabase start                        # brings up the local stack (applies migrations + seed)
node db/gen-seed.mjs > supabase/seed.sql   # regenerate the seed if the fixtures change
supabase db reset                     # re-apply migrations + seed to a clean local DB
npm run psql                          # psql into the local db (port 54332)
```

Remote (first time): `supabase link --project-ref <ref>` then `supabase db push`
(applies migrations); seed it once with `psql "$REMOTE_DB_URL" -f supabase/seed.sql`.
After that, **new problems are authored directly in the DB** (`insert into
problems …` — no redeploy); `src/data/*` is only the initial seed + test
fixtures, not read at runtime.

**Remote DB connection:** the direct `psql` command (with the postgres password) for
the remote is in the gitignored **`db-conn`** file at the repo root — e.g.
`CONN=$(sed -E 's/^psql +//' db-conn); psql "$CONN" -X …`. Use `-X` (Joel's `.psqlrc`
prints border-style noise that corrupts scripted output). Don't print the password.

## Running

```
npm install
supabase start    # bring up the local Supabase stack (dev + e2e run against it)
npm run dev       # vite dev server — hits LOCAL Supabase (see env files below)
npm run build     # tsc -b && vite build  — hits REMOTE (typecheck + prod build)
npm test          # vitest run (unit + component tests)
npm run e2e       # playwright — needs the local stack up; resets it to the seed
npm run lint      # oxlint
```

**Env files** (Vite loads by mode; all gitignored except `.env.example`, and keys
never go in git). `npm run dev` (development) → `.env.local` = the **local** stack
(`supabase status`). `npm run build` (production) → `.env.production.local` =
**remote** (Netlify sets these itself for real deploys). `npm run dev:test`/e2e →
`.env.test` = local (committed; the local publishable key isn't secret). So dev
and prod point at different databases on purpose — don't put remote keys in
`.env`, or plain `dev` will hit prod.

Without `.env` filled in (or Supabase unreachable), the app shows a "Couldn't
load problems" error — that's expected, not a crash.

Stack: **Vite 8, React 19, TypeScript 6**. No react-router, no Next (deliberate —
routing is a single `Nav` union in `App.tsx`: `sources` → `quizzes` → `quiz`).
Fonts come from **Google Fonts** (Roboto for UI, Roboto Flex for card text).

## Scope

Everything through review flags is built; the sections below describe it. One
principle the layout depends on: **each list level is only a list** — tapping a
row opens the level below — and the buttons that *start* something live on the
level they describe.

- **Out of scope so far:** any backend beyond Supabase reads, per-question attempt
  tracking / scoring (flags are per *problem*, not per attempt — no history),
  contract-result scoring.

## Frontend architecture

- `App.tsx` — fetches the catalogue from Supabase on mount (`fetchCatalog`), with
  loading / error+retry screens, then drives a `Nav` union (`sources` | `quizzes`
  | `quiz` | `run`): `SourceList`, `QuizList`, `QuizView`, or the runner (header +
  `ProblemView`). Every start funnels through one `startRun(title, order, from)`;
  `from` records the level that launched it (`quiz`, else `source`, else neither
  for a library-wide run), which is what makes Back go exactly one level up.
  **Every screen wears the same header:** one `.app-header` (fixed `min-height`,
  one padding) whose navigation is always a bordered `.qbtn` — `‹` + a label — so
  the list levels and the table match. On a run it also carries a right Prev (`‹`)
  / Next (`›`) pair (disabled at the ends); the sources screen carries the brand
  instead of a back button, since there's nowhere above it. Nav is
  header-only so it works during the auction, play, and free study alike. Back
  goes **one level up**, to the quizzes of the source the run came from — a `run`
  nav carries that `source` slug for the purpose (a source-less quiz falls back to
  the sources list). The label is deliberately smaller than the surrounding UI
  (`.qbtn-label`, 0.85rem): real quiz titles are long and wrapped at the old size.
- `lib/supabase.ts` — tiny PostgREST client over `fetch` (`sbSelect`, plus
  `sbUpsert`/`sbDelete` for the flags table), no SDK; config from
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
- `data/repo.ts` — `fetchCatalog()`: reads sources/problems/quizzes and maps the
  PostgREST rows → app types. **The app's only runtime content source.**
- `data/flags.ts` + `useFlags.ts` — the review list: `fetchFlags`/`setFlag`/
  `clearFlag` over `problem_flags`, and the hook App holds it in. Fetched
  *separately* from the catalogue on purpose — a flags failure logs and moves on
  rather than costing us the problems.
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
- `lib/play.ts` — pure bridge rules (no React/layout): `nextSeat`/`partnerOf`,
  `trickWinner(cards, trump)`, `flattenPlay`, `handRemaining`, and legal-play
  (`ledSuit`, `legalCards`/`isLegalPlay`, `seatToAct`). `play.ts` re-exports these
  and adds the hero-relative `seatLayout`.
- `components/`
  - `ProblemView.tsx` — the per-problem phase machine (auction → play). Quiz nav
    is in the app header, not here.
  - `BridgeTable.tsx` — layout shell: `top`/`bottom`/`left`/`right`/`center`
    slots (N/S span top+bottom, E/W are the rails). Content chosen per phase.
    `done` swaps the felt for neutral grey (`--felt-done`) once a problem is over
    — the play record has run out, or a bidding-only auction is complete — so a
    screen with nothing but "Next ▸" reads as non-actionable at a glance. A
    playable problem's finished auction still offers "Play", so it stays green.
  - `AuctionPanel.tsx` — center during the auction. Controlled by `answers` +
    `onAnswer`; correct bid advances, wrong bid shows the explanation popup;
    when done, "Play the hand ▸" (playable) or a "Bidding complete." note
    (bidding-only; nav is the header's Home/Next).
  - `PlayView.tsx` — the play state machine (see below).
  - `PlayCenter.tsx` — center during play: contract + current trick (placed to
    match the hand positions) + the wrong-answer popup.
  - `Hand.tsx` — the 13 cards of a hand. Horizontal fan for N/S and the dummy;
    rotated rails for E/W (`west`/`east`; East mirrors via `column-reverse`).
    `onPlay` makes cards clickable.
  - `Card.tsx` / `SuitGlyph.tsx` — one card, cropped to its rank-over-suit index
    (not a full playing-card face) / the Wikimedia suit pips (public domain) as an
    inline SVG for HTML.
  - `suitText.tsx` — `withSuits(text)` swaps Unicode suit symbols for the SVG
    `SuitGlyph` pips. Used by the explanation popup **and by question prompts**
    (`.mc-prompt` in the auction, `.play-msg` during play) — the pips' white
    outline is what lets ♠/♣ stay truly black on the felt, where Unicode text had
    to be washed-out grey to read at all.
  - `FlagButton.tsx` — the ⚑ review toggle (`FlagButton`) and its drawn pennant
    (`FlagIcon`, also used by QuizList's Flagged button). Drawn, not typed: the
    Unicode flags render as un-recolorable emoji on iOS.
  - `SourceList.tsx` / `QuizList.tsx` / `QuizView.tsx` — the three list levels
    (the first two reuse the `.problem-list` / `.problem-row` row styling; the
    lists carry a `.source-head` with their scope's Random + Flagged buttons, and
    `QuizView` is one quiz's start screen: title, source, and the four runs).
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

### Review flags (`problem_flags`)

- **What flags a problem:** answering with anything that isn't the preferred
  answer. A wrong answer records `reason = 'wrong'`; an **`accept` alternative
  records `'alternate'`** — it's graded correct ("Alternate", orange) but is *not*
  what the problem teaches, so it still comes back for review. Manual flags are
  `'manual'`. `useFlags.flagAnswer` never downgrades ('wrong' is the strongest)
  and skips a write when the reason is unchanged, so retrying a wrong answer
  doesn't re-POST. **Grading is untouched by all this** — an alternative still
  advances the auction/play with the canonical `answer`.
- **UI:** the ⚑ toggle sits next to the problem id in the auction and on the
  contract line during play (the play phase shows no id). **Shift+F** does the
  same from the keyboard — Shift because plain `f` is a live multiple-choice
  option letter (`OPT_LETTERS = 'abcdef'`). With the answer popup open, Shift+F
  only closes it: the wrong answer has just auto-flagged the problem, and
  toggling there would silently undo that. Both key handlers therefore ignore a
  bare `Shift`/`CapsLock` keydown, which would otherwise trip the
  any-key-dismisses rule and let the `F` through as a toggle.
- **Reviewing:** a source's **Flagged (n)** button (in the source header, under
  Random) starts a *random* run over just that source's flagged problems, titled
  `<Source> · flagged`. The order is snapshotted at the start, so unflagging as
  you go doesn't reshuffle the run.
- **Writes are optimistic:** the UI flips immediately, the row is written behind
  it, and a failed write *reverts* the flag rather than leaving the UI claiming
  something was saved. Row presence is the flag — unflagging DELETEs the row (so
  a future per-problem `note` means switching to a `flagged boolean`, one small
  migration).
- **`player` is a constant** (`data/flags.ts` `PLAYER`, matching the column
  default). There's no auth, so it isn't verified — its job is that flags follow
  the *person*: flag on the phone, review on the desktop. A localStorage id or
  Supabase anonymous auth would both have been per-browser, which is exactly what
  this must not be. Real users later = fill `player` from a session.

## Conventions & non-obvious decisions

- **Data:** prefer JSON fields over deep normalization; one row per whole problem.
  Deals/play are authored, not edited in-app. Every question object has a stable
  `id` — the intended seam for a future `attempts` table.
- **Suit display order is S-H-C-D** (clubs separates the two red suits so ♥/♦ are
  never adjacent). Set in `Hand.tsx` `SUIT_ORDER`.
- **Layout:** the detail view is a fixed-height (`100dvh`) full-bleed table that
  **never scrolls** — tall E/W rails clip (`grid-template-rows: auto minmax(0,1fr) auto`)
  instead of pushing the page. N/S fans are edge-to-edge and auto-fill their width
  via a percentage-margin formula (`min(0px, …)`, so cards close up or overlap but
  never spread apart). **One card size for all four hands:** `--card-w` is set once
  on `.table` — `min(100vw, 30rem, 100dvh − 11rem) / 13` — so 13 cards fit across a
  N/S fan and 13 stack down an E/W rail, every card shown in full.
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
- **Card size vs. legibility:** the `--card-w` formula on `.table` is what keeps the
  "10" index readable — it's derived from fitting 13 cards, so a hand only overlaps
  if the viewport can't hold them all. The trick sets its own larger `--card-w`
  (3rem) so the played cards read as the focus.
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
    double), `a`–`f` = multiple-choice options, **`Shift+F` = flag/unflag for
    review** (in the auction and the play phase alike). Handled keys flash the
    button (`.pressed`). **Any key closes the answer popup** — except a bare
    modifier (see "Review flags") and `<`/`>`.
  - **`<` and `>` step between problems**, the keyboard twins of the header's
    Prev/Next. Owned by `App` (like the buttons), not the phases, so one pair
    works in the auction, the play and free study alike; both phase key
    handlers skip them so the any-key-dismisses rule doesn't fire as well.
  - The popup covers only the center (cards stay visible), is scrollable, and
    dismisses on any click outside (transparent full-screen catcher).

## Tests

- **Unit / component** (`npm test`, Vitest + Testing Library): `*.test.ts(x)`
  next to the source — bidding/play logic and the auction/play components.
- **E2E** (`npm run e2e`, Playwright, in `e2e/`): full flows in a browser against
  **the real local Supabase stack** — no stubbing, so the PostgREST queries, row
  mapping, and RLS/grants are actually exercised (this is what caught the missing
  anon grant). The dev server runs in **test mode** (`npm run dev:test` → loads
  `.env.test`, which points at the local stack) at a **short 390×680 viewport** on
  purpose — that's the size where the play options were pushed off-screen.
- **E2E needs the local stack up** (`supabase start`, repo root). `e2e/global-setup.ts`
  runs `supabase db reset` before the suite so tests see a known seed; a run resets
  the local DB, so don't keep local-only data you care about. Content is read-only,
  but the suite **does write `problem_flags`** — any spec that answers wrongly
  flags that problem, so `flags.spec.ts` runs serially, uses QuizC (which no other
  spec touches), and never asserts an exact flagged count. (No test-CI — e2e is run
  locally.)
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
